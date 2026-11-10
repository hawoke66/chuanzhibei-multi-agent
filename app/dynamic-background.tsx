'use client';

import { useEffect, useRef } from 'react';

/* ============================================================
   动态星空（背景层，不属于任何交互）
   分层星点 + 斜向银河带 + 三组星座连线 + 左下小行星 + 右上流星。
   只画像素，不碰 top/left/width/height；减少动效时只画一帧静态星空。
   ============================================================ */

const MAX_DPR = 2;
const MOBILE_BREAKPOINT = 768;
const BAND_ANGLE = (-28 * Math.PI) / 180;

const STAR_TINTS = ['210, 222, 255', '255, 255, 255', '255, 234, 204', '198, 214, 255'] as const;
const LINE_RGB = '198, 212, 255';

// 流星：每 14 到 26 秒一颗，从右上往左下
const METEOR_MIN_MS = 8_000;
const METEOR_MAX_MS = 15_000;

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  phase: number;
  speed: number;
  tint: number;
  drift: number;
  depth: number;
  glow: boolean;
}

interface BandDot {
  x: number;
  y: number;
  r: number;
  base: number;
  phase: number;
  speed: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  len: number;
}

interface Point {
  x: number;
  y: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// 四组归一化星座骨架（相对屏幕，只用来画连线，不带任何界面含义）
const CONSTELLATION_PATTERNS: number[][][] = [
  [
    [0.1, 0.16],
    [0.16, 0.22],
    [0.13, 0.3],
    [0.21, 0.26],
    [0.19, 0.34],
  ],
  [
    [0.78, 0.1],
    [0.84, 0.16],
    [0.81, 0.24],
  ],
  [
    [0.62, 0.68],
    [0.68, 0.72],
    [0.66, 0.79],
  ],
];

export default function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const galaxyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const cv: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;

    // 视差：鼠标分层错开 3 到 5px，滚动时银河层缓慢上移
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
    let scrollOffset = 0;

    function onPointerMove(event: PointerEvent) {
      if (width === 0 || height === 0) return;
      pointer.tx = (event.clientX / width - 0.5) * 2;
      pointer.ty = (event.clientY / height - 0.5) * 2;
    }

    function onScroll() {
      scrollOffset = window.scrollY;
    }

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let band: BandDot[] = [];
    let constellations: Point[][] = [];
    let meteor: Meteor | null = null;
    let nextMeteorAt = 0;
    let raf = 0;
    let running = false;
    let resizeTimer: number | null = null;

    function build() {
      const mobile = width < MOBILE_BREAKPOINT;
      stars = [];

      const layer = (
        count: number,
        rMin: number,
        rMax: number,
        aMin: number,
        aMax: number,
        drift: number,
        depth: number,
        glowRatio: number,
      ) => {
        for (let i = 0; i < count; i += 1) {
          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: rand(rMin, rMax),
            base: rand(aMin, aMax),
            phase: Math.random() * Math.PI * 2,
            speed: rand(0.35, 1.4),
            tint: Math.floor(Math.random() * STAR_TINTS.length),
            drift,
            depth,
            glow: Math.random() < glowRatio,
          });
        }
      };

      // 远、中、近三层：越近越大越亮，漂移越快
      layer(mobile ? 170 : 300, 0.4, 0.9, 0.14, 0.38, 1.2, 1, 0);
      layer(mobile ? 90 : 150, 0.9, 1.5, 0.3, 0.62, 2.1, 2, 0.12);
      layer(mobile ? 24 : 38, 1.5, 2.3, 0.5, 0.9, 3.2, 3, 0.45);

      // 银河带：沿斜线撒的密集微星，不用渐变色块
      band = [];
      const bandCount = mobile ? 360 : 720;
      const cx = width * 0.56;
      const cy = height * 0.4;
      const span = Math.hypot(width, height) * 0.8;
      const bandWidth = mobile ? 90 : 150;
      for (let i = 0; i < bandCount; i += 1) {
        const along = rand(-0.5, 0.5);
        const gauss = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
        const across = gauss * bandWidth;
        band.push({
          x: cx + Math.cos(BAND_ANGLE) * along * span - Math.sin(BAND_ANGLE) * across,
          y: cy + Math.sin(BAND_ANGLE) * along * span + Math.cos(BAND_ANGLE) * across,
          r: rand(0.3, 1),
          base: rand(0.05, 0.2),
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.2, 0.6),
        });
      }

      const unit = Math.min(width, height);
      constellations = CONSTELLATION_PATTERNS.map((group) =>
        group.map(([nx, ny]) => ({ x: nx * width, y: ny * height - unit * 0.02 })),
      );
    }

    function drawAsteroid() {
      // 左下角一颗小行星：暗面 + 一圈边缘光 + 两个坑。
      // 只出现在首屏左下的空档里，不被任务输入面板压住；窄屏不画。
      if (width < MOBILE_BREAKPOINT) return;
      const radius = Math.min(width, height) * 0.016;
      const cx = radius * 3.2;
      const cy = height * 0.86;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.35);
      ctx.beginPath();
      for (let i = 0; i <= 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        const wobble = 1 + (i % 3 === 0 ? 0.07 : -0.035);
        const px = Math.cos(angle) * radius * wobble;
        const py = Math.sin(angle) * radius * wobble;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 22, 36, 0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(198, 212, 255, 0.4)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // 朝向光的一侧补一条内缘高光，让它读起来是块石头而不是一个圈
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.82, Math.PI * 1.05, Math.PI * 1.75);
      ctx.strokeStyle = 'rgba(198, 212, 255, 0.22)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-radius * 0.28, -radius * 0.2, radius * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(198, 212, 255, 0.08)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(radius * 0.3, radius * 0.22, radius * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(198, 212, 255, 0.06)';
      ctx.fill();
      ctx.restore();
    }

    function draw(now: number) {
      if (width === 0 || height === 0) return;
      // 正常滚动，没有翻页过渡，星空始终按自身节奏闪烁与视差
      const t = reduced ? 0 : now / 1000;

      const motionScale = width < MOBILE_BREAKPOINT ? 0.5 : 1;
      const targetX = reduced ? 0 : pointer.tx;
      const targetY = reduced ? 0 : pointer.ty;
      pointer.x += (targetX - pointer.x) * 0.07;
      pointer.y += (targetY - pointer.y) * 0.07;

      const galaxy = galaxyRef.current;
      if (galaxy) {
        const drift = reduced ? 0 : Math.sin(t * 0.05) * 7;
        const offsetX = reduced ? 0 : pointer.x * 9 * motionScale;
        // 滚动视差必须夹住：银河层只有视口高 + 外扩，位移过大会把照片底部滑出屏幕，
        // 页脚那一段就只剩 canvas 星点，看起来像星空断了。
        const parallaxScroll = Math.min(scrollOffset * 0.09, 96);
        const offsetY = reduced ? 0 : -parallaxScroll + pointer.y * 7 * motionScale + drift;
        galaxy.style.transform = `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) scale(1.09)`;
      }

      ctx.clearRect(0, 0, width, height);

      // 银河带
      for (const d of band) {
        const twinkle = 0.55 + 0.45 * Math.sin(d.phase + t * d.speed);
        const alpha = d.base * twinkle;
        if (alpha <= 0.012) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(214, 224, 255, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // 星座连线
      ctx.strokeStyle = `rgba(${LINE_RGB}, 0.15)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const group of constellations) {
        group.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.moveTo(group[group.length - 1].x, group[group.length - 1].y);
        ctx.lineTo(group[0].x, group[0].y);
      }
      ctx.stroke();
      for (const group of constellations) {
        for (const p of group) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${LINE_RGB}, 0.5)`;
          ctx.fill();
        }
      }

      // 星点
      const span = width + 40;
      for (const s of stars) {
        const parallaxX = reduced ? 0 : pointer.x * s.depth * 2.5 * motionScale;
        const parallaxY = reduced ? 0 : (pointer.y * s.depth * 2 - Math.min(scrollOffset * 0.02, 24) * s.depth) * motionScale;
        const drift = (s.x + s.drift * t + parallaxX) % span;
        const x = drift < 0 ? drift + span : drift;
        const y = s.y + parallaxY;
        const twinkle = 0.5 + 0.5 * Math.sin(s.phase + t * s.speed);
        const alpha = s.base * (0.45 + 0.55 * twinkle);
        if (alpha <= 0.015) continue;
        const tint = STAR_TINTS[s.tint];
        if (s.glow) {
          const halo = s.r * 4;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
          gradient.addColorStop(0, `rgba(${tint}, ${(alpha * 0.16).toFixed(3)})`);
          gradient.addColorStop(1, `rgba(${tint}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, halo, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      drawAsteroid();

      // 流星：右上角起，往左下划，只出现一瞬
      if (!reduced) {
        if (!meteor && now >= nextMeteorAt) {
          const speed = rand(520, 760);
          meteor = {
            x: width * rand(0.62, 0.95),
            y: height * rand(0.04, 0.18),
            vx: -speed * rand(0.72, 0.9),
            vy: speed * rand(0.45, 0.62),
            life: 0,
            max: rand(0.9, 1.4),
            len: rand(120, 200),
          };
        }
        if (meteor) {
          meteor.life += 1 / 60;
          const progress = meteor.life / meteor.max;
          if (progress >= 1) {
            meteor = null;
            nextMeteorAt = now + rand(METEOR_MIN_MS, METEOR_MAX_MS);
          } else {
            meteor.x += meteor.vx * (1 / 60);
            meteor.y += meteor.vy * (1 / 60);
            const alpha = Math.sin(Math.PI * progress);
            const length = Math.hypot(meteor.vx, meteor.vy);
            const tailX = meteor.x - (meteor.vx / length) * meteor.len;
            const tailY = meteor.y - (meteor.vy / length) * meteor.len;
            const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
            trail.addColorStop(0, `rgba(236, 241, 255, ${(alpha * 0.9).toFixed(3)})`);
            trail.addColorStop(1, 'rgba(236, 241, 255, 0)');
            ctx.strokeStyle = trail;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(meteor.x, meteor.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(meteor.x, meteor.y, 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(236, 241, 255, ${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }
      }
    }

    function frame(now: number) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      nextMeteorAt = performance.now() + rand(METEOR_MIN_MS, METEOR_MAX_MS);
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      cv.width = Math.max(1, Math.round(width * dpr));
      cv.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduced) draw(0);
    }

    function onResize() {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 160);
    }

    function onMotionChange() {
      reduced = motionQuery.matches;
      if (reduced) {
        stop();
        draw(0);
      } else {
        start();
      }
    }

    resize();
    if (reduced) draw(0);
    else start();

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    scrollOffset = window.scrollY;
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      stop();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <>
      <div ref={galaxyRef} className="bg-galaxy" aria-hidden="true" />
      <canvas ref={canvasRef} className="bg-stars" aria-hidden="true" />
    </>
  );
}
