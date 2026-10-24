export const institutoId = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function recentesPorInstituto(polls, days, now = Date.now()) {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Janela de sondagens inválida');
  const today = Math.floor(now / 86400000) * 86400000;
  const since = today - (days - 1) * 86400000;
  const latest = new Map();
  for (const p of polls) {
    const end = Date.parse(p.fim);
    if (!Number.isFinite(end) || end < since || end > today || !(p.quota > 0 && p.quota < 100)) continue;
    const key = institutoId(p.instituto);
    if (!latest.has(key) || end > Date.parse(latest.get(key).fim)) latest.set(key, p);
  }
  if (!latest.size) throw new Error('Sem sondagens recentes; não atualizar a previsão');
  return [...latest.values()];
}
