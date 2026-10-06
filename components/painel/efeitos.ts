// Som (sintetizado, sem ficheiros) e "manter o ecrã ligado".
// O browser só deixa tocar som depois de um clique; ativar a opção "Som" serve de desbloqueio.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Sem um clique prévio na página, o browser mantém o áudio suspenso e não toca nada. */
async function ready() {
  unlockAudio();
  // Sem gesto do utilizador, o Chrome deixa resume() pendente: não esperar por ele (senão o som tocaria mais tarde).
  if (ctx?.state === 'suspended') await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
  return ctx?.state === 'running';
}

function note(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', gain = 0.18) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Aviso curto: subida para boas notícias, descida para más. */
export async function chime(tone: 'good' | 'bad' | 'neutral') {
  if (!(await ready())) return;
  if (tone === 'good') {
    note(784, 0, 0.18);
    note(1047, 0.12, 0.3);
  } else if (tone === 'bad') {
    note(440, 0, 0.2);
    note(330, 0.15, 0.35);
  } else note(660, 0, 0.25);
}

/** Fanfarra da vitória. */
export async function fanfare() {
  if (!(await ready())) return;
  const seq: [number, number, number][] = [
    [523, 0, 0.16], [523, 0.17, 0.16], [523, 0.34, 0.16], [659, 0.51, 0.5],
    [587, 1.05, 0.16], [659, 1.22, 0.16], [784, 1.39, 0.9],
    [1047, 1.39, 0.9],
  ];
  for (const [f, s, d] of seq) {
    note(f, s, d, 'square', 0.07);
    note(f / 2, s, d, 'triangle', 0.12);
  }
}

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
