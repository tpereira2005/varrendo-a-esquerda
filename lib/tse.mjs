// Leitura dos ficheiros unificados do TSE (formato EA20), partilhada pela 1.ª e 2.ª voltas.

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const UF_NAMES = {
  BR: 'Brasil', AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba',
  PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe',
  SP: 'São Paulo', TO: 'Tocantins', ZZ: 'Estrangeiro',
};

export const TSE_BASE = 'https://resultados.tse.jus.br';
export const CONFIG_PATH = '/oficial/comum/config/ele-c.json';

export function resultUrl({ base = TSE_BASE, cycle, ele, uf, cargo }) {
  const u = uf.toLowerCase();
  const c = String(cargo).padStart(4, '0');
  const e = String(ele).padStart(6, '0');
  return `${base}/oficial/${cycle}/${ele}/dados/${u}/${u}-c${c}-e${e}-u.json`;
}

/** "1.234" | "1234" -> 1234; devolve null se não for um inteiro válido. */
export function int(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/\./g, ''));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** "47,03" -> 47.03 (percentagem, 0–100); null se inválida. */
export function pct(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** Data e hora oficiais do TSE (hora de Brasília, UTC−3, sem horário de verão) -> epoch ms. */
export function officialTime(date, time) {
  const m = String(date ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m || !/^\d{2}:\d{2}:\d{2}$/.test(String(time ?? ''))) return null;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T${time}-03:00`);
  return Number.isFinite(t) ? t : null;
}

/** Todos os candidatos de um cargo, com o partido do nó que os contém. */
export function candidatesOf(json, cargo) {
  const node = (json?.carg ?? []).find((c) => Number(c.cd) === Number(cargo));
  if (!node) return null;
  const out = [];
  for (const agr of node.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        out.push({
          number: String(c.n ?? '').trim(),
          name: String(c.nmu || c.nm || '').trim(),
          party: String(par.sg ?? '').trim(),
          votes: int(c.vap),
          pct: pct(c.pvap),
          st: String(c.st ?? '').trim(),
          valid: !/anulad|nulo/i.test(String(c.dvt ?? '')),
        });
      }
    }
  }
  return out;
}

/** Comparecimento, abstenção, brancos e nulos. */
export function turnoutOf(json) {
  const e = json?.e ?? {};
  const v = json?.v ?? {};
  return {
    eleitores: int(e.te),
    comparecimento: int(e.c),
    abstencao: int(e.a),
    abstencaoPct: pct(e.pa),
    validos: int(v.vv),
    brancos: int(v.vb),
    nulos: int(v.tvn),
  };
}

/** Só o estado "Eleito"/"Eleita" do TSE conta. Atenção: na 1.ª volta o TSE marca e="s" nos finalistas. */
export function isElected(st) {
  return /^eleit[oa]\b/i.test(st) && !/n[ãa]o eleit/i.test(st);
}
