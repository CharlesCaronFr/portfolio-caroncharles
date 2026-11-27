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
const pause = () => new Promise(r => setTimeout(r, 30));
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const montrer = el => el.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'nearest' });
const prog = (el, v) => { el.hidden = v === null; if (v !== null) el.value = Math.round(v * 100); };
const dedoublonner = (tab, fs) => fs.filter(f => !tab.some(e => e.file.name === f.name && e.file.size === f.size));
function telecharger(blob, nom) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function plage(txt, n) {
  const t = (txt || '').trim();
  if (!t) return Array.from({ length: n }, (_, i) => i + 1);
  const out = [];
  for (const part of t.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('Plage de pages invalide : « ' + part.trim() + ' ». Exemple : 1-3,5');
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

/* ---------- Vignettes (canvas, compatible avec la politique de sécurité) ---------- */
async function vignette(blob, nom, w, h) {
  if (/^image\//.test(blob.type)) {
    try {
      let b; try { b = await createImageBitmap(blob, { resizeWidth: w * 2, resizeQuality: 'medium' }); } catch (e) { b = await createImageBitmap(blob); }
      const [c, ctx] = canevas(w, h, false), k = Math.min(w / b.width, h / b.height);
      ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(b, (w - b.width * k) / 2, (h - b.height * k) / 2, b.width * k, b.height * k); b.close();
      c.className = 'vign'; return c;
    } catch (e) { /* repli sur la pastille */ }
  }
  const d = document.createElement('div'); d.className = 'vign badge';
  d.textContent = ((nom.match(/\.([^.]+)$/) || [, 'FICHIER'])[1]).toUpperCase().slice(0, 5);
  return d;
}

/* ---------- Liste de fichiers (ordre, retrait, plage de pages) ---------- */
function liste(ul, tab, avecPlage, onChange, vide) {
  const rendre = () => {
    ul.innerHTML = tab.map((e, i) => `<li><span class="f-vign" data-i="${i}"></span><span class="f-nom">${echapper(e.file.name)}<small>${taille(e.file.size)}${e.info ? ' · ' + echapper(e.info) : ''}</small></span>`
      + (avecPlage ? `<input class="f-plage" data-i="${i}" value="${echapper(e.plage)}" placeholder="Toutes les pages" aria-label="Pages à garder pour ${echapper(e.file.name)} (exemple 1-3,5)">` : '')
      + `<span class="f-act"><button type="button" data-a="haut" data-i="${i}" aria-label="Monter"${i === 0 ? ' disabled' : ''}>↑</button>`
      + `<button type="button" data-a="bas" data-i="${i}" aria-label="Descendre"${i === tab.length - 1 ? ' disabled' : ''}>↓</button>`
      + `<button type="button" data-a="x" data-i="${i}" aria-label="Retirer ${echapper(e.file.name)}">Retirer</button></span></li>`).join('');
    tab.forEach(async (e, i) => { const c = ul.querySelector(`.f-vign[data-i="${i}"]`); if (c) c.appendChild(await vignette(e.file, e.file.name, 48, 48)); });
    if (vide) vide.hidden = !tab.length;
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
  if (vide) vide.addEventListener('click', () => { tab.length = 0; rendre(); });
  return rendre;
}
function depot(zone, ajouter, panneau) {
  const input = $('input', zone);
  input.addEventListener('change', () => { ajouter([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('survol'); }));
  zone.addEventListener('drop', e => ajouter([...e.dataTransfer.files]));
  document.addEventListener('paste', e => {
    const fs = [...(e.clipboardData && e.clipboardData.files || [])];
    if (panneau && !panneau.hidden && fs.length) { e.preventDefault(); ajouter(fs); }
  });
}
function resultats(conteneur, zipBtn, nomZip, bloc) {
  let res = [];
  const carte = i => `<li class="res"><div class="res-img" data-i="${i}"></div><span class="res-nom">${echapper(res[i].nom)}</span><small>${taille(res[i].blob.size)}</small><button type="button" class="mini" data-i="${i}">Télécharger</button></li>`;
  conteneur.addEventListener('click', e => { const b = e.target.closest('.mini'); if (b) telecharger(res[+b.dataset.i].blob, res[+b.dataset.i].nom); });
  zipBtn.addEventListener('click', async () => {
    await libZip(); const z = new JSZip(); res.forEach(r => z.file(r.nom, r.blob));
    telecharger(await z.generateAsync({ type: 'blob' }), nomZip);
  });
  return {
    vider() { res = []; conteneur.innerHTML = ''; zipBtn.hidden = true; if (bloc) bloc.hidden = true; },
    async ajouter(nom, blob) {
      let n = nom, k = 1; while (res.some(r => r.nom === n)) n = nom.replace(/(\.[^.]+)$/, '-' + (++k) + '$1');
      res.push({ nom: n, blob }); const i = res.length - 1;
      conteneur.insertAdjacentHTML('beforeend', carte(i));
      zipBtn.hidden = res.length < 2; if (bloc) bloc.hidden = false;
      const cible = conteneur.querySelector(`.res-img[data-i="${i}"]`);
      cible.appendChild(await vignette(blob, n, 150, 100));
    },
    get nombre() { return res.length; }
  };
}

/* ================= CONVERTIR ================= */
const conv = { fichiers: [] };
const convRes = resultats($('#conv-res'), $('#conv-zip'), 'conversion.zip', $('#conv-sortie'));
const rendreConv = liste($('#conv-liste'), conv.fichiers, false, majConv, $('#conv-vider'));

function majConv() {
  const fs = conv.fichiers.map(e => e.file);
  const pdfs = fs.filter(estPdf).length, imgs = fs.length - pdfs;
  const type = pdfs && !imgs ? 'pdf' : imgs && !pdfs ? 'img' : pdfs ? 'mixte' : 'vide';
  const aff = type === 'pdf' ? 'pdf' : 'img';
  const sel = $('#conv-format');
  if (sel.dataset.type !== aff) {
    const ancien = sel.value;
    const choix = aff === 'pdf'
      ? [['png', 'Images PNG (une par page)'], ['jpg', 'Images JPG (une par page)'], ['webp', 'Images WebP (une par page)'], ['txt', 'Texte brut (.txt)']]
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
  const n = fs.length, go = $('#conv-go');
  go.disabled = !(type === 'pdf' || type === 'img');
  go.textContent = n ? `Convertir ${n} fichier${n > 1 ? 's' : ''}` : 'Convertir';
  dire($('#conv-statut'), type === 'mixte' ? 'Tu as mélangé des PDF et des images : retire les uns ou les autres et convertis-les en deux fois.'
    : type === 'vide' && !convRes.nombre ? 'Ajoute au moins un fichier pour commencer.' : '', type === 'mixte');
}
$('#conv-format').addEventListener('change', majConv);
depot($('#conv-depot'), fs => {
  const bons = fs.filter(f => estPdf(f) || /^image\//.test(f.type)), neufs = dedoublonner(conv.fichiers, bons);
  conv.fichiers.push(...neufs.map(file => ({ file, plage: '' })));
  rendreConv();
  if (bons.length < fs.length) dire($('#conv-statut'), (fs.length - bons.length) + ' fichier(s) ignoré(s) : seuls les PDF et les images sont acceptés.', true);
}, $('#p-conv'));

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
async function pdfVers(fs, sortie, st, pg) {
  await libPdf();
  const dpi = +$('#conv-dpi').value, q = +$('#conv-qualite').value / 100;
  for (const [i, f] of fs.entries()) {
    dire(st, 'Lecture de ' + f.name + '…');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), disableFontFace: true, isEvalSupported: false, standardFontDataUrl: V + 'standard_fonts/' }).promise;
    const pages = plage($('#conv-pages').value, pdf.numPages);
    let texte = '';
    for (const [k, n] of pages.entries()) {
      dire(st, `${f.name} : page ${n} (${k + 1} sur ${pages.length})`);
      prog(pg, (i + k / pages.length) / fs.length);
      const page = await pdf.getPage(n);
      if (sortie === 'txt') {
        const c = await page.getTextContent();
        texte += (pages.length > 1 ? `--- Page ${n} ---\n` : '') + c.items.map(t => t.str + (t.hasEOL ? '\n' : ' ')).join('').replace(/ +\n/g, '\n').trim() + '\n\n';
      } else {
        await convRes.ajouter(`${base(f.name)}-p${String(n).padStart(2, '0')}.${sortie}`, await rendrePage(page, dpi, MIME[sortie], q));
      }
      page.cleanup();
    }
    if (sortie === 'txt') {
      if (!texte.trim()) throw new Error('Aucun texte trouvé : ce PDF est sans doute un scan (images seulement).');
      await convRes.ajouter(base(f.name) + '.txt', new Blob([texte], { type: 'text/plain;charset=utf-8' }));
    }
    pdf.destroy();
  }
}
async function imagesVersImages(fs, sortie, st, pg) {
  const max = +$('#conv-largeur').value || 0, q = +$('#conv-qualite').value / 100;
  for (const [i, f] of fs.entries()) {
    dire(st, `Traitement de ${f.name} (${i + 1} sur ${fs.length})`); prog(pg, i / fs.length);
    const b = await bitmap(f), k = max && b.width > max ? max / b.width : 1;
    const [c, ctx] = canevas(Math.round(b.width * k), Math.round(b.height * k), sortie === 'jpg');
    ctx.drawImage(b, 0, 0, c.width, c.height); b.close();
    await convRes.ajouter(base(f.name) + '.' + sortie, await versBlob(c, MIME[sortie], q));
  }
}
async function imagesVersPdf(fs, st, pg) {
  await libPdfLib();
  const doc = await PDFLib.PDFDocument.create(), a4 = $('#conv-page').value === 'a4';
  for (const [i, f] of fs.entries()) {
    dire(st, `Ajout de ${f.name} (${i + 1} sur ${fs.length})`); prog(pg, i / fs.length);
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
  await convRes.ajouter(fs.length === 1 ? base(fs[0].name) + '.pdf' : 'images.pdf', new Blob([await doc.save()], { type: 'application/pdf' }));
}
$('#conv-go').addEventListener('click', async () => {
  const fs = conv.fichiers.map(e => e.file), st = $('#conv-statut'), go = $('#conv-go'), pg = $('#conv-prog');
  const sortie = $('#conv-format').value, texteBtn = go.textContent;
  convRes.vider(); go.disabled = true; prog(pg, 0);
  try {
    if (estPdf(fs[0])) await pdfVers(fs, sortie, st, pg);
    else if (sortie === 'pdf') await imagesVersPdf(fs, st, pg);
    else await imagesVersImages(fs, sortie, st, pg);
    dire(st, convRes.nombre + (convRes.nombre > 1 ? ' fichiers prêts : télécharge-les ci-dessous.' : ' fichier prêt : télécharge-le ci-dessous.'));
    montrer($('#conv-sortie'));
  } catch (e) { console.error(e); dire(st, e.message || 'La conversion a échoué.', true); }
  prog(pg, null); go.disabled = false; go.textContent = texteBtn;
});

/* ================= FUSIONNER / EXTRAIRE ================= */
const fus = { fichiers: [], blob: null };
const majFus = () => {
  const n = fus.fichiers.length, go = $('#fus-go');
  go.disabled = !n; go.textContent = n > 1 ? `Fusionner ${n} PDF` : n === 1 ? 'Extraire les pages' : 'Créer le PDF';
  if (!n) dire($('#fus-statut'), 'Ajoute au moins un PDF pour commencer.');
};
const rendreFus = liste($('#fus-liste'), fus.fichiers, true, majFus, $('#fus-vider'));
depot($('#fus-depot'), async fs => {
  const pdfs = fs.filter(estPdf), neufs = dedoublonner(fus.fichiers, pdfs).map(file => ({ file, plage: '', info: '' }));
  fus.fichiers.push(...neufs); rendreFus();
  if (pdfs.length < fs.length) dire($('#fus-statut'), 'Seuls les PDF sont acceptés ici.', true);
  else if (neufs.length) dire($('#fus-statut'), '');
  if (!neufs.length) return;
  try { await libPdfLib(); } catch (e) { return; }
  for (const e of neufs) {
    try { e.info = (await PDFLib.PDFDocument.load(await e.file.arrayBuffer(), { ignoreEncryption: true })).getPageCount() + ' pages'; }
    catch (err) { e.info = 'illisible ou protégé'; }
    rendreFus();
  }
}, $('#p-fus'));
$('#fus-go').addEventListener('click', async () => {
  const st = $('#fus-statut'), go = $('#fus-go'), pg = $('#fus-prog');
  go.disabled = true; $('#fus-sortie').hidden = true; prog(pg, 0);
  try {
    await libPdfLib();
    const out = await PDFLib.PDFDocument.create();
    for (const [i, e] of fus.fichiers.entries()) {
      dire(st, `Lecture de ${e.file.name} (${i + 1} sur ${fus.fichiers.length})`); prog(pg, i / fus.fichiers.length);
      const src = await PDFLib.PDFDocument.load(await e.file.arrayBuffer());
      const idx = plage(e.plage, src.getPageCount()).map(n => n - 1);
      (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
    }
    fus.blob = new Blob([await out.save()], { type: 'application/pdf' });
    $('#fus-info').textContent = out.getPageCount() + ' pages, ' + taille(fus.blob.size);
    $('#fus-sortie').hidden = false; dire(st, 'Ton PDF est prêt.'); montrer($('#fus-sortie'));
  } catch (e) {
    console.error(e);
    dire(st, /encrypt/i.test(e.message) ? "Un des PDF est protégé par un mot de passe : retire d'abord la protection." : (e.message || 'La fusion a échoué.'), true);
  }
  prog(pg, null); majFus();
});
$('#fus-dl').addEventListener('click', () => {
  const nom = ($('#fus-nom').value.trim().replace(/[\\/:*?"<>|]/g, '') || (fus.fichiers.length === 1 ? base(fus.fichiers[0].file.name) + '-extrait' : 'fusion')).replace(/\.pdf$/i, '');
  telecharger(fus.blob, nom + '.pdf');
});

/* ================= MENU DES OUTILS ================= */
const onglets = $$('.outil-btn');
function choisir(id) {
  onglets.forEach(b => { const on = b.getAttribute('aria-controls') === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $$('.panneau').forEach(p => { p.hidden = p.id !== id; });
}
onglets.forEach((b, i) => {
  b.addEventListener('click', () => {
    choisir(b.getAttribute('aria-controls'));
    history.replaceState(null, '', '#' + b.getAttribute('aria-controls').slice(2));
    b.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
  b.addEventListener('keydown', e => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? onglets.length - 1 : d ? (i + d + onglets.length) % onglets.length : -1;
    if (j < 0) return; e.preventDefault(); onglets[j].focus(); onglets[j].click();
  });
});
const depart = location.hash.length > 1 && document.getElementById('p-' + location.hash.slice(1));
choisir(depart ? depart.id : onglets[0].getAttribute('aria-controls'));
majConv(); majFus();

window.OUTILS = { $, $$, echapper, taille, base, dire, versBlob, canevas, bitmap, telecharger, libZip, charge, depot, liste, resultats, prog, pause, montrer, MIME };
})();
