"use client";

import { useCallback, useEffect, useRef } from "react";

const PARTICLE_COUNT = 80;
const CONNECT_DIST = 140;
const MOUSE_DIST = 200;
const R = 0;
const G = 64;
const B = 231;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

export function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const particles = useRef<Particle[]>([]);
  const raf = useRef(0);
  const size = useRef({ w: 0, h: 0 });

  const seed = useCallback((w: number, h: number) => {
    const p: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      p.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.8 + 0.8,
        opacity: Math.random() * 0.3 + 0.15,
      });
    }
    particles.current = p;
  }, []);

  const draw = useCallback(function drawFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = size.current;
    ctx.clearRect(0, 0, w, h);
    const pts = particles.current.map((particle) => {
      let x = particle.x + particle.vx;
      let y = particle.y + particle.vy;
      let vx = particle.vx;
      let vy = particle.vy;

      if (x < 0 || x > w) vx *= -1;
      if (y < 0 || y > h) vy *= -1;
      x = Math.min(Math.max(x, 0), w);
      y = Math.min(Math.max(y, 0), h);

      return { ...particle, x, y, vx, vy };
    });
    particles.current = pts;

    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${R},${G},${B},${p.opacity})`;
      ctx.fill();
    }

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.12;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      const mdx = pts[i].x - mouse.current.x;
      const mdy = pts[i].y - mouse.current.y;
      const mdist = Math.hypot(mdx, mdy);
      if (mdist < MOUSE_DIST) {
        const alpha = (1 - mdist / MOUSE_DIST) * 0.2;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(mouse.current.x, mouse.current.y);
        ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    raf.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = parent;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, h };
      seed(w, h);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      mouse.current = { x: -1000, y: -1000 };
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [draw, seed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}
