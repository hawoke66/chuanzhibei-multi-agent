'use client';

/* Magic UI · Animated Gradient Text：标题文字用缓慢流动的渐变填充。
   深色版：白 → 紫 → 白，只在章节标题上用。 */

export function AnimatedGradientText({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`animate-[gradientShift_9s_linear_infinite] bg-[linear-gradient(90deg,var(--ink)_0%,#a99bf5_35%,#e9edfa_55%,#a99bf5_75%,var(--ink)_100%)] bg-[length:200%_auto] bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}
