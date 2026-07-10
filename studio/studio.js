/* =====================================================================
   STUDIO, l'admin visuel de caroncharles.fr
   Tout est édité ici, prévisualisé en live dans le vrai site (?studio=1),
   puis exporté vers les fichiers content/*.json à commiter.
   ===================================================================== */

const FICHIERS = ['site', 'projets', 'competences', 'parcours'];
const CLE_BROUILLON = 'studio-brouillon';
const CLE_APERCU = 'studio-contenus';
const CLE_BASE = 'studio-base';          // photo du contenu publié au moment où le brouillon a commencé

let original = {};   // contenus publiés (serveur)
let etat = {};       // contenus en cours d'édition
let blocActif = 'theme';

/* ---------- Libellés des sections de l'accueil ---------- */
const SECTIONS_ACCUEIL = {
  'ce-que-je-fais': '💼 Ce que je fais',
  'a-la-une': '📺 À la une (teaser projets)',
  'chiffres': '🔢 En chiffres',
  'competences': '🧰 Boîte à outils'
};

/* =====================================================================
   SCHÉMA : chaque bloc éditable, ses champs, où il vit dans les JSON
   ===================================================================== */
const BLOCS = [
  { groupe: 'Général' },
  { id: 'theme', em: '🎨', nom: 'Thème & couleurs', page: '/',
    sousTitre: 'Les 5 couleurs du site, appliquées partout en live.',
    champs: [
      { type: 'couleur', chemin: 'site.theme.papier', label: 'Papier (fond)' },
      { type: 'couleur', chemin: 'site.theme.encre', label: 'Encre (texte, bordures)' },
      { type: 'couleur', chemin: 'site.theme.jaune', label: 'Jaune (accent principal)' },
      { type: 'couleur', chemin: 'site.theme.rouge', label: 'Rouge (accent chaud)' },
      { type: 'couleur', chemin: 'site.theme.klein', label: 'Bleu Klein (accent froid)' },
    ]},
  { id: 'ticker', em: '📰', nom: 'Bandeau défilant', page: '/',
    sousTitre: 'Les messages qui défilent sous le header, sur toutes les pages.',
    champs: [
      { type: 'liste-texte', chemin: 'site.ticker', label: 'Messages', singulier: 'message' },
    ]},
  { id: 'footer', em: '🦶', nom: 'Footer', page: '/',
    champs: [
      { type: 'texte', chemin: 'site.footer_gauche', label: 'Texte de gauche' },
      { type: 'texte', chemin: 'site.footer_droite', label: 'Texte de droite' },
      { type: 'texte', chemin: 'site.email', label: 'Email (footer + page contact)' },
    ]},

  { groupe: 'Accueil' },
  { id: 'ordre', em: '🧱', nom: 'Ordre des blocs', page: '/',
    sousTitre: 'Glisse pour réordonner, clique l\'œil pour masquer un bloc.',
    champs: [ { type: 'sections', label: 'Blocs de l\'accueil' } ]},
  { id: 'hero', em: '🏠', nom: 'Hero', page: '/',
    champs: [
      { type: 'texte', chemin: 'site.eyebrow', label: 'Étiquette au-dessus du nom' },
      { type: 'texte', chemin: 'site.nom_ligne1', label: 'Nom, ligne 1' },
      { type: 'texte', chemin: 'site.nom_ligne2', label: 'Nom, ligne 2' },
      { type: 'long', chemin: 'site.intro', label: 'Introduction', aide: 'HTML autorisé : <strong>…</strong> pour les passages en gras.' },
      { type: 'image', chemin: 'site.photo', label: 'Photo du portrait' },
      { type: 'texte', chemin: 'site.badge_texte', label: 'Texte du badge rotatif' },
    ]},
  { id: 'offres', em: '💼', nom: 'Ce que je fais', page: '/',
    champs: [
      { type: 'liste', chemin: 'site.offres', label: 'Offres', singulier: 'offre', titreItem: 'titre',
        sousChamps: [
          { type: 'texte', cle: 'emoji', label: 'Emoji' },
          { type: 'texte', cle: 'titre', label: 'Titre' },
          { type: 'long', cle: 'texte', label: 'Texte' },
        ]},
    ]},
  { id: 'chiffres', em: '🔢', nom: 'En chiffres', page: '/',
    champs: [
      { type: 'liste', chemin: 'site.stats', label: 'Chiffres clés', singulier: 'chiffre', titreItem: 'label',
        sousChamps: [
          { type: 'nombre', cle: 'valeur', label: 'Valeur' },
          { type: 'texte', cle: 'suffixe', label: 'Suffixe (+, %, k…)' },
          { type: 'texte', cle: 'label', label: 'Légende' },
        ]},
    ]},
  { id: 'competences', em: '🧰', nom: 'Boîte à outils', page: '/',
    champs: [
      { type: 'liste-texte', chemin: 'competences.competences', label: 'Compétences', singulier: 'compétence',
        aide: 'Astuce : une pastille contenant « échecs » devient l\'easter egg CH 64.' },
    ]},

  { groupe: 'Pages' },
  { id: 'projets', em: '📺', nom: 'Projets', page: '/projets/',
    sousTitre: 'Les 3 premiers apparaissent aussi « À la une » sur l\'accueil.',
    champs: [
      { type: 'liste', chemin: 'projets.projets', label: 'Projets', singulier: 'projet', titreItem: 'titre',
        sousChamps: [
          { type: 'texte', cle: 'emoji', label: 'Emoji du visuel' },
          { type: 'select', cle: 'couleur', label: 'Couleur du visuel', options: ['jaune', 'rouge', 'blanc'] },
          { type: 'texte', cle: 'categorie', label: 'Catégorie (sert aux filtres)' },
          { type: 'texte', cle: 'tag', label: 'Étiquette' },
          { type: 'texte', cle: 'titre', label: 'Titre' },
          { type: 'long', cle: 'description', label: 'Description' },
          { type: 'texte', cle: 'role', label: 'Fiche TV : rôle' },
          { type: 'texte', cle: 'outils', label: 'Fiche TV : outils' },
          { type: 'long', cle: 'resultat', label: 'Fiche TV : résultat' },
          { type: 'texte', cle: 'lien', label: 'Lien (vide = pas de bouton)' },
        ]},
    ]},
  { id: 'parcours', em: '📍', nom: 'Parcours', page: '/parcours/',
    champs: [
      { type: 'texte', chemin: 'parcours.voie', label: 'Panneau : voie' },
      { type: 'texte', chemin: 'parcours.etat', label: 'Panneau : état', aide: 'Ex : A L\'HEURE, RETARDÉ, SUPPRIMÉ (si tu oses).' },
      { type: 'liste', chemin: 'parcours.parcours', label: 'Étapes (gares)', singulier: 'étape', titreItem: 'titre',
        sousChamps: [
          { type: 'texte', cle: 'annee', label: 'Année(s), ex : 2025-26' },
          { type: 'select', cle: 'type', label: 'Type', options: ['travail', 'ecole'] },
          { type: 'texte', cle: 'titre', label: 'Titre' },
          { type: 'long', cle: 'description', label: 'Description' },
          { type: 'liste-texte-imbriquee', cle: 'faits', label: 'Faits concrets (pastilles)' },
        ]},
      { type: 'texte', chemin: 'parcours.destination.titre', label: 'Prochaine destination : titre' },
      { type: 'long', chemin: 'parcours.destination.texte', label: 'Prochaine destination : texte' },
      { type: 'texte', chemin: 'parcours.destination.lien_texte', label: 'Prochaine destination : texte du lien' },
    ]},
  { id: 'contact', em: '✉️', nom: 'Contact', page: '/contact/',
    champs: [
      { type: 'texte', chemin: 'site.titre_contact', label: 'Titre de la page' },
      { type: 'texte', chemin: 'site.lien_linkedin', label: 'Lien LinkedIn' },
      { type: 'texte', chemin: 'site.lien_cv', label: 'Lien du CV (PDF)' },
      { type: 'liste', chemin: 'site.faq', label: 'FAQ', singulier: 'question', titreItem: 'question',
        sousChamps: [
          { type: 'texte', cle: 'question', label: 'Question' },
          { type: 'long', cle: 'reponse', label: 'Réponse' },
        ]},
    ]},
];

/* =====================================================================
   OUTILS : accès par chemin, état, brouillon
   ===================================================================== */
const lireChemin = (obj, chemin) =>
  chemin.split('.').reduce((o, c) => (o == null ? o : o[c]), obj);
function ecrireChemin(obj, chemin, valeur) {
  const parts = chemin.split('.');
  const fin = parts.pop();
  const cible = parts.reduce((o, c) => (o[c] = o[c] ?? {}), obj);
  cible[fin] = valeur;
}
const clone = o => JSON.parse(JSON.stringify(o));
const modifie = () => JSON.stringify(etat) !== JSON.stringify(original);

let minuterieApercu;
function sauver() {
  localStorage.setItem(CLE_BROUILLON, JSON.stringify(etat));
  localStorage.setItem(CLE_APERCU, JSON.stringify(etat));
  document.getElementById('etat-brouillon').textContent =
    modifie() ? '● Brouillon non publié' : 'Aucune modification';
  document.getElementById('etat-brouillon').classList.toggle('modifie', modifie());
  clearTimeout(minuterieApercu);
  minuterieApercu = setTimeout(rechargerApercu, 500);
}
function rechargerApercu() {
  const f = document.getElementById('iframe-apercu');
  f.src = f.src.split('#')[0]; // recharge la même page
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 2400);
}

/* =====================================================================
   RENDU : navigation des blocs
   ===================================================================== */
function rendreNav() {
  const nav = document.getElementById('nav-blocs');
  nav.innerHTML = BLOCS.map(b => b.groupe
    ? `<h2>${b.groupe}</h2>`
    : `<button class="bloc-btn${b.id === blocActif ? ' actif' : ''}" data-bloc="${b.id}">
         <span class="em">${b.em}</span> ${b.nom}
       </button>`).join('');
  nav.querySelectorAll('.bloc-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      blocActif = btn.dataset.bloc;
      const bloc = BLOCS.find(b => b.id === blocActif);
      if (bloc.page) allerPage(bloc.page);
      rendreNav(); rendreEdition();
    }));
}

/* =====================================================================
   RENDU : panneau d'édition (généré depuis le schéma)
   ===================================================================== */
function rendreEdition() {
  const bloc = BLOCS.find(b => b.id === blocActif);
  const zone = document.getElementById('edition');
  zone.innerHTML = `<h1>${bloc.em} ${bloc.nom}</h1>
    <p class="sous-titre">${bloc.sousTitre || 'Chaque changement s\'affiche en live à droite.'}</p>`;
  bloc.champs.forEach(ch => zone.appendChild(rendreChamp(ch)));
}

function rendreChamp(ch) {
  const wrap = document.createElement('div');
  wrap.className = 'champ';

  /* ---------- champs simples liés à un chemin ---------- */
  if (['texte', 'long', 'nombre', 'couleur', 'image', 'select'].includes(ch.type)) {
    const val = lireChemin(etat, ch.chemin) ?? '';
    wrap.innerHTML = `<label>${ch.label}</label>`;

    if (ch.type === 'couleur') {
      wrap.classList.add('champ-couleur');
      wrap.insertAdjacentHTML('beforeend',
        `<div class="rang-couleur">
           <input type="color" value="${val}">
           <input type="text" value="${val}" spellcheck="false">
         </div>`);
      const [pick, txt] = wrap.querySelectorAll('input');
      const maj = v => { ecrireChemin(etat, ch.chemin, v); pick.value = /^#[0-9a-f]{6}$/i.test(v) ? v : pick.value; txt.value = v; sauver(); };
      pick.addEventListener('input', () => maj(pick.value));
      txt.addEventListener('input', () => maj(txt.value.trim()));

    } else if (ch.type === 'image') {
      wrap.classList.add('champ-image');
      wrap.insertAdjacentHTML('beforeend', `
        <img class="apercu-img${val ? ' ok' : ''}" src="${val}" alt="">
        <div class="rang-img">
          <input type="text" value="${val}" placeholder="/images/…" spellcheck="false">
          <button class="btn btn-mini" type="button">📁 Fichier</button>
        </div>
        <input type="file" accept="image/*">
        <p class="aide">Chemin vers /images/… ou fichier direct (intégré au JSON en base64, garde-le léger, &lt; 300 Ko).
        Pour un nouveau fichier dans /images/, ajoute-le au dépôt au moment du commit.</p>`);
      const img = wrap.querySelector('img');
      const txt = wrap.querySelector('input[type=text]');
      const fichier = wrap.querySelector('input[type=file]');
      const maj = v => { ecrireChemin(etat, ch.chemin, v); img.src = v; img.classList.toggle('ok', !!v); sauver(); };
      txt.addEventListener('input', () => maj(txt.value.trim()));
      wrap.querySelector('button').addEventListener('click', () => fichier.click());
      fichier.addEventListener('change', () => {
        const f = fichier.files[0];
        if (!f) return;
        if (f.size > 400 * 1024 && !confirm('Image lourde (' + Math.round(f.size / 1024) + ' Ko), elle sera intégrée telle quelle au JSON. Continuer ?')) return;
        const r = new FileReader();
        r.onload = () => { txt.value = '(fichier intégré)'; maj(r.result); };
        r.readAsDataURL(f);
      });

    } else if (ch.type === 'select') {
      wrap.insertAdjacentHTML('beforeend',
        `<select>${ch.options.map(o => `<option${o === val ? ' selected' : ''}>${o}</option>`).join('')}</select>`);
      wrap.querySelector('select').addEventListener('change', e => { ecrireChemin(etat, ch.chemin, e.target.value); sauver(); });

    } else {
      const champ = ch.type === 'long'
        ? `<textarea rows="4">${String(val).replace(/</g, '&lt;')}</textarea>`
        : `<input type="${ch.type === 'nombre' ? 'number' : 'text'}" value="${String(val).replace(/"/g, '&quot;')}" spellcheck="false">`;
      wrap.insertAdjacentHTML('beforeend', champ);
      wrap.querySelector('input,textarea').addEventListener('input', e => {
        ecrireChemin(etat, ch.chemin, ch.type === 'nombre' ? Number(e.target.value) : e.target.value);
        sauver();
      });
    }
    if (ch.aide) wrap.insertAdjacentHTML('beforeend', `<p class="aide">${ch.aide}</p>`);
    return wrap;
  }

  /* ---------- liste de textes simples ---------- */
  if (ch.type === 'liste-texte') {
    wrap.innerHTML = `<label>${ch.label}</label>`;
    if (ch.aide) wrap.insertAdjacentHTML('beforeend', `<p class="aide">${ch.aide}</p>`);
    const conteneur = document.createElement('div');
    wrap.appendChild(conteneur);
    const liste = () => lireChemin(etat, ch.chemin) || [];
    const rendre = () => {
      conteneur.innerHTML = '';
      liste().forEach((v, i) => conteneur.appendChild(itemSimple(v, i, ch, rendre)));
      const add = document.createElement('button');
      add.className = 'btn btn-mini ajouter';
      add.textContent = '+ Ajouter';
      add.addEventListener('click', () => { liste().push(''); sauver(); rendre(); });
      conteneur.appendChild(add);
    };
    rendre();
    return wrap;
  }

  /* ---------- liste d'objets ---------- */
  if (ch.type === 'liste') {
    wrap.innerHTML = `<label>${ch.label}</label>`;
    const conteneur = document.createElement('div');
    wrap.appendChild(conteneur);
    const liste = () => lireChemin(etat, ch.chemin) || [];
    const rendre = () => {
      conteneur.innerHTML = '';
      liste().forEach((obj, i) => conteneur.appendChild(itemObjet(obj, i, ch, rendre)));
      const add = document.createElement('button');
      add.className = 'btn btn-mini ajouter';
      add.textContent = '+ Ajouter ' + (ch.singulier ? 'un(e) ' + ch.singulier : '');
      add.addEventListener('click', () => {
        const neuf = {};
        ch.sousChamps.forEach(sc => neuf[sc.cle] = sc.type === 'liste-texte-imbriquee' ? [] : (sc.options ? sc.options[0] : ''));
        liste().push(neuf); sauver(); rendre();
      });
      conteneur.appendChild(add);
    };
    rendre();
    return wrap;
  }

  /* ---------- ordre + visibilité des sections de l'accueil ---------- */
  if (ch.type === 'sections') {
    wrap.innerHTML = `<label>${ch.label}</label>`;
    const conteneur = document.createElement('div');
    conteneur.className = 'section-ordre';
    wrap.appendChild(conteneur);
    const rendre = () => {
      conteneur.innerHTML = '';
      const ordre = etat.site.ordre_accueil;
      const masques = etat.site.masquer || (etat.site.masquer = []);
      ordre.forEach((id, i) => {
        const el = document.createElement('div');
        el.className = 'item' + (masques.includes(id) ? ' cache' : '');
        el.draggable = true;
        el.innerHTML = `
          <div class="item-tete">
            <span class="poignee">⠿</span>
            <span class="titre-item">${SECTIONS_ACCUEIL[id] || id}</span>
            <div class="item-actions">
              <span class="oeil" title="Afficher / masquer">${masques.includes(id) ? '🙈' : '👁'}</span>
              <button class="btn btn-mini" data-m="-1" title="Monter">↑</button>
              <button class="btn btn-mini" data-m="1" title="Descendre">↓</button>
            </div>
          </div>`;
        brancherGlisser(el, conteneur, ordre, i, rendre);
        el.querySelector('.oeil').addEventListener('click', () => {
          const p = masques.indexOf(id);
          p >= 0 ? masques.splice(p, 1) : masques.push(id);
          sauver(); rendre();
        });
        el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
          const j = i + Number(b.dataset.m);
          if (j < 0 || j >= ordre.length) return;
          [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
          sauver(); rendre();
        }));
        conteneur.appendChild(el);
      });
    };
    rendre();
    return wrap;
  }

  return wrap;
}

/* ---------- item de liste de textes ---------- */
function itemSimple(valeur, i, ch, rerendre) {
  const liste = () => lireChemin(etat, ch.chemin);
  const el = document.createElement('div');
  el.className = 'item';
  el.draggable = true;
  el.innerHTML = `
    <div class="item-tete">
      <span class="poignee">⠿</span>
      <span class="titre-item">${(ch.singulier || 'item')} ${i + 1}</span>
      <div class="item-actions">
        <button class="btn btn-mini" data-a="haut" title="Monter">↑</button>
        <button class="btn btn-mini" data-a="bas" title="Descendre">↓</button>
        <button class="btn btn-mini" data-a="sup" title="Supprimer">✕</button>
      </div>
    </div>
    <div class="champ"><input type="text" value="${String(valeur).replace(/"/g, '&quot;')}" spellcheck="false"></div>`;
  el.querySelector('input').addEventListener('input', e => { liste()[i] = e.target.value; sauver(); });
  el.querySelector('[data-a=sup]').addEventListener('click', () => { liste().splice(i, 1); sauver(); rerendre(); });
  el.querySelectorAll('[data-a=haut],[data-a=bas]').forEach(b => b.addEventListener('click', () => {
    const j = i + (b.dataset.a === 'haut' ? -1 : 1);
    if (j < 0 || j >= liste().length) return;
    const l = liste(); [l[i], l[j]] = [l[j], l[i]];
    sauver(); rerendre();
  }));
  brancherGlisser(el, el.parentElement, null, i, rerendre, liste);
  return el;
}

/* ---------- item de liste d'objets ---------- */
function itemObjet(obj, i, ch, rerendre) {
  const liste = () => lireChemin(etat, ch.chemin);
  const el = document.createElement('div');
  el.className = 'item';
  el.draggable = true;
  const titre = obj[ch.titreItem] || `${ch.singulier || 'item'} ${i + 1}`;
  el.innerHTML = `
    <div class="item-tete">
      <span class="poignee">⠿</span>
      <span class="titre-item">${String(titre).replace(/</g, '&lt;')}</span>
      <div class="item-actions">
        <button class="btn btn-mini" data-a="haut" title="Monter">↑</button>
        <button class="btn btn-mini" data-a="bas" title="Descendre">↓</button>
        <button class="btn btn-mini" data-a="dup" title="Dupliquer">⧉</button>
        <button class="btn btn-mini" data-a="sup" title="Supprimer">✕</button>
      </div>
    </div>`;
  ch.sousChamps.forEach(sc => {
    const c = document.createElement('div');
    c.className = 'champ';
    c.innerHTML = `<label>${sc.label}</label>`;
    const v = obj[sc.cle] ?? '';
    if (sc.type === 'long') {
      c.insertAdjacentHTML('beforeend', `<textarea rows="3">${String(v).replace(/</g, '&lt;')}</textarea>`);
      c.querySelector('textarea').addEventListener('input', e => { obj[sc.cle] = e.target.value; sauver(); });
    } else if (sc.type === 'select') {
      c.insertAdjacentHTML('beforeend', `<select>${sc.options.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`);
      c.querySelector('select').addEventListener('change', e => { obj[sc.cle] = e.target.value; sauver(); });
    } else if (sc.type === 'nombre') {
      c.insertAdjacentHTML('beforeend', `<input type="number" value="${v}">`);
      c.querySelector('input').addEventListener('input', e => { obj[sc.cle] = Number(e.target.value); sauver(); });
    } else if (sc.type === 'liste-texte-imbriquee') {
      obj[sc.cle] = obj[sc.cle] || [];
      const zone = document.createElement('div');
      const rendreFaits = () => {
        zone.innerHTML = '';
        obj[sc.cle].forEach((f, j) => {
          const rang = document.createElement('div');
          rang.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
          rang.innerHTML = `<input type="text" value="${String(f).replace(/"/g, '&quot;')}" style="flex:1" spellcheck="false">
                            <button class="btn btn-mini" type="button">✕</button>`;
          rang.querySelector('input').addEventListener('input', e => { obj[sc.cle][j] = e.target.value; sauver(); });
          rang.querySelector('button').addEventListener('click', () => { obj[sc.cle].splice(j, 1); sauver(); rendreFaits(); });
          zone.appendChild(rang);
        });
        const add = document.createElement('button');
        add.className = 'btn btn-mini ajouter'; add.type = 'button'; add.textContent = '+';
        add.addEventListener('click', () => { obj[sc.cle].push(''); sauver(); rendreFaits(); });
        zone.appendChild(add);
      };
      rendreFaits();
      c.appendChild(zone);
    } else {
      c.insertAdjacentHTML('beforeend', `<input type="text" value="${String(v).replace(/"/g, '&quot;')}" spellcheck="false">`);
      c.querySelector('input').addEventListener('input', e => {
        obj[sc.cle] = e.target.value;
        if (sc.cle === ch.titreItem) el.querySelector('.titre-item').textContent = e.target.value || `${ch.singulier} ${i + 1}`;
        sauver();
      });
    }
    el.appendChild(c);
  });
  el.querySelector('[data-a=dup]').addEventListener('click', () => { liste().splice(i + 1, 0, clone(obj)); sauver(); rerendre(); });
  el.querySelectorAll('[data-a=haut],[data-a=bas]').forEach(b => b.addEventListener('click', () => {
    const j = i + (b.dataset.a === 'haut' ? -1 : 1);
    if (j < 0 || j >= liste().length) return;
    const l = liste(); [l[i], l[j]] = [l[j], l[i]];
    sauver(); rerendre();
  }));
  el.querySelector('[data-a=sup]').addEventListener('click', () => {
    if (confirm('Supprimer « ' + titre + ' » ?')) { liste().splice(i, 1); sauver(); rerendre(); }
  });
  brancherGlisser(el, el.parentElement, null, i, rerendre, liste);
  return el;
}

/* ---------- glisser-déposer pour réordonner ---------- */
let glisseIndex = null;
function brancherGlisser(el, conteneur, tableauDirect, i, rerendre, getListe) {
  el.addEventListener('dragstart', () => { glisseIndex = i; el.classList.add('glisse'); });
  el.addEventListener('dragend', () => el.classList.remove('glisse'));
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => {
    e.preventDefault();
    if (glisseIndex === null || glisseIndex === i) return;
    const liste = tableauDirect || getListe();
    const [pris] = liste.splice(glisseIndex, 1);
    liste.splice(i, 0, pris);
    glisseIndex = null;
    sauver(); rerendre();
  });
}

/* =====================================================================
   APERÇU : pages, mobile, rechargement
   ===================================================================== */
function allerPage(page) {
  document.getElementById('iframe-apercu').src = page + '?studio=1';
  document.querySelectorAll('#pages-apercu .btn').forEach(b =>
    b.classList.toggle('btn-jaune', b.dataset.page === page));
}
document.querySelectorAll('#pages-apercu .btn').forEach(b =>
  b.addEventListener('click', () => allerPage(b.dataset.page)));
document.getElementById('btn-mobile').addEventListener('click', e => {
  const cadre = document.getElementById('apercu-cadre');
  cadre.classList.toggle('mobile');
  e.target.classList.toggle('btn-jaune');
});
document.getElementById('btn-recharger').addEventListener('click', rechargerApercu);

/* =====================================================================
   EXPORT / PUBLICATION
   ===================================================================== */
function telecharger(nom, contenu) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  a.download = nom + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
document.getElementById('btn-exporter').addEventListener('click', () => {
  const zone = document.getElementById('liste-export');
  zone.innerHTML = FICHIERS.map(f => {
    const change = JSON.stringify(etat[f]) !== JSON.stringify(original[f]);
    return `<div class="fichier-export">
      <span class="nom">content/${f}.json</span>
      <span class="puce ${change ? 'modif' : 'intact'}">${change ? 'modifié' : 'inchangé'}</span>
      <button class="btn btn-mini${change ? ' btn-jaune' : ''}" data-f="${f}">⬇</button>
    </div>`;
  }).join('');
  zone.querySelectorAll('[data-f]').forEach(b =>
    b.addEventListener('click', () => telecharger(b.dataset.f, JSON.stringify(etat[b.dataset.f], null, 2))));
  document.getElementById('voile-export').classList.add('ouvert');
});
document.getElementById('btn-tout-telecharger').addEventListener('click', () =>
  FICHIERS.filter(f => JSON.stringify(etat[f]) !== JSON.stringify(original[f]))
    .forEach((f, i) => setTimeout(() => telecharger(f, JSON.stringify(etat[f], null, 2)), i * 300)));
document.getElementById('btn-fermer-export').addEventListener('click', () =>
  document.getElementById('voile-export').classList.remove('ouvert'));

document.getElementById('btn-annuler').addEventListener('click', () => {
  if (!confirm('Abandonner toutes les modifications non publiées ?')) return;
  etat = clone(original);
  localStorage.removeItem(CLE_BROUILLON);
  localStorage.removeItem(CLE_APERCU);
  localStorage.setItem(CLE_BASE, JSON.stringify(original));
  document.getElementById('etat-brouillon').textContent = 'Aucune modification';
  document.getElementById('etat-brouillon').classList.remove('modifie');
  rendreEdition(); rechargerApercu();
  toast('Brouillon effacé, retour au contenu publié');
});

/* =====================================================================
   DÉMARRAGE
   ===================================================================== */
(async () => {
  const charges = await Promise.all(FICHIERS.map(f =>
    fetch('/content/' + f + '.json').then(r => r.json())));
  FICHIERS.forEach((f, i) => original[f] = charges[i]);

  let brouillon = localStorage.getItem(CLE_BROUILLON);
  /* le site publié a-t-il changé depuis le début de ce brouillon ? */
  if (brouillon) {
    const base = localStorage.getItem(CLE_BASE);
    if (base && base !== JSON.stringify(original)) {
      const garder = confirm(
        "⚠ Le contenu publié du site a changé depuis ce brouillon.\n\n" +
        "OK : garder mon brouillon (il écrasera les changements publiés à l'export)\n" +
        "Annuler : repartir du contenu publié (le brouillon est abandonné)");
      if (!garder) {
        localStorage.removeItem(CLE_BROUILLON);
        localStorage.removeItem(CLE_APERCU);
        brouillon = null;
      }
    }
  }
  if (!brouillon) localStorage.setItem(CLE_BASE, JSON.stringify(original));
  etat = brouillon ? JSON.parse(brouillon) : clone(original);
  /* garanties de structure pour les anciens brouillons */
  etat.site.theme = etat.site.theme || clone(original.site.theme || {});
  etat.site.ordre_accueil = etat.site.ordre_accueil || ['ce-que-je-fais', 'a-la-une', 'chiffres', 'competences'];
  etat.site.masquer = etat.site.masquer || [];

  localStorage.setItem(CLE_APERCU, JSON.stringify(etat));
  rendreNav();
  rendreEdition();
  document.getElementById('etat-brouillon').textContent =
    modifie() ? '● Brouillon non publié' : 'Aucune modification';
  document.getElementById('etat-brouillon').classList.toggle('modifie', modifie());
  if (brouillon && modifie()) toast('Brouillon précédent restauré');
})();
