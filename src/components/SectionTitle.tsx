import { useCallback, useRef } from 'react';
import StrokeText from './bits/StrokeText';
import './SectionTitle.css';

interface SectionTitleProps {
  id: string;
  text: string;
  strokeColor: string;
  fill?: string;
}

/**
 * h2 with the real text for assistive tech and a StrokeText in scroll mode (stroke 1.2 s,
 * stagger 30 ms, then a 500 ms fill fade). Font size shrinks to fit narrow screens.
 */
export default function SectionTitle({ id, text, strokeColor, fill = 'var(--ink)' }: SectionTitleProps) {
  const artRef = useRef<HTMLSpanElement>(null);
  const onMeasure = useCallback((widestEm: number) => {
    artRef.current?.style.setProperty('--title-wem', widestEm.toFixed(3));
  }, []);

  return (
    <h2 id={id} className="section-title section-title--stroke">
      <span className="sr-only">{text}</span>
      <span ref={artRef} className="section-title__art" aria-hidden="true">
        <StrokeText
          key={text}
          lines={[text]}
          strokeColor={strokeColor}
          fill={fill}
          trigger="scroll"
          drawDuration={1.2}
          stagger={0.03}
          fillMode="fade"
          fillDuration={0.5}
          fillEase="power1.out"
          strokeWidth={5}
          fontWeight={850}
          fontStretch={112}
          letterSpacing={-3}
          onMeasure={onMeasure}
        />
      </span>
    </h2>
  );
}
