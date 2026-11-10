'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';

/* Magic UI · Blur Fade：进入视口时从模糊 + 轻微下移淡入。
   每个章节的开头与列表用一次即可，不叠加其它入场。 */

export function BlurFade({
  children,
  delay = 0,
  y = 14,
  blur = 6,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  blur?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px -8% 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, filter: `blur(${blur}px)` }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
