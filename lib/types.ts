// Forma dos dados devolvidos por snapshot() (lib/collector.mjs) e usados pela página.

export type Group = 'direita' | 'esquerda';

export type Finalist = {
  number: string;
  name: string;
  party: string;
  group: Group;
  r1Votes: number;
  r1Pct: number;
};

export type Turnout = {
  eleitores: number | null;
  comparecimento: number | null;
  abstencao: number | null;
  abstencaoPct: number | null;
  validos: number | null;
  brancos: number | null;
  nulos: number | null;
};

export type Cand = Finalist & { votes: number; pct: number; elected: boolean; st: string };

export type Parsed = {
  key: string;
  uf: string;
  cargo: number;
  generatedAt: number | null;
  pctSections: number;
  final: boolean;
  winner: 0 | 1 | null;
  cands: [Cand, Cand];
  turnout: Turnout;
  warnings: string[];
};

export type Race = {
  key: string;
  uf: string;
  cargo: 1 | 3;
  internal: boolean;
  finalists: [Finalist, Finalist];
  r1: Turnout;
  parsed: Parsed | null;
  meta: { generatedAt: number | null; checkedAt: number | null; successAt: number | null; error: string | null; stale: boolean };
};

export type Notice = {
  id: string;
  key: string;
  kind: 'virada' | 'marco' | 'estado' | 'estado-virou' | 'eleito' | 'projecao';
  uf: string;
  cargo: number;
  tone: 'good' | 'bad' | 'neutral';
  title: string;
  detail: string;
  at?: number;
  winner?: string;
  noticedAt: number;
};

export type Snapshot = {
  serverNow: number;
  phase: 'antes' | 'apuramento' | 'encerrado';
  active: boolean;
  paused: boolean;
  ids: { federal: number; estadual: number; confirmedAt: number | null };
  opensAt: number;
  pollsCloseAt: number;
  national: Race;
  states: Race[];
  governors: Race[];
  exterior: {
    race: Race;
    checkedAt: number;
    countries: ExteriorCountry[];
  };
  score: { flavio: number; lula: number; pending: number };
  toFlip: { trailing: 0 | 1; remaining: number; needPct: number | null; impossible: boolean } | null;
  projection: Projection | null;
  market: Market | null;
  mood: { label: string; src: string };
  timeline: { generatedAt: number; pctSections: number; votesA: number; votesB: number }[];
  events: Notice[];
  corrections: Notice[];
  collector: { refreshedAt: number; pauseUntil: number; lastError: string | null };
};

export type Projection = {
  flavio: number;
  lula: number;
  low: number;
  high: number;
  sd: number;
  probFlavio: number;
  margin: number;
  remaining: number;
  remainingFraction: number;
  /** Ponto de partida nacional (1.ª volta com transferências), % do Flávio. */
  prior: number;
  /** Deslocação nacional já observada face ao ponto de partida (pp, + = Flávio). */
  nationalSwing: number;
  /** Afluência face ao esperado (1 = como previsto). */
  turnout: number;
  /** Tendência nacional da contagem: votos contados primeiro − por contar (pp, + = Flávio). */
  trend: number;
  /** Fração contada nos estados que cada um ganhou na 1.ª volta (0–1). */
  blocs: { flavio: number; lula: number };
  statesFlavio: number;
  statesLula: number;
  perRegion: {
    uf: string;
    remaining: number;
    pctSections: number;
    shareNow: number | null;
    shareRemaining: number;
    finalShare: number;
    /** Probabilidade de o Flávio vencer neste estado (0–1). */
    prob: number;
    netFlavio: number;
  }[];
};

/** Mercado de previsões (Polymarket). Percentagens 0–100; séries em [instante ms, % do Flávio]. */
export type Market = {
  flavio: number;
  lula: number;
  change24h: number;
  volume: number;
  closed: boolean;
  at: number;
  stale: boolean;
  error: string | null;
  recent: [number, number][];
  /** Desde 2 h antes do fecho das urnas da 2.ª volta (vazio antes disso). */
  night: [number, number][];
  campaign: [number, number][];
  marks: { label: string; t: number; p: number }[];
  nightStart: number;
};

export type ExteriorCountry = {
  pais: string;
  flavio: number;
  lula: number;
  sections: number;
  counted: number;
  r1: { flavio: number; lula: number } | null;
  cidades: { cidade: string; flavio: number; lula: number; pctSections: number; has: boolean; r1: { flavio: number; lula: number } | null }[];
};

export type ExteriorArchive = {
  source: string;
  candidates: { number: string; name: string; party: string }[];
  countries: { pais: string; votes: Record<string, number>; cidades: { cd: string; cidade: string; votes: Record<string, number> }[] }[];
};

export type Archive = {
  source: string;
  president: Record<string, { generatedAt: number; pctSections: number; turnout: Turnout; candidates: { number: string; name: string; party: string; votes: number; pct: number; st: string }[] }>;
  governor: Archive['president'];
  exterior: ExteriorArchive;
};
