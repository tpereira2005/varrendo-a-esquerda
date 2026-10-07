// Som e "manter o ecrã ligado".
// Os avisos são sintetizados no browser (sem ficheiros): sinos, metais, "whoosh", rufar, multidão, com um pouco de eco.
// O festejo toca o Hino Nacional Brasileiro (gravação instrumental da Banda da Marinha dos EUA, domínio público,
// public/som/hino-nacional.mp3), só descarregado quando é preciso.
// O browser só deixa tocar som depois de um clique: o primeiro toque na página (com o som ligado) desbloqueia-o.

import type { Notice } from '@/lib/types';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let noise: AudioBuffer | null = null;
let anthem: HTMLAudioElement | null = null;
let volume = 0.8;
const ANTHEM_SRC = '/som/hino-nacional.mp3';

try {
  const v = Number(localStorage.getItem('varrendo.volume'));
  if (localStorage.getItem('varrendo.volume') != null && Number.isFinite(v)) volume = Math.max(0, Math.min(1, v));
} catch {}

export const getVolume = () => volume;

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem('varrendo.volume', String(volume));
  } catch {}
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  if (anthem) anthem.volume = volume;
}

function build() {
  if (!ctx || master) return;
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  // eco: resposta ao impulso gerada (ruído com decaimento de ~1,8 s)
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  reverb.connect(wet).connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const n = noise.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
}

export function unlockAudio() {
  try {
    // iPhone (iOS 17+): tratar os avisos como reprodução, para tocarem mesmo com o interruptor de silêncio
    // (quem liga o "Som" no site quer ouvi-los).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    ctx ??= new AudioContext();
    build();
    if (ctx.state === 'suspended') void ctx.resume();
    // iPhone: um elemento de áudio "tocado" durante um toque pode depois tocar sozinho (o hino do festejo)
    if (!anthem) {
      anthem = new Audio(ANTHEM_SRC);
      anthem.preload = 'none';
      anthem.volume = volume;
      anthem.muted = true;
      void anthem
        .play()
        .then(() => {
          anthem!.pause();
          anthem!.currentTime = 0;
          anthem!.muted = false;
        })
        .catch(() => {
          if (anthem) anthem.muted = false;
        });
    }
  } catch {
    ctx = null;
  }
}

/** Sem um clique prévio na página, o browser mantém o áudio suspenso e não toca nada. */
async function ready() {
  unlockAudio();
  // Sem gesto do utilizador, o Chrome deixa resume() pendente: não esperar por ele (senão o som tocaria mais tarde).
  if (ctx?.state === 'suspended') await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
  return ctx?.state === 'running' && !!master;
}

/** Envia um som para a saída (seco) e para o eco. */
function out(node: AudioNode, echo = true) {
  node.connect(master!);
  if (echo && reverb) node.connect(reverb);
}

function envelope(g: GainNode, t: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Sino: parciais inarmónicos, como um sino pequeno ou uma marimba. */
function bell(freq: number, start: number, dur = 1.2, gain = 0.16) {
  const t = ctx!.currentTime + start;
  for (const [ratio, amp] of [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
  ]) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    envelope(g, t, gain * amp, 0.005, dur / ratio ** 0.4);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

/** Metais: dois dentes de serra ligeiramente desafinados, filtro que abre no ataque e vibrato. */
function brass(freq: number, start: number, dur: number, gain = 0.09) {
  const t = ctx!.currentTime + start;
  const f = ctx!.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(2800, t + 0.08);
  f.frequency.exponentialRampToValueAtTime(1400, t + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
  g.gain.setValueAtTime(gain * 0.8, t + Math.max(0.06, dur - 0.12));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lfo = ctx!.createOscillator();
  const depth = ctx!.createGain();
  lfo.frequency.value = 5.5;
  depth.gain.value = freq * 0.006;
  lfo.connect(depth);
  for (const detune of [-6, 6]) {
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = detune;
    depth.connect(o.frequency);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  f.connect(g);
  out(g);
}

/** Ruído filtrado: whoosh (a subir ou a descer), pratos, multidão. */
function noiseBurst(start: number, dur: number, { type = 'bandpass' as BiquadFilterType, from = 400, to = 3000, q = 1.2, gain = 0.2, attack = 0.05 } = {}) {
  const t = ctx!.currentTime + start;
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx!.createGain();
  envelope(g, t, gain, attack, dur);
  src.connect(f).connect(g);
  out(g);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

/** Trombone triste ("wah wah wah waaah"), para as más notícias. */
function sadTrombone(start = 0) {
  const notes: [number, number, number][] = [
    [233, 0, 0.42],
    [220, 0.45, 0.42],
    [208, 0.9, 0.42],
    [196, 1.35, 1.3],
  ];
  for (const [freq, s, d] of notes) {
    const t = ctx!.currentTime + start + s;
    const f = ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    // o "wah": filtro a abrir e fechar em cada nota
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(1300, t + d * 0.35);
    f.frequency.linearRampToValueAtTime(450, t + d);
    const g = ctx!.createGain();
    envelope(g, t, 0.13, 0.03, d);
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    if (d > 1) {
      const lfo = ctx!.createOscillator();
      const depth = ctx!.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = 5;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t + 0.3);
      lfo.stop(t + d);
    }
    o.connect(f).connect(g);
    out(g);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

export type Som = 'virada-boa' | 'virada-ma' | 'marco' | 'estado-bom' | 'estado-mau' | 'projecao-boa' | 'projecao-ma' | 'neutro';

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** Toca um som de aviso. */
export async function tocar(som: Som) {
  if (!(await ready())) return;
  switch (som) {
    case 'virada-boa':
      noiseBurst(0, 0.45, { from: 300, to: 4000, gain: 0.12, attack: 0.3 });
      for (const f of [C5, E5, G5]) brass(f, 0.4, 0.9);
      bell(C6 * 2, 0.4, 1.4, 0.06);
      break;
    case 'virada-ma':
      sadTrombone();
      break;
    case 'marco':
      bell(1318.5, 0, 0.9, 0.08);
      break;
    case 'estado-bom':
      bell(G5, 0, 1);
      bell(1174.7, 0.13, 1.2);
      break;
    case 'estado-mau':
      bell(440, 0, 1, 0.13);
      bell(349.2, 0.16, 1.3, 0.13);
      break;
    case 'projecao-boa':
      [C5, E5, G5, C6].forEach((f, i) => bell(f, i * 0.11, 1.3, 0.13));
      break;
    case 'projecao-ma':
      [E5, C5, 440].forEach((f, i) => bell(f, i * 0.16, 1.3, 0.12));
      break;
    default:
      bell(880, 0, 1, 0.1);
  }
}

/** Som de um aviso, pelo tipo e por ser bom ou mau para o Flávio. */
export function somDoAviso(e: Pick<Notice, 'kind' | 'tone'>): Som {
  const good = e.tone === 'good';
  if (e.tone === 'neutral') return 'neutro';
  if (e.kind === 'virada' || e.kind === 'estado-virou') return good ? 'virada-boa' : 'virada-ma';
  if (e.kind === 'marco') return 'marco';
  if (e.kind === 'projecao') return good ? 'projecao-boa' : 'projecao-ma';
  return good ? 'estado-bom' : 'estado-mau';
}

/** Vibração no telemóvel (Android; o iPhone não permite), mais forte nos avisos importantes. */
export function vibrar(som: Som | 'festejo') {
  const pattern: Record<string, number[]> = {
    festejo: [200, 100, 200, 100, 600],
    'virada-boa': [100, 60, 100, 60, 250],
    'virada-ma': [400],
    marco: [40],
    'projecao-boa': [80, 50, 80, 50, 80],
  };
  try {
    navigator.vibrate?.(pattern[som] ?? [80, 60, 80]);
  } catch {}
}

/** Fanfarra de metais (se o hino não puder tocar). */
function fanfare(start = 0) {
  const seq: [number, number, number][] = [
    [C5, 0, 0.18], [C5, 0.2, 0.18], [C5, 0.4, 0.18], [E5, 0.6, 0.55],
    [587.33, 1.2, 0.18], [E5, 1.4, 0.18], [G5, 1.6, 1.2],
  ];
  for (const [f, s, d] of seq) brass(f, start + s, d, 0.08);
  brass(C6, start + 1.6, 1.2, 0.05);
}

let crowdTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Festejo da vitória: rufar de tambores e pratos, depois o Hino Nacional, com a multidão a festejar por baixo.
 * Se o hino não puder tocar (sem rede, por exemplo), toca uma fanfarra.
 */
export async function festejo() {
  if (!(await ready())) return;
  pararFestejo();
  // rufar: batidas de caixa cada vez mais fortes, durante 1,6 s
  for (let i = 0; i < 32; i++) {
    noiseBurst(i * 0.05, 0.06, { type: 'highpass', from: 1500, to: 1500, gain: 0.04 + (0.16 * i) / 32, attack: 0.003 });
  }
  noiseBurst(1.6, 2.2, { type: 'highpass', from: 6000, to: 5000, gain: 0.18, attack: 0.005 }); // pratos
  // multidão: ruído em várias bandas, a crescer e a desvanecer
  for (const [from, gain] of [
    [500, 0.08],
    [1200, 0.07],
    [2600, 0.04],
  ] as const) {
    noiseBurst(1.5, 7, { from, to: from * 1.2, q: 0.7, gain, attack: 0.6 });
  }
  crowdTimer = setTimeout(() => {
    anthem ??= new Audio(ANTHEM_SRC);
    anthem.volume = volume;
    anthem.muted = false;
    anthem.currentTime = 0;
    anthem.play().catch(() => {
      if (ctx && master) fanfare();
    });
  }, 1600);
}

export function pararFestejo() {
  if (crowdTimer) clearTimeout(crowdTimer);
  crowdTimer = null;
  if (anthem && !anthem.paused) {
    anthem.pause();
    anthem.currentTime = 0;
  }
}

export const hinoATocar = () => !!anthem && !anthem.paused;

type Sentinel = { release: () => Promise<void> };
let lock: Sentinel | null = null;

/** Impede o ecrã de se desligar (Chrome, Edge, Safari 16.4+). Devolve false se não for suportado. */
export async function keepAwake(on: boolean) {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
  if (!wl) return false;
  try {
    if (on && !lock) lock = await wl.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
    return true;
  } catch {
    lock = null;
    return false;
  }
}

/** O sistema liberta o bloqueio quando o separador fica oculto: voltar a pedi-lo. */
export function reacquireAwake() {
  if (lock) {
    lock = null;
    void keepAwake(true);
  }
}
