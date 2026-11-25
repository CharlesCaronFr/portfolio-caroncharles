(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const V = '/assets/vendor/';
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const echapper = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Bibliothèques chargées à la demande (auto-hébergées) ---------- */
const charges = {};
const charge = src => charges[src] || (charges[src] = new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = V + src; s.onload = ok;
  s.onerror = () => { delete charges[src]; ko(new Error('Chargement impossible : ' + src)); };
  document.head.appendChild(s);
}));
const libPdf = async () => { await charge('pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.js'; };
const libPdfLib = () => charge('pdf-lib.min.js');
const libZip = () => charge('jszip.min.js');

/* ---------- Utilitaires ---------- */
const taille = o => o < 1048576 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo';
const base = n => n.replace(/\.[^.]+$/, '');
const estPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const dire = (el, m, erreur) => { el.textContent = m; el.classList.toggle('erreur', !!erreur); };
const versBlob = (c, mime, q) => new Promise(r => c.toBlob(r, mime, q));
function telecharger(blob, nom) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/* "1-3,5" devient [1,2,3,5] ; vide = toutes les pages */
function plage(txt, n) {
  const t = (txt || '').trim();
  if (!t) return Array.from({ length: n }, (_, i) => i + 1);
  const out = [];
  for (const part of t.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('Plage de pages invalide : « ' + part.trim() + ' ».');
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.push(i);
  }
  if (!out.length) throw new Error('Aucune page ne correspond (le document en compte ' + n + ').');
  return out;
}
async function bitmap(f) {
  try { return await createImageBitmap(f); }
  catch (e) { throw new Error('Format non lu : ' + f.name + ' (PNG, JPG, WebP, GIF ou BMP attendus).'); }
}
function canevas(l, h, fond) {
  const c = document.createElement('canvas'); c.width = l; c.height = h;
  const ctx = c.getContext('2d');
  if (fond) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l, h); }
  return [c, ctx];
}

/* ---------- Liste de fichiers (ordre, retrait, plage de pages) ---------- */
function liste(ul, tab, avecPlage, onChange) {
  const rendre = () => {
    ul.innerHTML = tab.map((e, i) => `<li><span class="f-nom">${echapper(e.file.name)}<small>${taille(e.file.size)}</small></span>`
      + (avecPlage ? `<input class="f-plage" data-i="${i}" value="${echapper(e.plage)}" placeholder="Toutes les pages" aria-label="Pages à garder pour ${echapper(e.file.name)}">` : '')
      + `<span class="f-act"><button type="button" data-a="haut" data-i="${i}" aria-label="Monter"${i === 0 ? ' disabled' : ''}>↑</button>`
      + `<button type="button" data-a="bas" data-i="${i}" aria-label="Descendre"${i === tab.length - 1 ? ' disabled' : ''}>↓</button>`
      + `<button type="button" data-a="x" data-i="${i}" aria-label="Retirer ${echapper(e.file.name)}">✕</button></span></li>`).join('');
    onChange();
  };
  ul.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-a]'); if (!b) return;
    const i = +b.dataset.i, a = b.dataset.a;
    if (a === 'x') tab.splice(i, 1);
    else { const j = a === 'haut' ? i - 1 : i + 1; if (j < 0 || j >= tab.length) return; [tab[i], tab[j]] = [tab[j], tab[i]]; }
    rendre();
  });
  ul.addEventListener('input', ev => { if (ev.target.classList.contains('f-plage')) tab[+ev.target.dataset.i].plage = ev.target.value; });
  return rendre;
}
function depot(zone, ajouter) {
  const input = $('input', zone);
  input.addEventListener('change', () => { ajouter([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('survol'); }));
  zone.addEventListener('drop', e => ajouter([...e.dataTransfer.files]));
}

/* ================= CONVERTIR ================= */
const conv = { fichiers: [], res: [] };
const ajoutRes = (nom, blob) => {
  let n = nom, k = 1;
  while (conv.res.some(r => r.nom === n)) n = nom.replace(/(\.[^.]+)$/, '-' + (++k) + '$1');
  conv.res.push({ nom: n, blob });
};
const rendreConv = liste($('#conv-liste'), conv.fichiers, false, majConv);

function majConv() {
  const fs = conv.fichiers.map(e => e.file);
  const pdfs = fs.filter(estPdf).length, imgs = fs.length - pdfs;
  const type = pdfs && !imgs ? 'pdf' : imgs && !pdfs ? 'img' : pdfs ? 'mixte' : 'vide';
  const aff = type === 'pdf' ? 'pdf' : 'img';
  const sel = $('#conv-format');
  if (sel.dataset.type !== aff) {
    const ancien = sel.value;
    const choix = aff === 'pdf'
      ? [['png', 'Images PNG'], ['jpg', 'Images JPG'], ['webp', 'Images WebP'], ['txt', 'Texte (.txt)']]
      : [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP'], ['pdf', 'Un seul PDF']];
    sel.innerHTML = choix.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if (choix.some(c => c[0] === ancien)) sel.value = ancien;
    sel.dataset.type = aff;
  }
  const sortie = sel.value;
  const mode = aff + '-' + (sortie === 'txt' ? 'txt' : sortie === 'pdf' ? 'pdf' : 'img');
  $$('[data-pour]', $('#p-conv')).forEach(el => {
    let ok = el.dataset.pour.split(' ').includes(mode);
    if (el.id === 'o-qualite') ok = ok && sortie !== 'png';
    el.hidden = !ok;
  });
  $('#conv-go').disabled = !(type === 'pdf' || type === 'img');
  dire($('#conv-statut'), type === 'mixte' ? "Un mélange de PDF et d'images : convertis-les en deux fois." : '');
}
$('#conv-format').addEventListener('change', majConv);
depot($('#conv-depot'), fs => {
  conv.fichiers.push(...fs.filter(f => estPdf(f) || /^image\//.test(f.type)).map(file => ({ file, plage: '' })));
  rendreConv();
});

function rendreRes() {
  $('#conv-res').innerHTML = conv.res.map((r, i) => `<li><span class="f-nom">${echapper(r.nom)}<small>${taille(r.blob.size)}</small></span><button type="button" class="mini" data-i="${i}">Télécharger</button></li>`).join('');
  $('#conv-zip').hidden = conv.res.length < 2;
  $('#conv-sortie').hidden = !conv.res.length;
}
$('#conv-res').addEventListener('click', e => {
  const b = e.target.closest('.mini'); if (!b) return;
  const r = conv.res[+b.dataset.i]; telecharger(r.blob, r.nom);
});
$('#conv-zip').addEventListener('click', async () => {
  await libZip();
  const z = new JSZip(); conv.res.forEach(r => z.file(r.nom, r.blob));
  telecharger(await z.generateAsync({ type: 'blob' }), 'conversion.zip');
});

async function rendrePage(page, dpi, mime, q) {
  const v0 = page.getViewport({ scale: 1 });
  const s = Math.min(dpi / 72, 9000 / Math.max(v0.width, v0.height));
  const vp = page.getViewport({ scale: s });
  const [c, ctx] = canevas(Math.ceil(vp.width), Math.ceil(vp.height), true);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const blob = await versBlob(c, mime, q);
  c.width = c.height = 0;
  if (!blob) throw new Error('Image trop grande pour ce navigateur : baisse la résolution.');
  return blob;
}
async function pdfVers(fs, sortie, st) {
  await libPdf();
  const dpi = +$('#conv-dpi').value, q = +$('#conv-qualite').value / 100;
  for (const f of fs) {
    dire(st, 'Lecture de ' + f.name + '…');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), disableFontFace: true, isEvalSupported: false, standardFontDataUrl: V + 'standard_fonts/' }).promise;
    const pages = plage($('#conv-pages').value, pdf.numPages);
    let texte = '';
    for (const [k, n] of pages.entries()) {
      dire(st, `${f.name} : page ${n} (${k + 1}/${pages.length})`);
      const page = await pdf.getPage(n);
      if (sortie === 'txt') {
        const c = await page.getTextContent();
        texte += (pages.length > 1 ? `--- Page ${n} ---\n` : '') + c.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('').replace(/ +\n/g, '\n').trim() + '\n\n';
      } else {
        ajoutRes(`${base(f.name)}-p${String(n).padStart(2, '0')}.${sortie}`, await rendrePage(page, dpi, MIME[sortie], q));
      }
      page.cleanup();
    }
    if (sortie === 'txt') {
      if (!texte.trim()) throw new Error('Aucun texte trouvé : ce PDF est sans doute un scan (images seulement).');
      ajoutRes(base(f.name) + '.txt', new Blob([texte], { type: 'text/plain;charset=utf-8' }));
    }
    pdf.destroy();
  }
}
async function imagesVersImages(fs, sortie, st) {
  const max = +$('#conv-largeur').value || 0, q = +$('#conv-qualite').value / 100;
  for (const f of fs) {
    dire(st, 'Traitement de ' + f.name + '…');
    const b = await bitmap(f), k = max && b.width > max ? max / b.width : 1;
    const [c, ctx] = canevas(Math.round(b.width * k), Math.round(b.height * k), sortie === 'jpg');
    ctx.drawImage(b, 0, 0, c.width, c.height); b.close();
    ajoutRes(base(f.name) + '.' + sortie, await versBlob(c, MIME[sortie], q));
  }
}
async function imagesVersPdf(fs, st) {
  await libPdfLib();
  const doc = await PDFLib.PDFDocument.create(), a4 = $('#conv-page').value === 'a4';
  for (const f of fs) {
    dire(st, 'Ajout de ' + f.name + '…');
    let img;
    if (f.type === 'image/jpeg') img = await doc.embedJpg(new Uint8Array(await f.arrayBuffer()));
    else if (f.type === 'image/png') img = await doc.embedPng(new Uint8Array(await f.arrayBuffer()));
    else {
      const b = await bitmap(f), [c, ctx] = canevas(b.width, b.height, true);
      ctx.drawImage(b, 0, 0); b.close();
      img = await doc.embedPng(new Uint8Array(await (await versBlob(c, 'image/png')).arrayBuffer()));
    }
    let w = img.width, h = img.height, pw, ph, x = 0, y = 0;
    if (a4) {
      pw = w > h ? 842 : 595; ph = w > h ? 595 : 842;
      const k = Math.min((pw - 56) / w, (ph - 56) / h); w *= k; h *= k; x = (pw - w) / 2; y = (ph - h) / 2;
    } else {
      const k = Math.min(1, 1500 / Math.max(w, h)); w *= k; h *= k; pw = w; ph = h;
    }
    doc.addPage([pw, ph]).drawImage(img, { x, y, width: w, height: h });
  }
  ajoutRes(fs.length === 1 ? base(fs[0].name) + '.pdf' : 'images.pdf', new Blob([await doc.save()], { type: 'application/pdf' }));
}
$('#conv-go').addEventListener('click', async () => {
  const fs = conv.fichiers.map(e => e.file), st = $('#conv-statut'), go = $('#conv-go');
  const sortie = $('#conv-format').value;
  conv.res = []; rendreRes(); go.disabled = true;
  try {
    if (estPdf(fs[0])) await pdfVers(fs, sortie, st);
    else if (sortie === 'pdf') await imagesVersPdf(fs, st);
    else await imagesVersImages(fs, sortie, st);
    dire(st, conv.res.length + (conv.res.length > 1 ? ' fichiers prêts.' : ' fichier prêt.'));
  } catch (e) { console.error(e); dire(st, e.message || 'La conversion a échoué.', true); }
  go.disabled = false; rendreRes();
});

/* ================= FUSIONNER / EXTRAIRE ================= */
const fus = { fichiers: [], blob: null };
const rendreFus = liste($('#fus-liste'), fus.fichiers, true, () => { $('#fus-go').disabled = !fus.fichiers.length; });
depot($('#fus-depot'), fs => {
  const pdfs = fs.filter(estPdf);
  fus.fichiers.push(...pdfs.map(file => ({ file, plage: '' })));
  dire($('#fus-statut'), pdfs.length < fs.length ? 'Seuls les PDF sont acceptés ici.' : '');
  rendreFus();
});
$('#fus-go').addEventListener('click', async () => {
  const st = $('#fus-statut'), go = $('#fus-go');
  go.disabled = true; $('#fus-sortie').hidden = true;
  try {
    await libPdfLib();
    const out = await PDFLib.PDFDocument.create();
    for (const e of fus.fichiers) {
      dire(st, 'Lecture de ' + e.file.name + '…');
      const src = await PDFLib.PDFDocument.load(await e.file.arrayBuffer());
      const idx = plage(e.plage, src.getPageCount()).map(n => n - 1);
      (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
    }
    fus.blob = new Blob([await out.save()], { type: 'application/pdf' });
    $('#fus-info').textContent = out.getPageCount() + ' pages, ' + taille(fus.blob.size);
    $('#fus-sortie').hidden = false; dire(st, 'Document prêt.');
  } catch (e) {
    console.error(e);
    dire(st, /encrypt/i.test(e.message) ? "Un des PDF est protégé par un mot de passe : retire d'abord la protection." : (e.message || 'La fusion a échoué.'), true);
  }
  go.disabled = !fus.fichiers.length;
});
$('#fus-dl').addEventListener('click', () => telecharger(fus.blob, fus.fichiers.length === 1 ? base(fus.fichiers[0].file.name) + '-extrait.pdf' : 'fusion.pdf'));

/* ================= TEXTE ================= */
const ta = $('#txt'); let avant = null;
function statsTexte() {
  const t = ta.value, mots = (t.match(/\S+/g) || []).length;
  const phrases = (t.match(/[^.!?…]+[.!?…]+(\s|$)/g) || []).length || (t.trim() ? 1 : 0);
  const sec = mots / 230 * 60;
  $('#s-car').textContent = t.length; $('#s-sans').textContent = t.replace(/\s/g, '').length;
  $('#s-mots').textContent = mots; $('#s-phr').textContent = phrases;
  $('#s-lec').textContent = !mots ? '0 s' : sec < 60 ? Math.max(1, Math.round(sec)) + ' s' : Math.round(sec / 60) + ' min';
}
const NB = '\u00A0', NF = '\u202F';
const nettoyer = t => t
  .replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '')
  .replace(/\.{3}/g, '…')
  .replace(/"([^"\n]+)"/g, '«' + NB + '$1' + NB + '»')
  .replace(/'/g, '’')
  .replace(/ ?([?!;])(?=[\s»”)?!;]|$)/g, NF + '$1')
  .replace(/ ?:(?=\s|$)/g, NB + ':')
  .replace(/«[ \t\u00A0\u202F]*/g, '«' + NB).replace(/[ \t\u00A0\u202F]*»/g, NB + '»');
ta.addEventListener('input', statsTexte);
$('#txt-net').addEventListener('click', () => {
  avant = ta.value; ta.value = nettoyer(avant); $('#txt-undo').disabled = false; statsTexte();
  dire($('#txt-statut'), avant === ta.value ? 'Rien à corriger.' : 'Typographie corrigée.');
});
$('#txt-undo').addEventListener('click', () => { if (avant === null) return; ta.value = avant; avant = null; $('#txt-undo').disabled = true; statsTexte(); dire($('#txt-statut'), 'Texte restauré.'); });
$('#txt-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(ta.value); dire($('#txt-statut'), 'Texte copié.'); }
  catch (e) { ta.select(); dire($('#txt-statut'), 'Copie impossible ici : le texte est sélectionné, utilise Ctrl+C.', true); }
});

/* Passerelle pour les autres outils (outils2.js) */
window.OUTILS = { $, $$, echapper, taille, base, dire, versBlob, canevas, bitmap, telecharger, libZip, charge, depot, liste,
  texte(fn, msg) {
    avant = ta.value; const n = fn(avant); ta.value = n;
    $('#txt-undo').disabled = false; ta.dispatchEvent(new Event('input'));
    dire($('#txt-statut'), avant === n ? 'Rien à changer.' : msg);
  } };

/* ================= ONGLETS ================= */
const onglets = $$('[role=tab]');
function choisir(id) {
  onglets.forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('aria-controls') === id)));
  $$('.panneau').forEach(p => { p.hidden = p.id !== id; });
}
onglets.forEach(b => b.addEventListener('click', () => { choisir(b.getAttribute('aria-controls')); history.replaceState(null, '', '#' + b.getAttribute('aria-controls').slice(2)); }));
if (location.hash.length > 1 && document.getElementById('p-' + location.hash.slice(1))) choisir('p-' + location.hash.slice(1));
majConv(); statsTexte();
})();
