// Imagem do resultado para partilhar (WhatsApp, Instagram…), desenhada num canvas no próprio browser.
// Segue o tema escolhido no site (claro por predefinição ou escuro).
import type { Snapshot } from '@/lib/types';
import { projectionVerdict, probText } from '@/lib/projecao.mjs';
import { compact, countdown, int, pct, pp, retrato, shortName, timeBrasilia, timeLisbon, FLAVIO } from './format';

const W = 1080;
const H = 1350;
const SITE = 'varrendo-a-esquerda.tomaspereira.chatgpt.site';
const PLACAR = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TEXTO = 'Inter, "Segoe UI", system-ui, sans-serif';

type Palette = {
  bg: string;
  glowA: string;
  glowB: string;
  card: string;
  line: string;
  soft: string;
  ink: string;
  muted: string;
  flavio: string;
  lula: string;
  gold: string;
  shadow: string;
};

const LIGHT: Palette = {
  bg: '#f3f4ef',
  glowA: 'rgba(8,137,58,0.16)',
  glowB: 'rgba(242,194,0,0.20)',
  card: '#ffffff',
  line: '#e3e6df',
  soft: '#f0f2ec',
  ink: '#101521',
  muted: '#5b6472',
  flavio: '#08893a',
  lula: '#cc1636',
  gold: '#c99a00',
  shadow: 'rgba(16,21,33,0.12)',
};

const DARK: Palette = {
  bg: '#0a0e17',
  glowA: 'rgba(47,194,102,0.18)',
  glowB: 'rgba(255,212,59,0.14)',
  card: '#121826',
  line: '#232c3d',
  soft: '#192132',
  ink: '#eef1f6',
  muted: '#9aa4b4',
  flavio: '#2fc266',
  lula: '#ff5c70',
  gold: '#ffd43b',
  shadow: 'rgba(0,0,0,0.45)',
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Escreve texto reduzindo o tamanho até caber na largura indicada. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, weight: string, size: number, family: string) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 12);
  g.fillText(text, x, y);
}

/** Logótipo: círculo verde com contorno amarelo e a vassoura (o mesmo desenho do cabeçalho). */
function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 64;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#0aa346');
  grad.addColorStop(1, '#05582a');
  g.beginPath();
  g.arc(32, 32, 29, 0, Math.PI * 2);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ffdf00';
  g.stroke();
  g.lineCap = 'round';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(45, 11);
  g.lineTo(30, 33);
  g.stroke();
  g.fillStyle = '#ffdf00';
  g.beginPath();
  g.moveTo(23, 29);
  g.lineTo(36, 37);
  g.lineTo(30, 53);
  g.quadraticCurveTo(20, 51, 13, 44);
  g.closePath();
  g.fill();
  g.strokeStyle = '#b89400';
  g.lineWidth = 1.6;
  for (const [x1, y1, x2, y2] of [
    [18, 45, 27, 39],
    [22, 49, 30, 41],
    [26, 52, 33, 42],
  ]) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  g.restore();
}

/** Dorsal com o número do candidato (verde com faixa amarela; vermelho com faixa bordô). */
function drawBadge(g: CanvasRenderingContext2D, x: number, y: number, number: string, flavio: boolean) {
  const s = 76;
  g.save();
  roundRect(g, x, y, s, s, 20);
  g.clip();
  const grad = g.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, flavio ? '#0aa346' : '#e0213f');
  grad.addColorStop(1, flavio ? '#066b2d' : '#a10f29');
  g.fillStyle = grad;
  g.fillRect(x, y, s, s);
  g.fillStyle = flavio ? '#ffdf00' : '#5c0a18';
  g.fillRect(x, y + s - 6, s, 6);
  g.restore();
  g.fillStyle = '#ffffff';
  g.font = `800 46px ${PLACAR}`;
  g.textAlign = 'center';
  g.fillText(number, x + s / 2, y + 54);
}

/** Retrato redondo com aro nas cores do candidato e o número em selo no canto; sem retrato, só o número. */
function drawPortrait(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  s: number,
  number: string,
  flavio: boolean,
  left: boolean,
  card: string,
) {
  if (!img) {
    drawBadge(g, x + (s - 76) / 2, y + (s - 76) / 2, number, flavio);
    return;
  }
  const r = s / 2;
  const ring = g.createLinearGradient(x, y, x + s, y + s);
  ring.addColorStop(0, flavio ? '#0aa346' : '#e0213f');
  ring.addColorStop(1, flavio ? '#ffdf00' : '#5c0a18');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(x + r, y + r, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = card;
  g.beginPath();
  g.arc(x + r, y + r, r - 6, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(x + r, y + r, r - 10, 0, Math.PI * 2);
  g.clip();
  g.drawImage(img, x + 10, y + 10, s - 20, s - 20);
  g.restore();
  // selo com o número, no canto de fora
  const b = 46;
  const bx = left ? x + s - b + 8 : x - 8;
  const by = y + s - b + 6;
  g.save();
  roundRect(g, bx - 4, by - 4, b + 8, b + 8, 15);
  g.fillStyle = card;
  g.fill();
  roundRect(g, bx, by, b, b, 12);
  g.clip();
  const grad = g.createLinearGradient(bx, by, bx + b, by + b);
  grad.addColorStop(0, flavio ? '#0aa346' : '#e0213f');
  grad.addColorStop(1, flavio ? '#066b2d' : '#a10f29');
  g.fillStyle = grad;
  g.fillRect(bx, by, b, b);
  g.fillStyle = flavio ? '#ffdf00' : '#5c0a18';
  g.fillRect(bx, by + b - 4, b, 4);
  g.restore();
  g.fillStyle = '#ffffff';
  g.font = `800 28px ${PLACAR}`;
  g.textAlign = 'center';
  g.fillText(number, bx + b / 2, by + 33);
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Desenha o cartão do resultado e devolve-o como PNG. */
export async function drawShareImage(data: Snapshot, theme: 'light' | 'dark' = currentTheme()): Promise<Blob> {
  await document.fonts?.ready;
  const c = theme === 'dark' ? DARK : LIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;

  const p = data.national.parsed;
  const [fa, fb] = data.national.finalists;
  const a = p?.cands[0] ?? { ...fa, votes: 0, pct: 0 };
  const b = p?.cands[1] ?? { ...fb, votes: 0, pct: 0 };
  const counted = !!p && a.votes + b.votes > 0;
  const winner = p?.winner != null ? p.cands[p.winner] : null;
  const flavioWon = winner?.number === FLAVIO;
  const r1Share = (100 * fa.r1Votes) / (fa.r1Votes + fb.r1Votes);

  // ---- fundo ----
  g.fillStyle = c.bg;
  g.fillRect(0, 0, W, H);
  for (const [gx, gy, col] of [
    [0, 0, c.glowA],
    [W, 0, c.glowB],
  ] as const) {
    const rg = g.createRadialGradient(gx, gy, 0, gx, gy, 760);
    rg.addColorStop(0, flavioWon ? (theme === 'dark' ? 'rgba(255,212,59,0.22)' : 'rgba(242,194,0,0.28)') : col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }
  // faixa nas cores do Brasil
  for (const [col, x0, x1] of [
    ['#009c3b', 0, 0.45],
    ['#ffdf00', 0.45, 0.7],
    ['#002776', 0.7, 1],
  ] as const) {
    g.fillStyle = col;
    g.fillRect(W * x0, 0, W * (x1 - x0), 12);
  }

  // ---- cabeçalho ----
  drawLogo(g, 64, 52, 96);
  g.textAlign = 'left';
  g.fillStyle = c.ink;
  g.font = `800 60px ${PLACAR}`;
  const prefix = flavioWon ? 'A ' : 'VARRENDO A ';
  g.fillText(prefix, 180, 108);
  let x = 180 + g.measureText(prefix).width;
  g.fillStyle = c.lula;
  g.fillText('ESQUERDA', x, 108);
  if (flavioWon) {
    x += g.measureText('ESQUERDA').width;
    g.fillStyle = c.ink;
    g.fillText(' FOI VARRIDA!', x, 108);
  }
  g.fillStyle = c.muted;
  g.font = `600 27px ${TEXTO}`;
  g.fillText('Eleições Brasil 2026 · 2.ª volta · Presidente', 182, 146);

  // ---- cartão principal ----
  const cx = 56;
  const cy = 186;
  const cw = W - 112;
  const ch = 800;
  g.save();
  g.shadowColor = c.shadow;
  g.shadowBlur = 50;
  g.shadowOffsetY = 18;
  roundRect(g, cx, cy, cw, ch, 44);
  g.fillStyle = c.card;
  g.fill();
  g.restore();
  roundRect(g, cx, cy, cw, ch, 44);
  g.strokeStyle = flavioWon ? c.gold : c.line;
  g.lineWidth = flavioWon ? 5 : 2;
  g.stroke();

  // etiqueta do estado (canto superior direito do cartão)
  const tag = winner ? 'RESULTADO OFICIAL DO TSE' : counted ? `AO VIVO · ${pct(p!.pctSections, 1)} APURADO` : 'ANTES DO FECHO DAS URNAS';
  g.font = `800 26px ${PLACAR}`;
  const tw = g.measureText(tag).width + 44;
  roundRect(g, cx + cw - tw - 36, cy + 34, tw, 48, 24);
  g.fillStyle = winner ? (flavioWon ? '#ffdf00' : c.soft) : counted ? (theme === 'dark' ? '#3a1620' : '#fbe5e8') : c.soft;
  g.fill();
  g.fillStyle = winner ? (flavioWon ? '#002776' : c.muted) : counted ? c.lula : c.muted;
  g.textAlign = 'center';
  g.fillText(tag, cx + cw - tw / 2 - 36, cy + 67);
  g.textAlign = 'left';
  g.fillStyle = c.muted;
  g.font = `800 26px ${PLACAR}`;
  g.fillText('PRESIDENTE · BRASIL', cx + 44, cy + 67);

  // boneco e manchete
  const mascotSrc = winner ? (flavioWon ? '/emoji/humor-10.png' : '/emoji/humor-01.png') : data.mood.src;
  const mascot = await loadImage(mascotSrc);
  if (mascot) g.drawImage(mascot, W / 2 - 85, cy + 100, 170, 170);
  g.textAlign = 'center';
  let head = 'A AGUARDAR OS PRIMEIROS VOTOS';
  let headColor = c.muted;
  let sub = `As urnas fecham às ${timeLisbon(data.pollsCloseAt)} em Lisboa (${timeBrasilia(data.pollsCloseAt)} em Brasília)`;
  if (winner) {
    head = flavioWon ? 'FLÁVIO BOLSONARO ELEITO!' : `${shortName(winner, 1).toUpperCase()} ELEITO PELO TSE`;
    headColor = flavioWon ? c.flavio : c.ink;
    sub = `${pct(winner.pct, 2)} dos votos válidos · ${int(winner.votes)} votos`;
  } else if (counted) {
    const leadA = a.votes >= b.votes;
    head = `${shortName(leadA ? a : b, 1).toUpperCase()} À FRENTE`;
    headColor = leadA ? c.flavio : c.lula;
    sub = `por ${compact(Math.abs(a.votes - b.votes))} votos · ${pp(Math.abs(a.pct - b.pct))}`;
  } else if (data.serverNow < data.pollsCloseAt) {
    sub += ` · faltam ${countdown(data.pollsCloseAt, data.serverNow)}`;
  }
  g.fillStyle = headColor;
  fitText(g, head, W / 2, cy + 340, cw - 80, '800', 76, PLACAR);
  g.fillStyle = c.muted;
  fitText(g, sub, W / 2, cy + 388, cw - 80, '600', 30, TEXTO);

  // candidatos
  const rowY = cy + 440;
  const [imgA, imgB] = await Promise.all(
    [a, b].map((cand) => {
      const src = retrato(cand.number);
      return src ? loadImage(src) : Promise.resolve(null);
    }),
  );
  const PS = 112; // diâmetro do retrato
  const side = (cand: typeof a, left: boolean, color: string, img: HTMLImageElement | null) => {
    const bx = left ? cx + 44 : cx + cw - 44 - PS;
    drawPortrait(g, img, bx, rowY - 30, PS, cand.number, cand.number === FLAVIO, left, c.card);
    g.textAlign = left ? 'left' : 'right';
    const tx = left ? bx + PS + 24 : bx - 24;
    g.fillStyle = c.ink;
    g.font = `800 38px ${TEXTO}`;
    g.fillText(cand.number === FLAVIO ? 'Flávio Bolsonaro' : cand.number === '13' ? 'Lula da Silva' : shortName(cand, 1), tx, rowY + 20);
    g.fillStyle = c.muted;
    g.font = `600 26px ${TEXTO}`;
    g.fillText(img ? cand.party : `${cand.party} · ${cand.number}`, tx, rowY + 54);
    g.fillStyle = color;
    g.globalAlpha = counted || winner ? 1 : 0.3;
    g.font = `800 132px ${PLACAR}`;
    g.fillText(counted ? pct(cand.pct, 2) : pct(cand.r1Pct, 2), left ? cx + 44 : cx + cw - 44, rowY + 205);
    g.globalAlpha = 1;
    g.fillStyle = c.muted;
    g.font = `600 26px ${TEXTO}`;
    g.fillText(counted ? `${int(cand.votes)} votos` : '1.ª volta', left ? cx + 44 : cx + cw - 44, rowY + 245);
  };
  side(a, true, c.flavio, imgA);
  side(b, false, c.lula, imgB);

  // barra (verde e vermelho encostados, entalhe nos 50%)
  const share = counted ? (100 * a.votes) / (a.votes + b.votes) : r1Share;
  const bx = cx + 44;
  const by = rowY + 280;
  const bw = cw - 88;
  const bh = 26;
  g.save();
  g.globalAlpha = counted ? 1 : 0.4;
  roundRect(g, bx, by, bw, bh, bh / 2);
  g.clip();
  const gf = g.createLinearGradient(bx, 0, bx + bw * (share / 100), 0);
  gf.addColorStop(0, theme === 'dark' ? '#1f9e52' : '#067a33');
  gf.addColorStop(1, theme === 'dark' ? '#3ad072' : '#10b04f');
  g.fillStyle = gf;
  g.fillRect(bx, by, bw * (share / 100), bh);
  const gl = g.createLinearGradient(bx + bw * (share / 100), 0, bx + bw, 0);
  gl.addColorStop(0, theme === 'dark' ? '#ff6b7d' : '#e8334f');
  gl.addColorStop(1, theme === 'dark' ? '#e0334c' : '#b3112e');
  g.fillStyle = gl;
  g.fillRect(bx + bw * (share / 100), by, bw * (1 - share / 100), bh);
  g.restore();
  g.fillStyle = c.card;
  g.beginPath();
  g.moveTo(bx + bw / 2 - 8, by);
  g.lineTo(bx + bw / 2 + 8, by);
  g.lineTo(bx + bw / 2, by + 10);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = c.muted;
  g.font = `600 25px ${TEXTO}`;
  g.fillText(
    counted
      ? `${pct(p!.pctSections, 2)} das secções apuradas · ficheiro do TSE das ${timeLisbon(data.national.meta.generatedAt)} (Lisboa)`
      : 'Barra: 1.ª volta entre os dois finalistas',
    W / 2,
    by + 66,
  );

  // ---- painel inferior: projeção, festejo ou referência ----
  const py = cy + ch + 28;
  const ph = 172;
  roundRect(g, cx, py, cw, ph, 36);
  if (flavioWon) {
    const gg = g.createLinearGradient(cx, py, cx + cw, py + ph);
    gg.addColorStop(0, '#00782f');
    gg.addColorStop(0.5, '#009c3b');
    gg.addColorStop(1, '#c9a800');
    g.fillStyle = gg;
  } else {
    g.fillStyle = c.card;
  }
  g.fill();
  if (!flavioWon) {
    g.strokeStyle = c.line;
    g.lineWidth = 2;
    g.stroke();
  }
  g.textAlign = 'center';
  if (flavioWon) {
    g.fillStyle = '#ffdf00';
    fitText(g, 'A ESQUERDA FOI VARRIDA! 🧹', W / 2, py + 105, cw - 80, '800', 72, PLACAR);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = `600 28px ${TEXTO}`;
    g.fillText(`Resultado oficial do TSE · ${pct(winner!.pct, 2)} dos votos válidos`, W / 2, py + 152);
  } else if (winner) {
    g.fillStyle = c.muted;
    g.font = `600 30px ${TEXTO}`;
    g.fillText(`Resultado oficial do TSE · ${pct(p!.pctSections, 2)} das secções`, W / 2, py + 105);
  } else if (data.projection && counted) {
    const v = projectionVerdict(data.projection);
    g.fillStyle = c.muted;
    g.font = `800 24px ${PLACAR}`;
    g.fillText('PROJEÇÃO · ESTIMATIVA NÃO OFICIAL', W / 2, py + 52);
    g.fillStyle = v.who === 'flavio' ? c.flavio : v.who === 'lula' ? c.lula : c.ink;
    fitText(g, v.text.toUpperCase(), W / 2, py + 118, cw - 80, '800', 64, PLACAR);
    g.fillStyle = c.muted;
    g.font = `600 28px ${TEXTO}`;
    g.fillText(
      `Flávio ${pct(data.projection.flavio, 1)} · probabilidade de vitória ${probText(data.projection.probFlavio)}`,
      W / 2,
      py + 160,
    );
  } else {
    g.fillStyle = c.muted;
    g.font = `800 24px ${PLACAR}`;
    g.fillText('1.ª VOLTA, SÓ OS DOIS FINALISTAS', W / 2, py + 62);
    g.fillStyle = c.ink;
    fitText(g, `Flávio ${pct(r1Share, 1)} × Lula ${pct(100 - r1Share, 1)}`, W / 2, py + 128, cw - 80, '800', 64, PLACAR);
  }

  // ---- rodapé ----
  g.textAlign = 'center';
  g.fillStyle = c.muted;
  g.font = `600 25px ${TEXTO}`;
  g.fillText(`Dados oficiais do TSE · ${timeLisbon(data.serverNow)} em Lisboa (${timeBrasilia(data.serverNow)} em Brasília)`, W / 2, H - 86);
  g.fillStyle = c.ink;
  g.font = `700 29px ${TEXTO}`;
  g.fillText(SITE, W / 2, H - 44);
  g.textAlign = 'left';

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Imagem'))), 'image/png'));
}

/** Partilha a imagem (iPhone/Android: folha de partilha; PC: descarrega o ficheiro). */
export async function shareResult(data: Snapshot) {
  const blob = await drawShareImage(data);
  const file = new File([blob], 'varrendo-resultado.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Varrendo a Esquerda · 2.ª volta', text: `https://${SITE}` });
      return 'partilhado';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'descarregado';
}
