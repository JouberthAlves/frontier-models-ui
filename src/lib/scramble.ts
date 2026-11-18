import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/';
const isSpace = (char: string) => /\s/.test(char);

/**
 * "Decrypt" hover (spec-v2 §7, option D3): the letters scramble and resolve from left to right,
 * 35 ms per step, 2 steps per letter. `shown` is null at rest. Only runs with motion enabled
 * and, unless `play(true)` asks for it (a reveal that is not a hover), on devices with hover.
 */
export function useScramble(text: string, speed = 35, stepsPerChar = 2) {
  const [frame, setFrame] = useState<{ text: string; shown: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const play = useCallback((anyDevice = false) => {
    if (prefersReducedMotion() || (!anyDevice && !window.matchMedia?.('(hover: hover)').matches)) return;
    clearInterval(timer.current);
    const letters = Array.from(text);
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      const solved = step / stepsPerChar;
      if (solved >= letters.length) {
        clearInterval(timer.current);
        setFrame(null);
        return;
      }
      setFrame({
        text,
        shown: letters.map((char, index) =>
          isSpace(char) || index < solved ? char : CHARSET.charAt(Math.floor(Math.random() * CHARSET.length))
        )
      });
    }, Math.max(16, speed));
  }, [text, speed, stepsPerChar]);

  useEffect(() => () => clearInterval(timer.current), []);

  return { shown: frame && frame.text === text ? frame.shown : null, play };
}
