'use client';
// ============================================================
// CRIMESCOPE AI — Animated Value Hook
// ============================================================

import { useState, useEffect, useRef } from 'react';

export default function useAnimatedValue(targetValue, duration = 800) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (targetValue === undefined || targetValue === null) return;

    const startVal = startValueRef.current;
    const diff = targetValue - startVal;

    if (diff === 0) return;

    startTimeRef.current = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * eased);

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startValueRef.current = targetValue;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetValue, duration]);

  return displayValue;
}
