'use client';

import { useEffect, useRef } from 'react';

// ===== 动效可调参数（全部集中于此，微调只改这里）=====
// 星星数量：桌面 500 / 移动端（宽度 <768px）250；帧率不足自动减半，保底 125
const STAR_COUNT_DESKTOP = 500;
const STAR_COUNT_MOBILE = 250;
const MOBILE_BREAKPOINT = 768;
const MIN_STARS = 125;
const MAX_HALVINGS = 2;
const FPS_CHECK_FRAMES = 120;
const FPS_THRESHOLD = 28;
// 星星外观：半径 / 基准亮度 / 亮星比例与光晕
const STAR_RADIUS_MIN = 0.8;
const STAR_RADIUS_MAX = 2.5;
const STAR_ALPHA_MIN = 0.35;
const STAR_ALPHA_MAX = 0.85;
const STAR_BRIGHT_RATIO = 0.25;
const STAR_GLOW_RADIUS_TIMES = 3.5;
const STAR_GLOW_ALPHA = 0.2;
// 星星闪烁：速度与幅度（深度 0.75 表示最暗时降到基准亮度的 25%）
const STAR_TWINKLE_SPEED_MIN = 0.5;
const STAR_TWINKLE_SPEED_MAX = 1.6;
const STAR_TWINKLE_DEPTH = 0.75;
// 流星：间隔 / 速度 / 寿命 / 拖尾长度 / 亮度
const METEOR_MIN_INTERVAL_MS = 8_000;
const METEOR_MAX_INTERVAL_MS = 15_000;
const METEOR_SPEED_MIN = 430;
const METEOR_SPEED_MAX = 690;
const METEOR_LIFE_MIN = 0.9;
const METEOR_LIFE_MAX = 1.4;
const METEOR_LEN_MIN = 140;
const METEOR_LEN_MAX = 220;
const METEOR_ALPHA = 1.0;
const METEOR_WIDTH = 2;

const STAR_COLORS = ['210, 220, 255', '225, 210, 255', '255, 255, 255'];

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
  speed: number;
  color: string;
  glow: boolean;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
}

export default function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // 别名带非空类型：提升的 function 声明不会继承外层收窄
    const cv: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let raf = 0;
    let running = false;
    let lastTime = 0;
    let meteor: Meteor | null = null;
    let nextMeteorAt = 0;
    let frameCount = 0;
    let fpsWindowStart = 0;
    let halvings = 0;

    function buildStars(count: number) {
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: STAR_RADIUS_MIN + Math.random() * (STAR_RADIUS_MAX - STAR_RADIUS_MIN),
        baseAlpha: STAR_ALPHA_MIN + Math.random() * (STAR_ALPHA_MAX - STAR_ALPHA_MIN),
        phase: Math.random() * Math.PI * 2,
        speed: STAR_TWINKLE_SPEED_MIN + Math.random() * (STAR_TWINKLE_SPEED_MAX - STAR_TWINKLE_SPEED_MIN),
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        glow: Math.random() < STAR_BRIGHT_RATIO,
      }));
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      cv.width = Math.max(1, Math.round(width * dpr));
      cv.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars(stars.length || (width < MOBILE_BREAKPOINT ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP));
    }

    function spawnMeteor() {
      const speed = METEOR_SPEED_MIN + Math.random() * (METEOR_SPEED_MAX - METEOR_SPEED_MIN);
      meteor = {
        x: width * (0.25 + Math.random() * 0.65),
        y: height * (0.05 + Math.random() * 0.3),
        vx: -speed * (0.75 + Math.random() * 0.25),
        vy: speed * (0.55 + Math.random() * 0.3),
        life: 0,
        maxLife: METEOR_LIFE_MIN + Math.random() * (METEOR_LIFE_MAX - METEOR_LIFE_MIN),
        len: METEOR_LEN_MIN + Math.random() * (METEOR_LEN_MAX - METEOR_LEN_MIN),
      };
    }

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      for (const s of stars) {
        s.phase += s.speed * dt;
        const wave = 0.5 + 0.5 * Math.sin(s.phase);
        const alpha = s.baseAlpha * (1 - STAR_TWINKLE_DEPTH + STAR_TWINKLE_DEPTH * wave);
        if (alpha <= 0.02) continue;
        if (s.glow) {
          const glowR = s.r * STAR_GLOW_RADIUS_TIMES;
          const g = context.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          g.addColorStop(0, `rgba(${s.color}, ${(alpha * STAR_GLOW_ALPHA).toFixed(3)})`);
          g.addColorStop(1, `rgba(${s.color}, 0)`);
          context.fillStyle = g;
          context.beginPath();
          context.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          context.fill();
        }
        context.beginPath();
        context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${s.color}, ${Math.min(1, alpha).toFixed(3)})`;
        context.fill();
      }

      if (!meteor && now >= nextMeteorAt) spawnMeteor();
      if (meteor) {
        meteor.life += dt;
        const t = meteor.life / meteor.maxLife;
        if (t >= 1) {
          meteor = null;
          nextMeteorAt = now + METEOR_MIN_INTERVAL_MS + Math.random() * (METEOR_MAX_INTERVAL_MS - METEOR_MIN_INTERVAL_MS);
        } else {
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const alpha = Math.sin(Math.PI * t) * METEOR_ALPHA;
          const speed = Math.hypot(meteor.vx, meteor.vy);
          const tx = meteor.x - (meteor.vx / speed) * meteor.len;
          const ty = meteor.y - (meteor.vy / speed) * meteor.len;
          const grad = context.createLinearGradient(meteor.x, meteor.y, tx, ty);
          grad.addColorStop(0, `rgba(240, 244, 255, ${alpha.toFixed(3)})`);
          grad.addColorStop(1, 'rgba(240, 244, 255, 0)');
          context.strokeStyle = grad;
          context.lineWidth = METEOR_WIDTH;
          context.beginPath();
          context.moveTo(meteor.x, meteor.y);
          context.lineTo(tx, ty);
          context.stroke();
          context.beginPath();
          context.arc(meteor.x, meteor.y, METEOR_WIDTH, 0, Math.PI * 2);
          context.fillStyle = `rgba(240, 244, 255, ${alpha.toFixed(3)})`;
          context.fill();
        }
      }

      frameCount += 1;
      if (frameCount >= FPS_CHECK_FRAMES) {
        const fps = frameCount / ((now - fpsWindowStart) / 1000);
        if (fps < FPS_THRESHOLD && halvings < MAX_HALVINGS && stars.length > MIN_STARS) {
          buildStars(Math.max(Math.floor(stars.length / 2), MIN_STARS));
          halvings += 1;
        }
        frameCount = 0;
        fpsWindowStart = now;
      }

      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      fpsWindowStart = lastTime;
      nextMeteorAt = lastTime + METEOR_MIN_INTERVAL_MS + Math.random() * (METEOR_MAX_INTERVAL_MS - METEOR_MIN_INTERVAL_MS);
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      context.clearRect(0, 0, width, height);
    }

    function onReducedMotionChange() {
      if (reducedMotion.matches) stop();
      else start();
    }

    resize();
    window.addEventListener('resize', resize);
    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener('change', onReducedMotionChange);
    }
    if (!reducedMotion.matches) start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      if (reducedMotion.removeEventListener) {
        reducedMotion.removeEventListener('change', onReducedMotionChange);
      }
    };
  }, []);

  return (
    <>
      <div className="bg-base" aria-hidden="true" />
      <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />
    </>
  );
}
