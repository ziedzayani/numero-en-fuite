/*
 * V9.18 : carte de victoire à partager. L'image est DESSINÉE par le jeu (canvas), à partir de l'écran de fin
 * affiché (titre, numéro, podium : déjà traduits) et des images du jeu (trophée, détective, médailles).
 * Aucune connexion : sur Android, window.NumeroShare.shareImage(base64, texte) ouvre le menu de partage ;
 * dans un navigateur, partage du fichier si possible, sinon téléchargement de l'image.
 */
const SHARE_LINK = 'https://github.com/ziedzayani/numero-en-fuite/releases/tag/apk-latest';
const CARD_W = 1080,
  CARD_H = 1350;

/** Image de fond CSS d'un élément temporaire (les images du jeu sont intégrées dans les styles). */
function cssImage(html) {
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
  box.innerHTML = html;
  document.body.appendChild(box);
  const el = box.querySelector('[data-img]');
  const bg = el ? getComputedStyle(el).backgroundImage : '';
  box.remove();
  const m = /url\(["']?(.*?)["']?\)/.exec(bg || '');
  if (!m) return Promise.resolve(null);
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = m[1];
  });
}
/** Dessine une image dans un cadre en gardant ses proportions (contain). */
function drawContain(ctx, im, x, y, w, h) {
  if (!im) return;
  const r = Math.min(w / im.width, h / im.height),
    dw = im.width * r,
    dh = im.height * r;
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh), dw, dh);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/** Coupe un texte en lignes qui tiennent dans `max` pixels. */
function wrapText(ctx, text, max) {
  const words = String(text).split(/\s+/),
    lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
/** Ce que montre l'écran de fin, pour la carte : titre, numéro, lignes du podium, série. */
function victoryInfo() {
  const txt = sel => (document.querySelector(sel) || {}).textContent || '';
  const rows = [...document.querySelectorAll('.podium-panel .pod-row')].slice(0, 4).map((r, i) => ({
    name: ((r.querySelector('strong') || {}).firstChild || {}).textContent || '',
    line: (r.querySelector('small') || {}).textContent || '',
    place: Number((/place-(\d)/.exec(r.className) || [])[1]) || i + 1
  }));
  return {
    title: txt('.end-hero h1')
      .replace(/[🏆⏱😅]\s*/gu, '')
      .trim(),
    caught: txt('.race-caught') || txt('.escaped-note span'),
    series: txt('.series-pill small'),
    rows
  };
}
/** Dessine la carte (1080 × 1350) et renvoie le canvas. */
async function drawVictoryCard() {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) {
    // polices indisponibles : la police de secours suffit
  }
  const info = victoryInfo();
  const [trophy, det, m1, m2, m3] = await Promise.all([
    cssImage('<section class="race-hero"><div class="rh-trophy" data-img></div></section>'),
    cssImage('<section class="race-hero"><span class="win-det" data-img></span></section>'),
    ...[1, 2, 3].map(n =>
      cssImage(`<div class="pod-row place-${n}"><div class="medal" data-img></div></div>`)
    )
  ]);
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d'),
    rtl = g.lang === 'ar',
    F = (size, w = 800) => `${w} ${size}px Baloo, system-ui, sans-serif`;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  // fond bleu nuit à rayons
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#1f4fd0');
  bg.addColorStop(0.55, '#163a9e');
  bg.addColorStop(1, '#0b1d5a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  ctx.translate(CARD_W * 0.62, 300);
  ctx.fillStyle = 'rgba(170, 215, 255, 0.10)';
  for (let a = 0; a < 360; a += 14) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1600, (a * Math.PI) / 180, ((a + 5) * Math.PI) / 180);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // en-tête « THE NUMBER HUNT »
  roundRect(ctx, 250, 40, 580, 90, 45);
  ctx.fillStyle = '#0f2462';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffd54a';
  ctx.stroke();
  ctx.fillStyle = '#ffd54a';
  ctx.font = F(46, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THE NUMBER HUNT', 540, 87);
  // détective et trophée
  drawContain(ctx, det, rtl ? 690 : 20, 150, 360, 460);
  drawContain(ctx, trophy, rtl ? 210 : 470, 150, 420, 230);
  // bandeau vert du titre
  ctx.font = F(70, 900);
  const lines = wrapText(ctx, info.title || t('endTitle'), 560).slice(0, 3);
  const bandX = rtl ? 60 : 400,
    bandW = 620,
    bandY = 360,
    bandH = 60 + lines.length * 78;
  roundRect(ctx, bandX, bandY, bandW, bandH, 40);
  const gr = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  gr.addColorStop(0, '#2bbd62');
  gr.addColorStop(1, '#0f7a37');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffd54a';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#0b5a28';
  ctx.shadowOffsetY = 5;
  lines.forEach((l, i) => ctx.fillText(l, bandX + bandW / 2, bandY + 70 + i * 78));
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;
  // numéro caché (cartouche crème)
  let y = Math.max(bandY + bandH, 610) + 40;
  if (info.caught) {
    roundRect(ctx, 60, y, 960, 100, 30);
    ctx.fillStyle = '#fff6dd';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffc83d';
    ctx.stroke();
    ctx.fillStyle = '#14205a';
    ctx.font = F(46, 800);
    ctx.fillText(wrapText(ctx, info.caught.trim(), 900)[0], 540, y + 52);
    y += 130;
  }
  // podium
  const medals = [m1, m2, m3];
  for (const r of info.rows) {
    const h = 120;
    roundRect(ctx, 60, y, 960, h, 30);
    ctx.fillStyle = r.place === 1 ? '#1f4fd0' : '#12307f';
    ctx.fill();
    ctx.lineWidth = r.place === 1 ? 7 : 3;
    ctx.strokeStyle = r.place === 1 ? '#ffd54a' : 'rgba(111, 240, 255, 0.7)';
    ctx.stroke();
    drawContain(ctx, medals[Math.min(r.place, 3) - 1], rtl ? 900 : 80, y + 10, 100, 100);
    ctx.textAlign = rtl ? 'right' : 'left';
    const tx = rtl ? 870 : 210;
    ctx.fillStyle = '#fff';
    ctx.font = F(52, 900);
    ctx.fillText(r.name.trim().slice(0, 22), tx, y + 42);
    ctx.fillStyle = '#cfe0ff';
    ctx.font = F(32, 700);
    ctx.fillText(wrapText(ctx, r.line.trim(), 780)[0] || '', tx, y + 88);
    ctx.textAlign = 'center';
    y += h + 18;
  }
  // série + pied de carte
  if (info.series) {
    ctx.fillStyle = '#ffe08a';
    ctx.font = F(40, 800);
    ctx.fillText(info.series.trim(), 540, Math.min(y + 30, CARD_H - 150));
  }
  ctx.fillStyle = '#fff';
  ctx.font = F(36, 700);
  ctx.fillText(t('shareFooter'), 540, CARD_H - 70);
  return c;
}
/** Bouton « Partager » des écrans de victoire. */
async function shareVictory() {
  if (shareVictory.busy) return;
  shareVictory.busy = true;
  try {
    const canvas = await drawVictoryCard(),
      url = canvas.toDataURL('image/png'),
      text = t('shareText') + ' ' + SHARE_LINK;
    const bridge = window.NumeroShare;
    if (bridge && typeof bridge.shareImage === 'function') {
      bridge.shareImage(url.split(',')[1], text);
      return;
    }
    try {
      const blob = await (await fetch(url)).blob(),
        file = new File([blob], 'the-number-hunt.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (e) {
      // partage refusé ou impossible : on télécharge l'image
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'the-number-hunt.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    shareVictory.busy = false;
  }
}
/** Bouton rond « Partager » (bleu glossy, icône dessinée), à côté de Rejouer. */
const shareButton = () =>
  `<button class="share-btn" id="shareWin" type="button" aria-label="${esc(t('shareBtn'))}" title="${esc(t('shareBtn'))}"></button>`;
