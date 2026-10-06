'use client';
import { useEffect, useRef, useState } from 'react';

/** Animações desligadas pelo utilizador (opção do rodapé) ou pelo sistema ("reduzir movimento"). */
export function motionOff() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Valor que desliza até ao novo número em vez de saltar. */
function useTween(value: number, ms = 800) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (motionOff()) {
      current.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = from + (value - from) * (1 - Math.pow(1 - k, 3));
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Número animado que brilha por instantes quando o valor oficial muda. */
export function Numero({ value, format, className = '' }: { value: number; format: (n: number) => string; className?: string }) {
  const shown = useTween(value);
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (motionOff()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [value]);
  return <span className={`num ${flash ? 'flash' : ''} ${className}`}>{format(shown)}</span>;
}
