'use client';

import { useRef, useState } from 'react';

/* Magic UI · Magic Card：鼠标位置跟随的辉光卡片。
   深色版：白色磨砂底 + 紫蓝径向辉光，辉光只在 hover 时出现。 */

export function MagicCard({
  children,
  className = '',
  glowColor = '169, 155, 245',
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-colors duration-300 ease-out-soft hover:border-white/20 ${className}`}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out-soft"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, rgba(${glowColor}, 0.16), transparent 72%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
