/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/Galaxy/Galaxy.tsx
 * Changes for Frontier Models UI: palette-only shader (up to 8 tint slots; repeating a colour makes it more frequent), no mouse repulsion / click warp / intro; fixed full-viewport canvas; frame-rate cap; watchdog that freezes on the last frame after 5 slow frames; context-loss handling; failure callback.
 *
 * MIT + Commons Clause License Condition v1.0
 *
 * Copyright (c) 2026 David Haz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, and distribute the Software as part of
 * an application, website, or product, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * Commons Clause Restriction: You may use this Software, including for any
 * commercial purpose, so long as you do not sell, sublicense, or redistribute the
 * components themselves - whether alone, in a bundle, or as a ported version.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useEffect, useRef } from 'react';
import './Galaxy.css';

export interface GalaxyProps {
  /** Star tints, picked per star (repeat a color to make it more frequent). Max 8. */
  starColors: string[];
  density?: number;
  layers?: number;
  starSpeed?: number;
  speed?: number;
  rotationSpeed?: number;
  glowIntensity?: number;
  twinkleIntensity?: number;
  starSize?: number;
  flareIntensity?: number;
  /** Device pixel ratio used for the canvas. */
  dpr?: number;
  /** Frame-rate cap (frames per second). 0 = display rate. */
  frameRateCap?: number;
  /** Called when the background stops for good (watchdog froze it or the context was lost). */
  onFail?: (reason: 'unavailable' | 'frozen' | 'lost') => void;
  className?: string;
}

const MAX_LAYERS = 8;
const MAX_COLORS = 8;
const SLOW_FRAME_MS = 120;
const SLOW_FRAMES_TO_FREEZE = 5;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform float uTime;
uniform vec2 uResolution;
uniform float uGloss;
uniform float uDepth;
uniform float uDensity;
uniform float uSpeed;
uniform float uStarGlow;
uniform float uFlareGain;
uniform float uTwinkleIntensity;
uniform float uRotationAngle;
uniform int uLayers;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
out vec4 outColor;

#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = uStarGlow / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uFlareGain;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uFlareGain;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uGloss / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;
      float pick = Hash21(si + 7.0) * float(uColorCount);
      vec3 base = uColors[int(min(floor(pick), float(uColorCount - 1)))];
      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      float star = Star(gv - offset - pad, flareSize);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      col += star * twinkle * size * base;
    }
  }
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float angle = uRotationAngle;
  uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;

  vec3 col = vec3(0.0);
  float layers = float(uLayers);
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    if (k >= uLayers) break;
    float i = float(k) / layers;
    float depth = fract(i + uDepth);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + vec2(i * 453.32)) * fade;
  }

  float alpha = min(smoothstep(0.0, 0.3, length(col)), 1.0);
  outColor = vec4(col * alpha, alpha);
}`;

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
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name.replace('[0]', '')] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const Galaxy = ({
  starColors,
  density = 1,
  layers = 4,
  starSpeed = 0.2,
  speed = 0.35,
  rotationSpeed = 0.012,
  glowIntensity = 0.3,
  twinkleIntensity = 0.3,
  starSize = 1,
  flareIntensity = 0.8,
  dpr = 1,
  frameRateCap = 0,
  onFail,
  className = ''
}: GalaxyProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFailRef = useRef(onFail);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      failIfMajorPerformanceCaveat: true
    });
    if (!canvas || !gl) {
      onFailRef.current?.('unavailable');
      return undefined;
    }

    const linked = compile(gl);
    if (!linked) {
      onFailRef.current?.('unavailable');
      return undefined;
    }

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const palette = starColors.slice(0, MAX_COLORS);
    const colors = new Float32Array(MAX_COLORS * 3);
    palette.forEach((value, index) => colors.set(parseHex(value), index * 3));
    const u = linked.uniforms;
    const clampedLayers = Math.min(MAX_LAYERS, Math.max(2, Math.round(layers)));
    const minFrameMs = frameRateCap > 0 ? 1000 / frameRateCap - 2 : 0;

    const state = { time: 0, gloss: 0, depth: 0, angle: 0 };
    let raf = 0;
    let lastTick = 0;
    let lastRender = 0;
    let slowFrames = 0;
    let stopped = false;

    const render = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(linked.program);
      gl.bindVertexArray(vao);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uGloss, state.gloss);
      gl.uniform1f(u.uDepth, state.depth);
      gl.uniform1f(u.uDensity, Math.max(0.01, density));
      gl.uniform1f(u.uSpeed, speed);
      gl.uniform1f(u.uStarGlow, 0.05 * glowIntensity * starSize);
      gl.uniform1f(u.uFlareGain, glowIntensity * flareIntensity);
      gl.uniform1f(u.uTwinkleIntensity, twinkleIntensity);
      gl.uniform1f(u.uRotationAngle, state.angle);
      gl.uniform1i(u.uLayers, clampedLayers);
      gl.uniform3fv(u.uColors, colors);
      gl.uniform1i(u.uColorCount, palette.length);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Freeze on the last complete frame (nothing else is drawn) and report.
    const freeze = (reason: 'frozen' | 'lost') => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      raf = 0;
      onFailRef.current?.(reason);
    };

    const frame = (now: number) => {
      raf = 0;
      if (stopped || document.hidden) return;
      if (lastTick) {
        const gap = now - lastTick;
        slowFrames = gap > SLOW_FRAME_MS ? slowFrames + 1 : 0;
        if (slowFrames >= SLOW_FRAMES_TO_FREEZE) {
          freeze('frozen');
          return;
        }
      }
      lastTick = now;
      if (!lastRender || now - lastRender >= minFrameMs) {
        const dt = lastRender ? Math.min(0.05, Math.max(0.0005, (now - lastRender) / 1000)) : 1 / 60;
        lastRender = now;
        state.time += dt;
        state.gloss += dt * (starSpeed / 10);
        state.depth += dt * (starSpeed / 10) * speed;
        state.angle += dt * rotationSpeed;
        render();
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && !stopped && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
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

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    resize();
    wake();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteProgram(linked.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [starColors, density, layers, starSpeed, speed, rotationSpeed, glowIntensity, twinkleIntensity, starSize, flareIntensity, dpr, frameRateCap]);

  return <canvas ref={canvasRef} className={`galaxy-canvas ${className}`.trim()} aria-hidden="true" />;
};

export default Galaxy;
