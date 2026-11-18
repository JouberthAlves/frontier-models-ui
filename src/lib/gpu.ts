import { useSyncExternalStore } from 'react';

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|software|microsoft basic render/i;

let cached: boolean | null = null;

/**
 * True only with a real GPU: WebGL2 available, no software renderer, and a context created
 * with `failIfMajorPerformanceCaveat: true`. Result is cached.
 */
export function hasGpu(): boolean {
  if (cached !== null) return cached;
  cached = false;
  if (typeof document === 'undefined') return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return cached;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');
    cached = !SOFTWARE_RENDERERS.test(renderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/* ---------- background status (Galaxy on / off) ---------- */
// "off" = the Galaxy could not start, was frozen by the watchdog, or lost its context.
let galaxyOff = false;
const listeners = new Set<() => void>();

export function reportGalaxyOff(): void {
  if (galaxyOff) return;
  galaxyOff = true;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useGalaxyOff(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => galaxyOff,
    () => false
  );
}
