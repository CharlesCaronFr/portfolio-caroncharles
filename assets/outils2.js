(() => {
'use strict';
const { $, $$, echapper, dire, versBlob, canevas, bitmap, base, telecharger, charge, depot, liste, resultats, prog, pause, montrer, MIME } = window.OUTILS;
const copier = async (t, st, ok) => {
  try { await navigator.clipboard.writeText(t); dire(st, ok || 'Copié.'); }
  catch (e) { dire(st, 'Copie impossible ici : sélectionne le texte à la main.', true); }
};
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(hex2rgb(a)), lum(hex2rgb(b))].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const hexOk = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h.trim());
const virg = (n, d = 1) => n.toFixed(d).replace('.', ',');
const val = id => $('#' + id).value.trim();

/* ================= AMELIORER UNE IMAGE (agrandir et rendre plus net) ================= */
const net = { fichiers: [], bmp: null, premier: null };
const netRes = resultats($('#net-res'), $('#net-zip'), 'images-ameliorees.zip', $('#net-sortie'));
const FINESSE = { fine: .7, std: 1.2, large: 2.2 };
const params = () => {
  const k = +$('#net-k').value;
  return { k, amount: +$('#net-force').value / 100 * 1.6, sigma: FINESSE[$('#net-finesse').value] * (1 + (k - 1) * .5) };
};
/* Agrandissement progressif par paliers de x2, lissage de haute qualité du navigateur */
function agrandir(src, sx, sy, sw, sh, k) {
  let [c] = canevas(sw, sh, false);
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  const tw = sw * k, th = sh * k;
  while (c.width < tw) {
    const nw = Math.min(tw, c.width * 2), nh = Math.min(th, c.height * 2), [c2, x2] = canevas(nw, nh, false);
    x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
    x2.drawImage(c, 0, 0, nw, nh); c = c2;
  }
  return c;
}
function boite(s, d, n, lignes, r, pas, pasLigne) {
  const D = 2 * r + 1;
  for (let l = 0; l < lignes; l++) {
    const o = l * pasLigne;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += s[o + Math.min(n - 1, Math.max(0, i)) * pas + c];
      for (let x = 0; x < n; x++) {
        d[o + x * pas + c] = sum / D;
        sum += s[o + Math.min(n - 1, x + r + 1) * pas + c] - s[o + Math.max(0, x - r) * pas + c];
      }
    }
  }
}
function flou(src, w, h, sigma) {
  const n = sigma < 1.3 ? 1 : 3, r = Math.max(1, Math.floor((Math.floor(Math.sqrt(12 * sigma * sigma / n + 1)) - 1) / 2));
  let a = new Uint8ClampedArray(src), b = new Uint8ClampedArray(src);
  for (let i = 0; i < n; i++) { boite(a, b, w, h, r, 4, w * 4); boite(b, a, h, w, r, w * 4, 4); }
  return a;
}
/* Masque flou : renforce l'écart entre chaque pixel et sa version floutée */
function nettete(c, amount, sigma) {
  if (amount <= 0) return;
  const ctx = c.getContext('2d'), w = c.width, h = c.height, img = ctx.getImageData(0, 0, w, h), o = img.data, b = flou(o, w, h, sigma);
  for (let i = 0; i < o.length; i += 4) for (let j = 0; j < 3; j++) { const d = o[i + j] - b[i + j]; if (d > 2 || d < -2) o[i + j] += amount * d; }
  ctx.putImageData(img, 0, 0);
}
function majInfo() {
  const info = $('#net-info'), go = $('#net-go'), n = net.fichiers.length;
  go.textContent = n ? `Améliorer ${n} image${n > 1 ? 's' : ''}` : 'Améliorer';
  go.disabled = !n;
  if (!net.bmp) return dire(info, n ? '' : 'Ajoute une image pour commencer.');
  const { k } = params(), w = net.bmp.width * k, h = net.bmp.height * k, mp = w * h / 1e6, trop = Math.max(w, h) > 8000 || mp > 24;
  dire(info, `${net.bmp.width} x ${net.bmp.height} px devient ${w} x ${h} px (${virg(mp)} millions de pixels).` + (trop ? " C'est trop grand pour le navigateur : choisis un agrandissement plus faible." : ''), trop);
  if (trop) go.disabled = true;
}
async function apercu() {
  if (!net.bmp) { $('#net-apercu').hidden = true; return; }
  const { k, amount, sigma } = params(), W = net.bmp.width, H = net.bmp.height;
  const cw = Math.min(W, Math.ceil(480 / k)), ch = Math.min(H, Math.ceil(320 / k));
  const x0 = Math.floor((W - cw) / 2), y0 = Math.floor((H - ch) / 2), pad = Math.ceil(sigma * 3 / k) + 2;
  const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad), ex = Math.min(W, x0 + cw + pad), ey = Math.min(H, y0 + ch + pad);
  const r = agrandir(net.bmp, sx, sy, ex - sx, ey - sy, k); nettete(r, amount, sigma);
  const apres = $('#net-apres'), avant = $('#net-avant');
  apres.width = avant.width = cw * k; apres.height = avant.height = ch * k;
  apres.getContext('2d').drawImage(r, (x0 - sx) * k, (y0 - sy) * k, cw * k, ch * k, 0, 0, cw * k, ch * k);
  avant.getContext('2d').drawImage(net.bmp, x0, y0, cw, ch, 0, 0, cw * k, ch * k);
  $('#net-apercu').hidden = false;
}
let minuteur;
const planifier = () => { clearTimeout(minuteur); minuteur = setTimeout(() => apercu().catch(console.error), 150); };
async function majNet() {
  const f = net.fichiers[0] && net.fichiers[0].file;
  majInfo();
  if (f === net.premier) return;
  net.premier = f; if (net.bmp) net.bmp.close(); net.bmp = null;
  if (f) { try { net.bmp = await bitmap(f); } catch (e) { dire($('#net-statut'), e.message, true); } }
  majInfo(); planifier();
}
const rendreNet = liste($('#net-liste'), net.fichiers, false, majNet, $('#net-vider'));
depot($('#net-depot'), fs => {
  const bons = fs.filter(f => /^image\//.test(f.type)), neufs = bons.filter(f => !net.fichiers.some(e => e.file.name === f.name && e.file.size === f.size));
  net.fichiers.push(...neufs.map(file => ({ file, plage: '' }))); rendreNet();
  dire($('#net-statut'), bons.length < fs.length ? (fs.length - bons.length) + ' fichier(s) ignoré(s) : seules les images sont acceptées.' : '', bons.length < fs.length);
}, $('#p-net'));
$$('#net-k,#net-force,#net-finesse').forEach(i => i.addEventListener('input', () => { majInfo(); planifier(); }));
const vue = $('.compar-vue');
const pos = v => { v = Math.max(0, Math.min(100, v)); $('#net-pos').value = v; $('#net-apres').style.clipPath = `inset(0 0 0 ${v}%)`; $('#net-ligne').style.left = v + '%'; };
const depuisPointeur = e => { const r = vue.getBoundingClientRect(); pos((e.clientX - r.left) / r.width * 100); };
$('#net-pos').addEventListener('input', e => pos(+e.target.value));
vue.addEventListener('pointerdown', e => { vue.setPointerCapture(e.pointerId); depuisPointeur(e); });
vue.addEventListener('pointermove', e => { if (e.buttons) depuisPointeur(e); });
$('#net-go').addEventListener('click', async () => {
  const st = $('#net-statut'), go = $('#net-go'), pg = $('#net-prog'), { k, amount, sigma } = params(), fmt = $('#net-format').value, label = go.textContent;
  netRes.vider(); go.disabled = true; prog(pg, 0);
  try {
    for (const [i, { file: f }] of net.fichiers.entries()) {
      dire(st, `Traitement de ${f.name} (${i + 1} sur ${net.fichiers.length}) : agrandissement`); prog(pg, i / net.fichiers.length); await pause();
      const b = await bitmap(f), w = b.width * k, h = b.height * k;
      if (Math.max(w, h) > 8000 || w * h > 24e6) { b.close(); throw new Error(`${f.name} serait trop grande une fois agrandie (${w} x ${h} px). Choisis un agrandissement plus faible.`); }
      let c = agrandir(b, 0, 0, b.width, b.height, k); b.close();
      dire(st, `Traitement de ${f.name} (${i + 1} sur ${net.fichiers.length}) : netteté`); await pause();
      nettete(c, amount, sigma);
      if (fmt === 'jpg') { const [c2, x2] = canevas(c.width, c.height, true); x2.drawImage(c, 0, 0); c = c2; }
      const blob = await versBlob(c, MIME[fmt], .93);
      if (!blob) throw new Error('Export impossible : image trop grande pour ce navigateur.');
      await netRes.ajouter(`${base(f.name)}-${k > 1 ? 'x' + k + '-' : ''}nette.${fmt}`, blob);
    }
    dire(st, netRes.nombre + (netRes.nombre > 1 ? ' images prêtes : télécharge-les ci-dessous.' : ' image prête : télécharge-la ci-dessous.'));
    montrer($('#net-sortie'));
  } catch (e) { console.error(e); dire(st, e.message || 'Traitement impossible.', true); }
  prog(pg, null); go.textContent = label; majInfo();
});

/* ================= LIENS SUIVIS (UTM) ET QR CODE ================= */
function majUtm() {
  const u = val('utm-url'), st = $('#utm-statut'), sortie = $('#utm-sortie');
  sortie.value = ''; $('#utm-copy').disabled = $('#utm-qr').disabled = true;
  if (!u) return dire(st, '');
  let url;
  try { url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch (e) { return dire(st, 'Cette adresse ne semble pas valide.', true); }
  dire(st, '');
  [['utm_source', 'utm-source'], ['utm_medium', 'utm-medium'], ['utm_campaign', 'utm-campagne'], ['utm_content', 'utm-contenu'], ['utm_term', 'utm-terme']].forEach(([k, id]) => {
    const v = val(id).toLowerCase().replace(/\s+/g, '-');
    if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  });
  sortie.value = url.toString(); $('#utm-copy').disabled = $('#utm-qr').disabled = false;
}
$$('#utm-url,#utm-source,#utm-medium,#utm-campagne,#utm-contenu,#utm-terme').forEach(i => i.addEventListener('input', majUtm));
$('#utm-copy').addEventListener('click', () => copier($('#utm-sortie').value, $('#utm-statut'), 'Lien copié.'));
$('#utm-qr').addEventListener('click', () => { $('#qr-texte').value = $('#utm-sortie').value; majQr(); montrer($('#qr-canvas')); });
majUtm();

let qrActuel = null;
function qrCanvas(q, px, fg, bg) {
  const n = q.getModuleCount(), m = 4, tot = n + 2 * m, pas = Math.max(1, Math.floor(px / tot));
  const [c, ctx] = canevas(pas * tot, pas * tot, false);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) ctx.fillRect((k + m) * pas, (r + m) * pas, pas, pas);
  return c;
}
function qrSvg(q, fg, bg) {
  const n = q.getModuleCount(), m = 4, tot = n + 2 * m; let d = '';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += `M${k + m},${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" shape-rendering="crispEdges"><rect width="${tot}" height="${tot}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
async function majQr() {
  const st = $('#qr-statut'), t = $('#qr-texte').value.trim(), cv = $('#qr-canvas');
  const fg = $('#qr-fg').value, bg = $('#qr-bg').value;
  qrActuel = null; $('#qr-png').disabled = $('#qr-svg').disabled = true;
  if (!t) { cv.width = cv.height = 1; return dire(st, 'Saisis un texte ou une adresse pour générer le code.'); }
  try {
    await charge('qrcode.js'); qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, $('#qr-niveau').value); q.addData(t); q.make(); qrActuel = q;
    const c = qrCanvas(q, 512, fg, bg); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
    $('#qr-png').disabled = $('#qr-svg').disabled = false;
    const r = ratio(fg, bg), inverse = lum(hex2rgb(fg)) > lum(hex2rgb(bg));
    dire(st, inverse ? 'Code plus clair que le fond : certains lecteurs ne le lisent pas. Préfère un code foncé sur fond clair.'
      : r < 4 ? 'Contraste faible : teste le scan avant de diffuser.' : 'Teste le scan avec ton téléphone avant impression.', inverse || r < 4);
  } catch (e) { dire(st, /overflow|too long|length/i.test(e.message) ? 'Texte trop long pour un QR code.' : (e.message || 'Génération impossible.'), true); }
}
$$('#qr-texte,#qr-niveau,#qr-fg,#qr-bg').forEach(i => i.addEventListener('input', majQr));
$('#qr-png').addEventListener('click', async () => { if (qrActuel) telecharger(await versBlob(qrCanvas(qrActuel, +$('#qr-taille').value, $('#qr-fg').value, $('#qr-bg').value), 'image/png'), 'qr-code.png'); });
$('#qr-svg').addEventListener('click', () => { if (qrActuel) telecharger(new Blob([qrSvg(qrActuel, $('#qr-fg').value, $('#qr-bg').value)], { type: 'image/svg+xml' }), 'qr-code.svg'); });
majQr();

/* ================= COULEURS ================= */
function lierCouleur(cid, tid) {
  const c = $('#' + cid), t = $('#' + tid);
  c.addEventListener('input', () => { t.value = c.value; majContraste(); });
  t.addEventListener('input', () => {
    if (!hexOk(t.value)) return;
    let h = t.value.trim().replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join('');
    c.value = '#' + h; majContraste();
  });
}
function majContraste() {
  const fg = $('#col-t-c').value, bg = $('#col-f-c').value, r = ratio(fg, bg);
  const e = $('#col-ech'); e.style.color = fg; e.style.background = bg;
  const v = [['Texte courant, niveau AA (4,5 minimum)', r >= 4.5], ['Texte courant, niveau AAA (7 minimum)', r >= 7], ['Grand texte, niveau AA (3 minimum)', r >= 3], ["Éléments d'interface (3 minimum)", r >= 3]];
  $('#col-res').innerHTML = `<li><span>Rapport de contraste</span><b>${virg(r, 2)} : 1</b></li>` + v.map(([l, ok]) => `<li><span>${l}</span><b>${ok ? 'Réussi' : 'Échec'}</b></li>`).join('');
}
lierCouleur('col-t-c', 'col-t'); lierCouleur('col-f-c', 'col-f'); majContraste();
$('#col-inv').addEventListener('click', () => {
  const a = $('#col-t-c').value; $('#col-t-c').value = $('#col-f-c').value; $('#col-f-c').value = a;
  $('#col-t').value = $('#col-t-c').value; $('#col-f').value = $('#col-f-c').value; majContraste();
});
async function palette(f) {
  const b = await bitmap(f), k = Math.min(1, 64 / Math.max(b.width, b.height));
  const [c, ctx] = canevas(Math.max(1, Math.round(b.width * k)), Math.max(1, Math.round(b.height * k)), false);
  ctx.drawImage(b, 0, 0, c.width, c.height); b.close();
  const d = ctx.getImageData(0, 0, c.width, c.height).data, seaux = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const key = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5), s = seaux.get(key) || [0, 0, 0, 0];
    s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; s[3]++; seaux.set(key, s);
  }
  const tri = [...seaux.values()].sort((a, b) => b[3] - a[3]).map(s => [s[0] / s[3], s[1] / s[3], s[2] / s[3]]), out = [];
  for (const col of tri) { if (out.every(o => Math.hypot(o[0] - col[0], o[1] - col[1], o[2] - col[2]) > 60)) out.push(col); if (out.length === 6) break; }
  return out.map(rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}
depot($('#pal-depot'), async fs => {
  const f = fs.find(x => /^image\//.test(x.type)), st = $('#col-statut');
  if (!f) return dire(st, 'Dépose une image (PNG, JPG, WebP).', true);
  try {
    const cols = await palette(f);
    $('#pal-res').innerHTML = cols.map(h => `<button type="button" class="pastille" data-hex="${h}" style="background:${h};color:${lum(hex2rgb(h)) > .4 ? '#141414' : '#ffffff'}">${h}</button>`).join('');
    dire(st, 'Clique sur une pastille pour copier son code.');
  } catch (e) { dire(st, e.message || 'Image illisible.', true); }
}, $('#p-col'));
$('#pal-res').addEventListener('click', e => { const b = e.target.closest('.pastille'); if (b) copier(b.dataset.hex, $('#col-statut'), b.dataset.hex + ' copié.'); });

/* ---------- Valeur affichée à côté des curseurs ---------- */
$$('.outils input[type=range]').forEach(r => {
  const o = r.parentElement.querySelector('output'); if (!o) return;
  const maj = () => { o.textContent = r.value; }; r.addEventListener('input', maj); maj();
});
})();
