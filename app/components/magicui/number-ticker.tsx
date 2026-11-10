'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';

/* Magic UI · Number Ticker：进入视口后数字从 0 滚到目标值。
   直接写 textContent，不触发 React 重渲染。 */

export function NumberTicker({
  value,
  decimals = 0,
  className,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 28, stiffness: 110 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (!ref.current) return;
      const formatted = latest.toFixed(decimals);
      ref.current.textContent = Number(formatted).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    });
    return unsubscribe;
  }, [spring, decimals]);

  return (
    <span className={className}>
      <span ref={ref}>0</span>
      {suffix}
    </span>
  );
}
