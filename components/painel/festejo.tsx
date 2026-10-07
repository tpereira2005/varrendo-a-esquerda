'use client';
import { useEffect, useRef, useState } from 'react';
import type { Cand } from '@/lib/types';
import { int, pct } from './format';
import { fanfare } from './efeitos';

const COLORS = ['#009c3b', '#ffdf00', '#ffffff', '#3b82f6', '#ffd43b'];

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; rocket?: boolean };

/** Fogo de artifício e confetes num canvas que ocupa o ecrã todo. */
function Fogo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    const parts: P[] = [];
    const confetti = Array.from({ length: Math.round(Math.min(180, w / 6)) }, () => ({
      x: Math.random() * w, y: Math.random() * -h, s: 6 + Math.random() * 6,
      v: 1.2 + Math.random() * 2.2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.2,
      c: COLORS[Math.floor(Math.random() * 3)],
    }));
    const launch = () => {
      parts.push({
        x: w * (0.15 + Math.random() * 0.7), y: h, vx: (Math.random() - 0.5) * 2,
        vy: -(h / 70 + Math.random() * (h / 160)), life: 0, max: 200, rocket: true,
        color: COLORS[Math.floor(Math.random() * COLORS.length)], size: 3,
      });
    };
    let last = 0;
    let raf = 0;
    const frame = (t: number) => {
      if (t - last > 520) {
        launch();
        if (Math.random() < 0.4) launch();
        last = t;
      }
      g.clearRect(0, 0, w, h);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.rocket ? 0.12 : 0.05;
        if (!p.rocket) {
          p.vx *= 0.985;
          p.vy *= 0.985;
        }
        p.life++;
        if (p.rocket && p.vy >= -0.5) {
          parts.splice(i, 1);
          const n = 60 + Math.floor(Math.random() * 40);
          const speed = 2.5 + Math.random() * 3;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const s = speed * (0.6 + Math.random() * 0.4);
            parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 60 + Math.random() * 40, color: p.color, size: 2.2 });
          }
          continue;
        }
        if (p.life > p.max) {
          parts.splice(i, 1);
          continue;
        }
        g.globalAlpha = p.rocket ? 1 : Math.max(0, 1 - p.life / p.max);
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (const c of confetti) {
        c.y += c.v;
        c.x += Math.sin(c.y / 40) * 0.6;
        c.r += c.vr;
        if (c.y > h + 20) {
          c.y = -20;
          c.x = Math.random() * w;
        }
        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.r);
        g.fillStyle = c.c;
        g.fillRect(-c.s / 2, -c.s / 3, c.s, c.s / 1.5);
        g.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="festejo-canvas" aria-hidden="true" />;
}

/** Festejo em ecrã inteiro quando o TSE declara o Flávio eleito. */
export function Festejo({ winner, other, sound, onClose, onShare }: { winner: Cand; other: Cand; sound: boolean; onClose: () => void; onShare?: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);

  useEffect(() => {
    close.current?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanFull(!!document.fullscreenEnabled);
    if (sound) void fanfare();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const fs = () => setFull(!!document.fullscreenElement);
    addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fs);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, [onClose, sound]);

  return (
    <div className="festejo" role="dialog" aria-modal="true" aria-labelledby="festejo-titulo">
      <Fogo />
      <div className="festejo-conteudo">
        <div className="festejo-retrato">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/candidatos/flavio-720.webp" alt="Flávio Bolsonaro" className="festejo-foto" width={300} height={300} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/emoji/humor-10.png" alt="Boneco: Giga Chad" className="festejo-boneco" width={110} height={110} />
        </div>
        <p className="festejo-sobre">Resultado oficial do TSE</p>
        <h1 id="festejo-titulo" className="festejo-titulo">
          FLÁVIO BOLSONARO
          <span>ELEITO PRESIDENTE DO BRASIL!</span>
        </h1>
        <p className="festejo-numeros">
          {pct(winner.pct, 2)} · {int(winner.votes)} votos
          <br />
          <small>
            {int(winner.votes - other.votes)} votos à frente do Lula ({pct(other.pct, 2)})
          </small>
        </p>
        <p className="festejo-varrida">A esquerda foi varrida! 🧹</p>
        <div className="festejo-botoes">
          {canFull && (
            <button className="btn" onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
              {full ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}
            </button>
          )}
          <button className="btn" onClick={() => void fanfare()}>Tocar fanfarra</button>
          {onShare && (
            <button className="btn" onClick={onShare}>
              Partilhar a vitória
            </button>
          )}
          <button ref={close} className="btn btn-forte" onClick={onClose}>
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}
