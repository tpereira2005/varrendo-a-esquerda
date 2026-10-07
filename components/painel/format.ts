// Formatação em português de Portugal e horas de Lisboa/Brasília (sempre por fuso com nome).

const intFmt = new Intl.NumberFormat('pt-PT');
export const int = (n: number | null | undefined) => (n == null ? '—' : intFmt.format(n));

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n) + '%';

export const pp = (n: number, digits = 1) =>
  (n > 0 ? '+' : n < 0 ? '−' : '') +
  new Intl.NumberFormat('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n)) +
  ' pp';

/** 1 234 567 -> "1,23 M"; abaixo de 100 mil mostra o número completo. */
export function compact(n: number) {
  if (Math.abs(n) < 100_000) return int(n);
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(n / 1_000_000) + ' M';
}

const clock = (tz: string, seconds = false) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });
const lisbon = clock('Europe/Lisbon');
const brasilia = clock('America/Sao_Paulo');
const lisbonSec = clock('Europe/Lisbon', true);

export const timeLisbon = (t: number | null | undefined, seconds = false) => (t ? (seconds ? lisbonSec : lisbon).format(t) : '—');
export const timeBrasilia = (t: number | null | undefined) => (t ? brasilia.format(t) : '—');

export function ago(t: number | null | undefined, now: number) {
  if (!t) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h} h ${m % 60} min`;
}

export function countdown(target: number, now: number) {
  let s = Math.max(0, Math.round((target - now) / 1000));
  const d = Math.floor(s / 86_400);
  s -= d * 86_400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  return d > 0 ? `${d} d ${h} h ${m} min` : h > 0 ? `${h} h ${m} min` : `${m} min ${s % 60} s`;
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_m, sp: string, l: string) => sp + l.toUpperCase())
    .replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());
}

export const FLAVIO = '22';
/** "Flávio"/"Lula" na Presidência; nome do boletim nos governadores. */
export const shortName = (c: { number: string; name: string }, cargo: number) =>
  cargo === 1 && c.number === FLAVIO ? 'Flávio' : cargo === 1 && c.number === '13' ? 'Lula' : titleCase(c.name);

/** Retratos dos dois finalistas, pelo número (um finalista substituído pelo TSE fica só com o número). */
const RETRATOS: Record<string, string> = { '22': '/candidatos/flavio', '13': '/candidatos/lula' };
// ?v=: muda quando uma foto é substituída, para os browsers não mostrarem a antiga guardada em cache.
export const retrato = (number: string, size: 256 | 720 = 256) => (RETRATOS[number] ? `${RETRATOS[number]}-${size}.webp?v=2` : null);
