import { useEffect, useRef } from 'react';
import { whenIdle } from '../../lib/motion';
import { isRoadBroken, onRoadBroken } from '../../lib/raceState';
import { observeReveal } from '../../lib/reveal';
import {
  buildSpiral,
  measureSpiralAnchor,
  SPIRAL_CLIP_FADE,
  SPIRAL_IGNITE_MS,
  SPIRAL_ROLL,
  SPIRAL_TILT,
  SPIRAL_TURN_SECONDS,
  spiralCoreY,
  spiralRadius,
  type SpiralAnchor
} from '../../lib/spiral';
import './SpiralGalaxy.css';

/**
 * Spiral galaxy of the space (spec-v3 §3.3): our own WebGL, no library. One draw call of
 * `gl.POINTS` (a size per particle, a radial glow texture made in code, additive blending) for
 * the disc, its nucleus and the loose stars of the sky.
 *
 * The canvas is fixed behind the page; the nucleus sits between the two words of the second hero
 * (the full-screen Orbitarium title) and follows the page slower than it scrolls (parallax). The
 * galaxy belongs to that hero: it is faded out at the hero's bottom edge (`uClip`) and leaves
 * with it, so it never shows behind the content of the section below (spec-v4 §3).
 * Nothing in the DOM changes per frame: position, turn and light are uniforms.
 *
 * WebGL rules of the project: only mounted with a real GPU, DPR 1, set up when the browser is
 * idle, frame rate capped at 30 per second on touch, a watchdog (5 frames in a row over 120 ms) that stops it for good,
 * `webglcontextlost` handled, paused in hidden tabs and while the sky is behind the map.
 */
export interface SpiralGalaxyProps {
  /** Particles of the galaxy (the sky stars are added to these). */
  points: number;
  /** Frame-rate cap (frames per second). 0 = display rate. */
  frameRateCap?: number;
  /** Stops the render loop (the sky is hidden behind the map). */
  paused?: boolean;
  /** Called once the shader is compiled and the first frame is drawn. */
  onReady?: () => void;
  /** Called when it stops for good: no context, frozen by the watchdog, or context lost. */
  onFail?: (reason: 'unavailable' | 'frozen' | 'lost') => void;
}

const SLOW_FRAME_MS = 120;
const SLOW_FRAMES_TO_FREEZE = 5;
/** Size of the glow texture (one channel). */
const SPRITE = 64;
/** The loose stars drift up at this fraction of the page speed. */
const SKY_DRIFT = 0.06;

const VERTEX = `#version 300 es
precision highp float;
in vec3 aPos;
in vec4 aMeta;
in vec3 aColor;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAngle;
uniform vec2 uTilt;
uniform vec2 uRoll;
uniform float uIgnite;
uniform float uFade;
uniform float uTime;
uniform float uSkyShift;
uniform float uMaxPoint;
uniform float uClip;
uniform float uClipFade;
out vec4 vColor;

void main() {
  float kind = aMeta.w;
  float size = aMeta.x;
  float alpha = aMeta.y;
  vec2 clip;
  if (kind > 0.5 && kind < 1.5) {
    // Loose star: a place on the screen, drifting a little with the page, twinkling slowly.
    vec2 uv = vec2(aPos.x, fract(aPos.y + uSkyShift * aPos.z));
    clip = uv * 2.0 - 1.0;
    alpha *= 0.78 + 0.22 * sin(uTime * (0.4 + aPos.z) + aMeta.z);
  } else {
    float r = length(aPos.xy);
    float c = cos(uAngle);
    float s = sin(uAngle);
    vec2 q = vec2(aPos.x * c - aPos.y * s, aPos.x * s + aPos.y * c);
    // Seen at an angle: the disc is flattened, its thickness shows a little.
    vec2 d = vec2(q.x, q.y * uTilt.x + aPos.z * uTilt.y);
    d = vec2(d.x * uRoll.x - d.y * uRoll.y, d.x * uRoll.y + d.y * uRoll.x);
    vec2 px = uCenter + d * uRadius;
    clip = vec2(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0);
    // Lights up from the nucleus outwards.
    alpha *= smoothstep(r - 0.05, r + 0.2, uIgnite * 1.25) * uFade;
    if (kind > 1.5) size *= uRadius;
    // Gone at the bottom edge of the hero (a wide glow is cut by its lower rim, not its centre).
    float rim = px.y + (kind > 1.5 ? min(size, uMaxPoint) * 0.5 : 0.0);
    alpha *= 1.0 - smoothstep(uClip - uClipFade, uClip, rim);
  }
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = clamp(size, 1.5, uMaxPoint);
  vColor = vec4(aColor * alpha, alpha);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uSprite;
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vColor * texture(uSprite, gl_PointCoord).r;
}`;

const UNIFORMS = ['uRes', 'uCenter', 'uRadius', 'uAngle', 'uTilt', 'uRoll', 'uIgnite', 'uFade', 'uTime', 'uSkyShift', 'uMaxPoint', 'uClip', 'uClipFade', 'uSprite'] as const;
type UniformName = (typeof UNIFORMS)[number];

function compile(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  if (!program || !vertex || !fragment) return null;
  gl.shaderSource(vertex, VERTEX);
  gl.shaderSource(fragment, FRAGMENT);
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.bindAttribLocation(program, 1, 'aMeta');
  gl.bindAttribLocation(program, 2, 'aColor');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, name)])) as Record<
    UniformName,
    WebGLUniformLocation | null
  >;
  return { program, uniforms };
}

/** Radial glow, bright in the middle and gone at the edge: one byte per pixel. */
function glowTexture(): Uint8Array {
  const data = new Uint8Array(SPRITE * SPRITE);
  const half = (SPRITE - 1) / 2;
  for (let y = 0; y < SPRITE; y += 1) {
    for (let x = 0; x < SPRITE; x += 1) {
      const d = Math.min(1, Math.hypot(x - half, y - half) / half);
      const value = Math.exp(-d * d * 5.5) * (1 - d * d);
      data[y * SPRITE + x] = Math.round(255 * value);
    }
  }
  return data;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function SpiralGalaxy({ points, frameRateCap = 0, paused = false, onReady, onFail }: SpiralGalaxyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFailRef = useRef(onFail);
  const onReadyRef = useRef(onReady);
  const pausedRef = useRef(paused);
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onFailRef.current = onFail;
    onReadyRef.current = onReady;
  }, [onFail, onReady]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) wakeRef.current?.();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let dispose: (() => void) | null = null;

    const init = () => {
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        failIfMajorPerformanceCaveat: true
      });
      const linked = gl ? compile(gl) : null;
      if (!gl || !linked) {
        onFailRef.current?.('unavailable');
        return;
      }

      const data = buildSpiral(points);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffers = [data.pos, data.meta, data.color].map((array, index) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, index === 1 ? 4 : 3, gl.FLOAT, false, 0, 0);
        return buffer;
      });

      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SPRITE, SPRITE, 0, gl.RED, gl.UNSIGNED_BYTE, glowTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
      const maxPoint = Math.min(512, range?.[1] ?? 64);
      const u = linked.uniforms;
      const minFrameMs = frameRateCap > 0 ? 1000 / frameRateCap - 2 : 0;

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.clearColor(0, 0, 0, 0);

      let anchor: SpiralAnchor | null = null;
      let time = 0;
      // Lights up once: when the first car jumps off the road, or when the title comes into view.
      let ignite = 0;
      let lit = isRoadBroken();
      let raf = 0;
      let lastTick = 0;
      let lastRender = 0;
      let slowFrames = 0;
      let stopped = false;

      const render = () => {
        const width = canvas.width;
        const height = canvas.height;
        const sy = window.scrollY;
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(linked.program);
        gl.bindVertexArray(vao);
        // The nucleus rests between the two words of the title when the hero fills the screen;
        // away from there it follows the page slower than the page moves.
        const coreY = anchor ? spiralCoreY(anchor.y, sy, height, true) - sy : height * 3;
        const bottom = anchor ? anchor.bottom - sy : 0;
        gl.uniform2f(u.uRes, width, height);
        gl.uniform2f(u.uCenter, anchor ? anchor.x - window.scrollX : width / 2, coreY);
        gl.uniform1f(u.uRadius, spiralRadius(width, height, anchor?.gap));
        gl.uniform1f(u.uAngle, (time / SPIRAL_TURN_SECONDS) * Math.PI * 2);
        gl.uniform2f(u.uTilt, Math.cos(SPIRAL_TILT), Math.sin(SPIRAL_TILT));
        gl.uniform2f(u.uRoll, Math.cos(SPIRAL_ROLL), Math.sin(SPIRAL_ROLL));
        gl.uniform1f(u.uIgnite, easeOut(ignite));
        // Leaves with the hero.
        gl.uniform1f(u.uFade, clamp(bottom / (height * 0.55)));
        gl.uniform1f(u.uClip, bottom);
        gl.uniform1f(u.uClipFade, SPIRAL_CLIP_FADE);
        gl.uniform1f(u.uTime, time);
        gl.uniform1f(u.uSkyShift, (sy / Math.max(1, height)) * SKY_DRIFT);
        gl.uniform1f(u.uMaxPoint, maxPoint);
        gl.uniform1i(u.uSprite, 0);
        gl.drawArrays(gl.POINTS, 0, data.count);
      };

      // Stops for good and reports: the caller swaps in the still picture.
      const freeze = (reason: 'frozen' | 'lost') => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(raf);
        raf = 0;
        onFailRef.current?.(reason);
      };

      const frame = (now: number) => {
        raf = 0;
        if (stopped || document.hidden || pausedRef.current) return;
        if (lastTick) {
          slowFrames = now - lastTick > SLOW_FRAME_MS ? slowFrames + 1 : 0;
          if (slowFrames >= SLOW_FRAMES_TO_FREEZE) {
            freeze('frozen');
            return;
          }
        }
        lastTick = now;
        if (!lastRender || now - lastRender >= minFrameMs) {
          const dt = lastRender ? Math.min(0.05, Math.max(0.0005, (now - lastRender) / 1000)) : 1 / 60;
          lastRender = now;
          time += dt;
          if (lit && ignite < 1) ignite = Math.min(1, ignite + (dt * 1000) / SPIRAL_IGNITE_MS);
          render();
        }
        raf = requestAnimationFrame(frame);
      };

      const wake = () => {
        if (raf || stopped || document.hidden || pausedRef.current) return;
        // Coming back from a pause: the gap is not a slow frame.
        lastTick = 0;
        lastRender = 0;
        slowFrames = 0;
        raf = requestAnimationFrame(frame);
      };
      wakeRef.current = wake;

      const resize = () => {
        // DPR 1: one canvas pixel per CSS pixel.
        const width = Math.max(1, document.documentElement.clientWidth);
        const height = Math.max(1, window.innerHeight);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        anchor = measureSpiralAnchor();
        if (!stopped) render();
      };

      const onVisibility = () => {
        lastTick = 0;
        lastRender = 0;
        slowFrames = 0;
        if (document.hidden) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else {
          wake();
        }
      };

      const onLost = (event: Event) => {
        event.preventDefault();
        freeze('lost');
      };

      const light = () => {
        lit = true;
        wake();
      };
      const stopRoad = onRoadBroken(broken => {
        if (broken) light();
      });
      const title = document.querySelector('[data-galaxy-core]');
      const stopTitle = title ? observeReveal(title, light) : null;

      // The page above can change height (fonts, a card that grows): measure again.
      const main = document.querySelector('main');
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
      if (main) observer?.observe(main);
      window.addEventListener('resize', resize, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      canvas.addEventListener('webglcontextlost', onLost);
      resize();
      wake();
      onReadyRef.current?.();

      dispose = () => {
        stopped = true;
        wakeRef.current = null;
        cancelAnimationFrame(raf);
        stopRoad();
        stopTitle?.();
        observer?.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onLost);
        gl.deleteProgram(linked.program);
        buffers.forEach(buffer => gl.deleteBuffer(buffer));
        gl.deleteTexture(texture);
        gl.deleteVertexArray(vao);
        if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    };

    // Set up when the browser is idle (still during the loading screen: its last step waits for it).
    const cancelIdle = whenIdle(init);
    return () => {
      cancelIdle();
      dispose?.();
    };
  }, [points, frameRateCap]);

  return <canvas ref={canvasRef} className="spiral-galaxy" aria-hidden="true" />;
}
