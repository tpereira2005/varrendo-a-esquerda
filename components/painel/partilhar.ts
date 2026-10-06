// Imagem do resultado para partilhar (WhatsApp, Instagram…): desenhada num canvas no próprio browser.
import type { Snapshot } from '@/lib/types';
import { projectionVerdict, probText } from '@/lib/projecao.mjs';
import { compact, int, pct, shortName, timeBrasilia, timeLisbon, FLAVIO } from './format';

const W = 1080;
const H = 1350;
const SITE = 'varrendo-eleicoes-brasil-2026.tomaspereira.chatgpt.site';
const PLACAR = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TEXTO = 'Inter, "Segoe UI", system-ui, sans-serif';

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

/** Desenha o cartão do resultado e devolve-o como PNG. */
export async function drawShareImage(data: Snapshot): Promise<Blob> {
  await document.fonts?.ready;
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

  // Fundo
  const bg = g.createLinearGradient(0, 0, W, H);
  if (flavioWon) {
    bg.addColorStop(0, '#003d1a');
    bg.addColorStop(0.5, '#00792f');
    bg.addColorStop(1, '#002776');
  } else {
    bg.addColorStop(0, '#0b1324');
    bg.addColorStop(1, '#16213a');
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Faixa nas cores do Brasil
  const stripe = [
    ['#009c3b', 0, 0.45],
    ['#ffdf00', 0.45, 0.7],
    ['#002776', 0.7, 1],
  ] as const;
  for (const [c, x0, x1] of stripe) {
    g.fillStyle = c;
    g.fillRect(W * x0, 0, W * (x1 - x0), 14);
  }

  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  g.font = `800 64px ${PLACAR}`;
  g.fillText('VARRENDO A ', 70, 130);
  const w1 = g.measureText('VARRENDO A ').width;
  g.fillStyle = '#ff5c70';
  g.fillText('ESQUERDA', 70 + w1, 130);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = `600 30px ${TEXTO}`;
  g.fillText('Eleições Brasil 2026 · 2.ª volta · Presidente', 70, 180);

  // Boneco
  const mascot = await loadImage(winner ? (flavioWon ? '/emoji/humor-10.png' : '/emoji/humor-01.png') : data.mood.src);
  if (mascot) g.drawImage(mascot, W - 70 - 190, 60, 190, 190);

  // Título do estado da noite
  let headline = 'A aguardar os primeiros votos';
  let headColor = '#ffffff';
  if (winner) {
    headline = flavioWon ? 'FLÁVIO BOLSONARO ELEITO!' : `${shortName(winner, 1).toUpperCase()} ELEITO PELO TSE`;
    headColor = flavioWon ? '#ffdf00' : '#ffffff';
  } else if (counted) {
    const lead = a.votes >= b.votes ? a : b;
    headline = `${shortName(lead, 1).toUpperCase()} À FRENTE`;
    headColor = lead === a ? '#3ad072' : '#ff6b7d';
  }
  g.fillStyle = headColor;
  g.font = `800 92px ${PLACAR}`;
  g.fillText(headline, 70, 360, W - 140);

  // Placar
  const cardY = 410;
  roundRect(g, 50, cardY, W - 100, 520, 36);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fill();
  const side = (c: typeof a, x: number, align: CanvasTextAlign, color: string) => {
    g.textAlign = align;
    g.fillStyle = '#ffffff';
    g.font = `700 44px ${TEXTO}`;
    g.fillText(c.number === FLAVIO ? 'Flávio Bolsonaro' : shortName(c, 1), x, cardY + 90);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = `600 28px ${TEXTO}`;
    g.fillText(`${c.party} · ${c.number}`, x, cardY + 132);
    g.fillStyle = color;
    g.font = `800 150px ${PLACAR}`;
    g.fillText(counted ? pct(c.pct, 1) : pct(c.r1Pct, 1), x, cardY + 290);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = `600 30px ${TEXTO}`;
    g.fillText(counted ? `${int(c.votes)} votos` : '1.ª volta', x, cardY + 340);
  };
  side(a, 100, 'left', '#3ad072');
  side(b, W - 100, 'right', '#ff6b7d');
  g.textAlign = 'left';

  // Barra
  const share = counted ? (100 * a.votes) / (a.votes + b.votes) : (100 * fa.r1Votes) / (fa.r1Votes + fb.r1Votes);
  const bx = 100;
  const by = cardY + 390;
  const bw = W - 200;
  const bh = 34;
  g.save();
  roundRect(g, bx, by, bw, bh, bh / 2);
  g.clip();
  const gf = g.createLinearGradient(bx, 0, bx + bw * (share / 100), 0);
  gf.addColorStop(0, '#067a33');
  gf.addColorStop(1, '#10b04f');
  g.fillStyle = gf;
  g.fillRect(bx, by, bw * (share / 100), bh);
  const gl = g.createLinearGradient(bx + bw * (share / 100), 0, bx + bw, 0);
  gl.addColorStop(0, '#e8334f');
  gl.addColorStop(1, '#b3112e');
  g.fillStyle = gl;
  g.fillRect(bx + bw * (share / 100), by, bw * (1 - share / 100), bh);
  g.restore();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(bx + bw / 2 - 9, by);
  g.lineTo(bx + bw / 2 + 9, by);
  g.lineTo(bx + bw / 2, by + 11);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = `600 30px ${TEXTO}`;
  g.textAlign = 'center';
  g.fillText(
    counted ? `${pct(p!.pctSections, 2)} das secções apuradas · diferença de ${compact(Math.abs(a.votes - b.votes))} votos` : 'Barra: 1.ª volta entre os dois finalistas',
    W / 2,
    by + 90,
  );

  // Projeção (não oficial)
  let y = cardY + 600;
  if (data.projection && !winner && counted) {
    const v = projectionVerdict(data.projection);
    g.fillStyle = '#ffdf00';
    g.font = `800 52px ${PLACAR}`;
    g.fillText(`PROJEÇÃO: ${v.text.toUpperCase()}`, W / 2, y, W - 140);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = `600 32px ${TEXTO}`;
    g.fillText(
      `Flávio ${pct(data.projection.flavio, 1)} · probabilidade de vitória ${probText(data.projection.probFlavio)} · estimativa não oficial`,
      W / 2,
      y + 54,
      W - 140,
    );
    y += 110;
  } else if (flavioWon) {
    g.fillStyle = '#ffdf00';
    g.font = `800 64px ${PLACAR}`;
    g.fillText('A ESQUERDA FOI VARRIDA! 🧹', W / 2, y + 20);
    y += 90;
  }

  // Rodapé
  const now = data.serverNow;
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = `600 28px ${TEXTO}`;
  g.fillText(
    `${winner ? 'Resultado oficial do TSE' : 'Dados oficiais do TSE'} · ${timeLisbon(now)} em Lisboa (${timeBrasilia(now)} em Brasília)`,
    W / 2,
    H - 110,
  );
  g.fillStyle = '#ffffff';
  g.font = `700 32px ${TEXTO}`;
  g.fillText(SITE, W / 2, H - 60);
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
