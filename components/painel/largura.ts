'use client';
import { useEffect, useRef, useState } from 'react';

/** Largura real de um elemento, para desenhar gráficos SVG com texto legível em qualquer ecrã. */
export function useLargura<T extends Element>(inicial: number) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setLargura(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}
