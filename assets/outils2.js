(() => {
'use strict';
const { $, $$, echapper, dire, versBlob, canevas, bitmap, base, telecharger, libZip, charge, depot, liste, texte } = window.OUTILS;
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const copier = async (t, st, ok) => {
  try { await navigator.clipboard.writeText(t); dire(st, ok || 'Copié.'); }
  catch (e) { dire(st, 'Copie impossible ici : sélectionne le texte à la main.', true); }
};
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(hex2rgb(a)), lum(hex2rgb(b))].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const hexOk = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h.trim());
const virg = (n, d = 1) => n.toFixed(d).replace('.', ',');

function resultats(ul, zipBtn, nomZip) {
  let res = [];
  const rendre = () => {
    ul.innerHTML = res.map((r, i) => `<li><span class="f-nom">${echapper(r.nom)}</span><button type="button" class="mini" data-i="${i}">Télécharger</button></li>`).join('');
    ul.hidden = !res.length; zipBtn.hidden = res.length < 2;
  };
  ul.addEventListener('click', e => { const b = e.target.closest('.mini'); if (b) telecharger(res[+b.dataset.i].blob, res[+b.dataset.i].nom); });
  zipBtn.addEventListener('click', async () => {
    await libZip(); const z = new JSZip(); res.forEach(r => z.file(r.nom, r.blob));
    telecharger(await z.generateAsync({ type: 'blob' }), nomZip);
  });
  return {
    vider() { res = []; rendre(); },
    ajouter(nom, blob) { let n = nom, k = 1; while (res.some(r => r.nom === n)) n = nom.replace(/(\.[^.]+)$/, '-' + (++k) + '$1'); res.push({ nom: n, blob }); rendre(); }
  };
}

/* ================= IMAGES : formats réseaux et impression ================= */
const PRESETS = [
  ['Réseaux sociaux', [['LinkedIn, publication (1200 x 627)', 1200, 627], ['LinkedIn, bannière de profil (1584 x 396)', 1584, 396], ['LinkedIn ou Instagram, carré (1080 x 1080)', 1080, 1080], ['Instagram, portrait (1080 x 1350)', 1080, 1350], ['Story ou Reel (1080 x 1920)', 1080, 1920], ['Facebook, partage (1200 x 630)', 1200, 630], ['X, publication (1600 x 900)', 1600, 900], ['YouTube, miniature (1280 x 720)', 1280, 720]]],
  ['Impression', [['A4 à 150 dpi (1240 x 1754)', 1240, 1754], ['A4 à 300 dpi (2480 x 3508)', 2480, 3508], ['A5 à 300 dpi (1748 x 2480)', 1748, 2480]]]
];
const imgPre = $('#img-preset');
imgPre.innerHTML = PRESETS.map(([g, it]) => `<optgroup label="${g}">${it.map(([l, w, h]) => `<option value="${w},${h}">${l}</option>`).join('')}</optgroup>`).join('') + '<option value="perso">Dimensions personnalisées</option>';
const img = { fichiers: [] };
const imgRes = resultats($('#img-res'), $('#img-zip'), 'images.zip');
const majImg = liste($('#img-liste'), img.fichiers, false, () => { $('#img-go').disabled = !img.fichiers.length; });
depot($('#img-depot'), fs => { img.fichiers.push(...fs.filter(f => /^image\//.test(f.type)).map(file => ({ file, plage: '' }))); majImg(); });
imgPre.addEventListener('change', () => $$('[data-perso]').forEach(l => { l.hidden = imgPre.value !== 'perso'; }));
$('#img-go').addEventListener('click', async () => {
  const st = $('#img-statut'), go = $('#img-go');
  go.disabled = true; imgRes.vider();
  try {
    const [W, H] = imgPre.value === 'perso' ? [+$('#img-w').value, +$('#img-h').value] : imgPre.value.split(',').map(Number);
    if (!(W >= 16 && H >= 16 && W <= 8000 && H <= 8000)) throw new Error('Les dimensions doivent être comprises entre 16 et 8000 px.');
    const sortie = $('#img-sortie').value, fond = $('#img-fond').value, rempl = $('#img-mode').value === 'remplir';
    for (const { file: f } of img.fichiers) {
      dire(st, 'Traitement de ' + f.name + '…');
      const b = await bitmap(f), [c, ctx] = canevas(W, H, false);
      ctx.fillStyle = fond; ctx.fillRect(0, 0, W, H);
      const k = (rempl ? Math.max : Math.min)(W / b.width, H / b.height), dw = b.width * k, dh = b.height * k;
      ctx.drawImage(b, (W - dw) / 2, (H - dh) / 2, dw, dh); b.close();
      imgRes.ajouter(`${base(f.name)}-${W}x${H}.${sortie}`, await versBlob(c, MIME[sortie], .92));
    }
    dire(st, img.fichiers.length > 1 ? 'Images prêtes.' : 'Image prête.');
  } catch (e) { console.error(e); dire(st, e.message || 'Export impossible.', true); }
  go.disabled = false;
});

/* ================= LIENS SUIVIS (UTM) ET QR CODE ================= */
const val = id => $('#' + id).value.trim();
function majUtm() {
  const u = val('utm-url'), st = $('#utm-statut'), sortie = $('#utm-sortie');
  sortie.value = '';
  if (!u) return dire(st, '');
  let url;
  try { url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch (e) { return dire(st, 'Adresse invalide.', true); }
  dire(st, '');
  [['utm_source', 'utm-source'], ['utm_medium', 'utm-medium'], ['utm_campaign', 'utm-campagne'], ['utm_content', 'utm-contenu'], ['utm_term', 'utm-terme']].forEach(([k, id]) => {
    const v = val(id).toLowerCase().replace(/\s+/g, '-');
    if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  });
  sortie.value = url.toString();
}
$$('#utm-url,#utm-source,#utm-medium,#utm-campagne,#utm-contenu,#utm-terme').forEach(i => i.addEventListener('input', majUtm));
$('#utm-copy').addEventListener('click', () => { if ($('#utm-sortie').value) copier($('#utm-sortie').value, $('#utm-statut'), 'Lien copié.'); });
$('#utm-qr').addEventListener('click', () => { if ($('#utm-sortie').value) { $('#qr-texte').value = $('#utm-sortie').value; majQr(); } });

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
  if (!t) { cv.width = cv.height = 1; return dire(st, ''); }
  try {
    await charge('qrcode.js'); qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, $('#qr-niveau').value); q.addData(t); q.make(); qrActuel = q;
    const c = qrCanvas(q, 512, fg, bg); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
    $('#qr-png').disabled = $('#qr-svg').disabled = false;
    const r = ratio(fg, bg), inverse = lum(hex2rgb(fg)) > lum(hex2rgb(bg));
    dire(st, inverse ? 'Code plus clair que le fond : certains lecteurs ne le lisent pas. Préfère un code foncé sur fond clair.'
      : r < 4 ? 'Contraste faible : teste le scan avant de diffuser.' : 'Teste toujours le scan avec ton téléphone avant impression.', inverse || r < 4);
  } catch (e) { dire(st, /overflow|too long|length/i.test(e.message) ? 'Texte trop long pour un QR code.' : (e.message || 'Génération impossible.'), true); }
}
$$('#qr-texte,#qr-niveau,#qr-fg,#qr-bg').forEach(i => i.addEventListener('input', majQr));
$('#qr-png').addEventListener('click', async () => { if (qrActuel) telecharger(await versBlob(qrCanvas(qrActuel, +$('#qr-taille').value, $('#qr-fg').value, $('#qr-bg').value), 'image/png'), 'qr-code.png'); });
$('#qr-svg').addEventListener('click', () => { if (qrActuel) telecharger(new Blob([qrSvg(qrActuel, $('#qr-fg').value, $('#qr-bg').value)], { type: 'image/svg+xml' }), 'qr-code.svg'); });

/* ================= TEXTE : lisibilité, canaux, casse ================= */
const ta = $('#txt');
const CANAUX = [['X, publication', 280], ['LinkedIn, publication', 3000], ['Instagram, légende', 2200], ['Objet de mail (conseillé)', 60], ['Titre SEO (conseillé)', 60], ['Description SEO (conseillé)', 160], ['SMS, un message', 160]];
const VIDES = new Set('dans avec sans sous pour par sur que qui quoi dont cette cela ceux elle elles nous vous ils leur leurs mais donc car est sont être avoir ont ainsi aussi plus très tout tous toute toutes fait faire comme entre vers chez même ces ses son sera été'.split(' '));
const syllabes = m => {
  m = m.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæç]/g, ''); if (!m) return 0;
  let s = (m.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g) || []).length;
  if (s > 1 && /[^aeiouyàâäéèêëîïôöùûüÿœæ](es?|ent)$/.test(m)) s--;
  return Math.max(1, s);
};
function analyseTexte() {
  const t = ta.value, mots = t.match(/[\p{L}\p{N}’'-]+/gu) || [], n = mots.length;
  const phrases = (t.match(/[^.!?…]+[.!?…]+(\s|$)/g) || []).length || (t.trim() ? 1 : 0);
  const sec = n / 130 * 60;
  $('#s-par').textContent = !n ? '0 s' : sec < 60 ? Math.max(1, Math.round(sec)) + ' s' : Math.round(sec / 60) + ' min';
  let lis = 'n/a';
  if (n >= 20 && phrases) {
    const sy = mots.reduce((a, m) => a + syllabes(m), 0), s = 207 - 1.015 * (n / phrases) - 73.6 * (sy / n);
    lis = Math.round(s) + (s >= 90 ? ' (très facile)' : s >= 80 ? ' (facile)' : s >= 70 ? ' (assez facile)' : s >= 60 ? ' (standard)' : s >= 50 ? ' (assez difficile)' : s >= 30 ? ' (difficile)' : ' (très difficile)');
  }
  $('#s-lis').textContent = lis;
  $('#canaux').innerHTML = CANAUX.map(([nom, max]) => { const d = t.length - max;
    return `<div class="canal${d > 0 ? ' depasse' : ''}"><span>${nom}</span><b>${t.length} / ${max}${d > 0 ? ' (+' + d + ')' : ''}</b></div>`; }).join('');
  const f = {};
  mots.forEach(m => { const k = m.toLowerCase().replace(/^[’'-]+|[’'-]+$/g, ''); if (k.length >= 4 && !VIDES.has(k)) f[k] = (f[k] || 0) + 1; });
  const top = Object.entries(f).filter(e => e[1] >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  $('#top-mots').innerHTML = top.length ? top.map(([k, c]) => `<span>${echapper(k)} x${c}</span>`).join('') : '<span>Aucune répétition notable</span>';
}
ta.addEventListener('input', analyseTexte); analyseTexte();
const U = s => s.toLocaleUpperCase('fr'), L = s => s.toLocaleLowerCase('fr');
const TRANSF = {
  maj: [U, 'Texte en majuscules.'],
  min: [L, 'Texte en minuscules.'],
  titre: [t => L(t).replace(/(^|[\s\-(«])(\p{L})/gu, (m, a, b) => a + U(b)), 'Majuscule à chaque mot.'],
  phrase: [t => L(t).replace(/(^|[.!?…]\s+|\n)(\p{L})/gu, (m, a, b) => a + U(b)), 'Majuscule en début de phrase.'],
  lignes: [t => t.replace(/\r/g, '').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/[ \t]{2,}/g, ' '), 'Retours à la ligne parasites supprimés.'],
  slug: [t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), 'Texte converti en slug.']
};
$$('[data-t]').forEach(b => b.addEventListener('click', () => texte(...TRANSF[b.dataset.t])));

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
  const v = [['Texte courant, niveau AA (4,5 minimum)', r >= 4.5], ['Texte courant, niveau AAA (7 minimum)', r >= 7], ['Grand texte, niveau AA (3 minimum)', r >= 3], ['Éléments d\'interface (3 minimum)', r >= 3]];
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
    dire(st, 'Clique sur une pastille pour copier le code.');
  } catch (e) { dire(st, e.message || 'Image illisible.', true); }
});
$('#pal-res').addEventListener('click', e => { const b = e.target.closest('.pastille'); if (b) copier(b.dataset.hex, $('#col-statut'), b.dataset.hex + ' copié.'); });

/* ================= RETROPLANNING ================= */
let planning = [];
const p2 = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
const longue = d => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function calculerPlanning() {
  const d0 = $('#retro-date').value; if (!d0) throw new Error('Choisis une date de diffusion.');
  const [y, m, j] = d0.split('-').map(Number), ouvres = $('#retro-ouvres').checked;
  return $('#retro-etapes').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const r = l.match(/^J\s*(?:([+-])\s*(\d+)|0)\s*[|:;]\s*(.+)$/i);
    if (!r) throw new Error('Ligne non comprise : « ' + l + ' ». Format attendu : J-14 | Validation');
    const n = r[1] ? (r[1] === '-' ? -1 : 1) * (+r[2]) : 0, d = new Date(y, m - 1, j + n);
    if (ouvres) { const w = d.getDay(); if (w === 6) d.setDate(d.getDate() + (n > 0 ? 2 : -1)); if (w === 0) d.setDate(d.getDate() + (n > 0 ? 1 : -2)); }
    return { d, txt: r[3].trim() };
  }).sort((a, b) => a.d - b.d);
}
$('#retro-go').addEventListener('click', () => {
  const st = $('#retro-statut');
  try {
    planning = calculerPlanning();
    $('#retro-res').innerHTML = planning.map(e => `<tr><td>${echapper(longue(e.d))}</td><td>${echapper(e.txt)}</td></tr>`).join('');
    $('#retro-sortie').hidden = !planning.length; dire(st, planning.length + ' étapes calculées.');
  } catch (e) { $('#retro-sortie').hidden = true; dire(st, e.message, true); }
});
$('#retro-copy').addEventListener('click', () => copier(planning.map(e => longue(e.d) + ' : ' + e.txt).join('\n'), $('#retro-statut'), 'Planning copié.'));
$('#retro-ics').addEventListener('click', () => {
  const titre = val('retro-titre'), maintenant = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = s => s.replace(/[\\;,]/g, '\\$&');
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//caroncharles.fr//Retroplanning//FR', 'CALSCALE:GREGORIAN'];
  planning.forEach((e, i) => { const fin = new Date(e.d); fin.setDate(fin.getDate() + 1);
    l.push('BEGIN:VEVENT', `UID:${i}-${ymd(e.d)}-${maintenant}@caroncharles.fr`, 'DTSTAMP:' + maintenant, 'DTSTART;VALUE=DATE:' + ymd(e.d), 'DTEND;VALUE=DATE:' + ymd(fin), 'SUMMARY:' + esc(titre ? titre + ' : ' + e.txt : e.txt), 'END:VEVENT'); });
  l.push('END:VCALENDAR');
  telecharger(new Blob([l.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), 'retroplanning.ics');
});

/* ================= SIGNATURE MAIL ================= */
function htmlSignature() {
  const g = id => echapper(val(id)), acc = $('#sig-couleur').value;
  const nom = g('sig-nom') || 'Prénom Nom', fonction = [g('sig-fonction'), g('sig-entite')].filter(Boolean).join(' | ');
  const tel = val('sig-tel'), mail = val('sig-mail'), lien = u => { try { const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); return x.protocol.startsWith('http') ? x.href : ''; } catch (e) { return ''; } };
  const a = (href, txt) => `<a href="${echapper(href)}" style="color:${acc};text-decoration:none;">${echapper(txt)}</a>`;
  const lignes = [];
  if (tel) lignes.push(a('tel:' + tel.replace(/[^\d+]/g, ''), tel));
  if (mail) lignes.push(a('mailto:' + mail, mail));
  const site = val('sig-site'), li = val('sig-linkedin');
  if (site && lien(site)) lignes.push(a(lien(site), site.replace(/^https?:\/\//i, '').replace(/\/$/, '')));
  if (li && lien(li)) lignes.push(a(lien(li), 'LinkedIn'));
  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#333333;border-collapse:collapse;"><tr><td style="border-left:4px solid ${acc};padding-left:12px;">`
    + `<div style="font-size:16px;font-weight:bold;color:#111111;">${nom}</div>`
    + (fonction ? `<div style="color:#555555;">${fonction}</div>` : '')
    + (lignes.length ? `<div style="margin-top:6px;">${lignes.join('<span style="color:#999999;"> &nbsp;|&nbsp; </span>')}</div>` : '')
    + '</td></tr></table>';
}
const majSig = () => { $('#sig-apercu').innerHTML = htmlSignature(); };
$$('#p-sig input').forEach(i => i.addEventListener('input', majSig)); majSig();
$('#sig-copy').addEventListener('click', async () => {
  const st = $('#sig-statut'), html = htmlSignature();
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([$('#sig-apercu').innerText], { type: 'text/plain' }) })]);
    dire(st, 'Signature copiée, colle-la dans les réglages de ta messagerie.');
  } catch (e) {
    const r = document.createRange(); r.selectNodeContents($('#sig-apercu')); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    dire(st, 'Signature sélectionnée : copie-la avec Ctrl+C.', true);
  }
});
$('#sig-html').addEventListener('click', () => copier(htmlSignature(), $('#sig-statut'), 'Code HTML copié.'));

/* ================= INDICATEURS ================= */
const nb = id => { const v = parseFloat($('#' + id).value.replace(',', '.')); return Number.isFinite(v) ? v : null; };
const pct = (a, b) => (a === null || b === null || b === 0) ? 'n/a' : virg(a / b * 100, 2) + ' %';
function majKpi() {
  const imp = nb('kpi-imp'), inter = nb('kpi-inter'), clics = nb('kpi-clics'), env = nb('kpi-env'), ouv = nb('kpi-ouv'), av = nb('kpi-av'), ap = nb('kpi-ap');
  $('#k-eng').textContent = pct(inter, imp); $('#k-ctr').textContent = pct(clics, imp);
  $('#k-ouv').textContent = pct(ouv, env); $('#k-ctor').textContent = pct(clics, ouv);
  $('#k-evo').textContent = (av === null || ap === null || av === 0) ? 'n/a' : (ap >= av ? '+' : '') + virg((ap - av) / av * 100, 1) + ' %';
}
$$('#p-kpi input').forEach(i => i.addEventListener('input', majKpi)); majKpi();
})();
