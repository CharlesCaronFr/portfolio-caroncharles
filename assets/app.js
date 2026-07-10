
/* ===== Utilitaire : échapper le HTML des contenus ===== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ===== Chargement des contenus (multi-pages : chaque bloc est optionnel) ===== */
async function charger() {
  const besoin = {
    hero:        !!document.getElementById('nom'),
    projets:     !!document.getElementById('grille-projets'),
    competences: !!document.getElementById('grille-comp'),
    parcours:    !!document.getElementById('liste-parcours'),
    stats:       !!document.getElementById('grille-stats'),
    contact:     !!document.getElementById('mail')
  };

  /* Mode Studio : quand la page est ouverte avec ?studio=1 (aperçu de l'admin),
     les contenus viennent du brouillon localStorage au lieu des fichiers publiés */
  let brouillon = null;
  try {
    if (new URLSearchParams(location.search).has('studio'))
      brouillon = JSON.parse(localStorage.getItem('studio-contenus') || 'null');
  } catch (e) {}
  const lire = nom => (brouillon && brouillon[nom])
    ? Promise.resolve(brouillon[nom])
    : fetch('/content/' + nom + '.json').then(r => r.json());

  const [site, projets, competences, parcours] = await Promise.all([
    lire('site'),
    lire('projets'), // partout : la TV zappe sur toutes les pages
    besoin.competences ? lire('competences') : Promise.resolve(null),
    besoin.parcours ? lire('parcours') : Promise.resolve(null)
  ]);

  /* --- Thème : couleurs pilotées par site.json --- */
  if (site.theme) Object.entries(site.theme).forEach(([k, v]) =>
    document.documentElement.style.setProperty('--' + k, v));

  /* --- Blocs de l'accueil : ordre et visibilité pilotés par site.json --- */
  const ancre = document.querySelector('.tv-overlay');
  if (Array.isArray(site.ordre_accueil) && document.getElementById('ce-que-je-fais') && ancre)
    site.ordre_accueil.forEach(id => {
      const bloc = document.getElementById(id);
      if (bloc) document.body.insertBefore(bloc, ancre);
    });
  if (Array.isArray(site.masquer))
    site.masquer.forEach(id => {
      const bloc = document.getElementById(id);
      if (bloc) bloc.style.display = 'none';
    });

  /* --- Hero (accueil) --- */
  if (besoin.hero) {
    document.getElementById('eyebrow').textContent = site.eyebrow;
    document.getElementById('intro').innerHTML = site.intro; // HTML autorisé (strong)
    document.getElementById('badge-texte').textContent = site.badge_texte;

    const lignes = document.querySelectorAll('#nom .ligne');
    [site.nom_ligne1, site.nom_ligne2].forEach((txt, li) => {
      [...(txt || '')].forEach((c, i) => {
        const s = document.createElement('span');
        s.className = 'lettre';
        s.textContent = c;
        s.style.animationDelay = (li * 0.35 + i * 0.06) + 's';
        lignes[li].appendChild(s);
      });
    });

    if (site.photo) {
      document.getElementById('photo').src = site.photo;
      document.getElementById('hero-photo').style.display = '';
    }
  }

  /* --- Ticker (toutes les pages) --- */
  const ticker = document.getElementById('ticker');
  if (ticker && Array.isArray(site.ticker) && site.ticker.length) {
    const sequence = site.ticker.map(t =>
      `<span>${esc(t)}</span><span class="dot">●</span>`).join('');

    const construire = () => {
      /* une copie doit couvrir au moins la largeur de l'écran,
         sinon le retour à -50% laisse un trou ou semble figé */
      ticker.style.animation = 'none';
      ticker.innerHTML = sequence;
      const largeurConteneur = ticker.parentElement.offsetWidth || innerWidth;
      let copie = sequence, garde = 0;
      while (ticker.scrollWidth < largeurConteneur && garde++ < 30) {
        copie += sequence;
        ticker.innerHTML = copie;
      }
      ticker.innerHTML = copie + copie;               // x2 pour la boucle sans couture
      ticker.style.animation = '';                    // on rend la main à la classe CSS…
      void ticker.offsetWidth;                        // …en forçant un redémarrage propre
      /* …puis on impose une vitesse constante : 70 px/s quelle que soit la longueur */
      ticker.style.animationDuration = (ticker.scrollWidth / 2 / 70).toFixed(2) + 's';
    };

    construire();
    /* les largeurs changent quand la police arrive ou à la rotation d'écran */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(construire);
    let attenteResize;
    addEventListener('resize', () => {
      clearTimeout(attenteResize);
      attenteResize = setTimeout(construire, 250);
    });
  }

  /* --- Projets --- */
  listeProjets = projets.projets;
  const carteHTML = (p, i) => `
    <article class="carte" data-index="${i}" tabindex="0" role="button"
             aria-label="Ouvrir le projet ${esc(p.titre)}">
      <div class="visuel ${esc(p.couleur)}">${esc(p.emoji)}</div>
      <div class="carte-tete"><span>${esc(p.categorie)}</span><span class="tag">${esc(p.tag)}</span></div>
      <h3>${esc(p.titre)}</h3>
      <p>${esc(p.description)}</p>
    </article>`;
  if (besoin.projets) {
    document.getElementById('grille-projets').innerHTML = listeProjets.map(carteHTML).join('');
    initFiltres();
  }

  /* --- Accueil : offres "Ce que je fais" (le HTML de la page sert de secours) --- */
  const grilleOffres = document.querySelector('.grille-offres');
  if (grilleOffres && Array.isArray(site.offres) && site.offres.length)
    grilleOffres.innerHTML = site.offres.map(o => `
      <article class="offre">
        <div class="offre-emoji" aria-hidden="true">${esc(o.emoji)}</div>
        <h3>${esc(o.titre)}</h3>
        <p>${esc(o.texte)}</p>
      </article>`).join('');

  /* --- Accueil : teaser "à la une" (3 premiers projets, cliquables vers la TV) --- */
  const teaser = document.getElementById('grille-teaser');
  if (teaser) teaser.innerHTML = listeProjets.slice(0, 3).map(carteHTML).join('');

  /* --- Compétences --- */
  if (besoin.competences) {
    document.getElementById('grille-comp').innerHTML =
      competences.competences.map(c => `<span class="pastille">${esc(c)}</span>`).join('');

    /* Tamponnage en cascade quand la boîte à outils entre à l'écran */
    const grilleComp = document.getElementById('grille-comp');
    grilleComp.classList.add('prete');
    const obsComp = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        obsComp.unobserve(e.target);
        grilleComp.querySelectorAll('.pastille').forEach((p, i) => {
          p.style.setProperty('--rot', (Math.random() * 7 - 3.5).toFixed(1) + 'deg');
          setTimeout(() => {
            p.classList.add('tamponnee');
            if (i % 3 === 0) { try { sons.flap(); } catch (err) {} }
          }, i * 55);
        });
      });
    }, { threshold: 0.25 });
    obsComp.observe(grilleComp);

    /* Easter egg : la pastille Échecs ouvre la chaîne CH 64 */
    document.querySelectorAll('#grille-comp .pastille').forEach(p => {
      const t = p.textContent.toLowerCase();
      if (!t.includes('échecs') && !t.includes('echecs')) return;
      p.classList.add('pastille-echecs');
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', "Jouer aux échecs contre l'IA");
      p.addEventListener('click', () => ouvrirTV(-2, p));
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirTV(-2, p); }
      });
    });
  }

  /* --- Parcours --- */
  if (besoin.parcours) {
    document.getElementById('liste-parcours').innerHTML =
      parcours.parcours.map((p, i) => {
        const type = p.type === 'travail' ? 'travail' : 'ecole';
        const cote = i % 2 ? 'droite' : 'gauche';
        const badge = type === 'travail' ? '💼 Expérience' : '🎓 École';
        return `
        <div class="parcours-item ${type} ${cote}">
          <div>
            <div class="annee">${esc(p.annee)}</div>
            <span class="type-badge">${badge}</span>
          </div>
          <div>
            <h3>${esc(p.titre)}</h3><p>${esc(p.description)}</p>
            ${(p.faits && p.faits.length) ? `<ul class="faits">${p.faits.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          </div>
        </div>`;
      }).join('');
    initTrain();
    initGareBoard(parcours.parcours);

    const voie = document.getElementById('gare-voie');
    if (voie && parcours.voie) voie.textContent = parcours.voie;
    const etat = document.getElementById('gare-etat');
    if (etat && parcours.etat) etat.textContent = parcours.etat;

    const dest = document.querySelector('.prochaine-dest');
    if (dest && parcours.destination) {
      dest.querySelector('h3').textContent = parcours.destination.titre || '';
      const para = dest.querySelector('p');
      para.innerHTML = esc(parcours.destination.texte || '') +
        ' <a href="/contact/" data-page="Contact">' + esc(parcours.destination.lien_texte || 'Me contacter →') + '</a>';
    }
  }

  /* --- Stats --- */
  if (besoin.stats) {
    const stats = site.stats || [];
    document.getElementById('grille-stats').innerHTML = stats.map(s => `
      <div class="stat">
        <span class="stat-num" data-cible="${Number(s.valeur) || 0}">0${esc(s.suffixe || '')}</span>
        <p>${esc(s.label)}</p>
      </div>`).join('');
    if (!stats.length) document.getElementById('chiffres').style.display = 'none';
  }

  /* --- Contact --- */
  if (besoin.contact) {
    document.getElementById('titre-contact').textContent = site.titre_contact;
    const mail = document.getElementById('mail');
    mail.textContent = site.email;
    mail.href = 'mailto:' + site.email;
    document.getElementById('lien-linkedin').href = site.lien_linkedin;
    document.getElementById('lien-cv').href = site.lien_cv;
    initFAQ(site);
    initCarteVisite(site);
  }

  /* --- Footer (toutes les pages) --- */
  const fg = document.getElementById('footer-gauche');
  if (fg) fg.textContent = site.footer_gauche;
  const fd = document.getElementById('footer-droite');
  if (fd) fd.textContent = site.footer_droite;
  const fmail = document.getElementById('footer-mail');
  if (fmail) { fmail.textContent = site.email; fmail.href = 'mailto:' + site.email; }

  initAnimations();
}

/* ===== Animations ===== */
function initAnimations() {
  /* Apparition des cartes au scroll */
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        e.target.style.animationDelay = (i * 0.1) + 's';
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.carte').forEach(c => obs.observe(c));

  /* Apparition du parcours au scroll (glissé depuis la gauche) */
  const obsParcours = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        e.target.style.animationDelay = (i * 0.12) + 's';
        e.target.classList.add('visible');
        obsParcours.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.parcours-item').forEach(p => obsParcours.observe(p));

  /* Curseur : survols */
  document.querySelectorAll('a, .btn, .pastille, .carte, .tv-fermer, .tv-canal-btn').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
  document.querySelectorAll('.carte, .btn').forEach(el => {
    el.addEventListener('mouseenter', () => sons.survol());
  });
  document.querySelectorAll('.btn, nav a').forEach(el => {
    el.addEventListener('click', () => sons.clic());
  });

  /* Clic sur une carte → ouvrir la TV */
  document.querySelectorAll('.carte').forEach(c => {
    c.addEventListener('click', () => ouvrirTV(+c.dataset.index, c));
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirTV(+c.dataset.index, c); }
    });
  });

  /* Révélation des titres de section au scroll */
  const obsTitres = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('vu'); obsTitres.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.titre-section').forEach(t => obsTitres.observe(t));

  /* Vague périodique sur les lettres du nom */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      const lettres = document.querySelectorAll('#nom .lettre');
      lettres.forEach((l, i) => {
        setTimeout(() => l.classList.add('vague'), i * 45);
        setTimeout(() => l.classList.remove('vague'), i * 45 + 320);
      });
    }, 7000);
  }

  /* Glitch du nom au survol du logo */
  document.querySelector('.logo').addEventListener('mouseenter', () => {
    document.querySelectorAll('#nom .lettre').forEach(l => {   // vide si pas de hero, donc sans effet
      l.style.transition = 'transform .15s';
      l.style.transform = `translate(${(Math.random()*8-4)}px, ${(Math.random()*8-4)}px) rotate(${(Math.random()*10-5)}deg)`;
      setTimeout(() => { l.style.transform = ''; }, 350);
    });
  });
}

/* ===== Fenêtre TV cathodique ===== */
let listeProjets = [];
let canalCourant = 0;
const overlay = document.getElementById('tv-overlay');
const tv = document.getElementById('tv');
const statique = document.getElementById('tv-statique');
let derniereCarte = null;

function remplirTV(index) {
  if (index === -1) { afficherArcade(); return; }
  if (index === -2) { afficherEchecs(); return; }
  masquerArcade();
  masquerEchecs();
  const p = listeProjets[index];
  if (!p) return;
  canalCourant = index;

  document.getElementById('tv-canal').textContent = 'CH ' + String(index + 1).padStart(2, '0');
  const visuel = document.getElementById('tv-visuel');
  visuel.className = 'visuel ' + (p.couleur || 'jaune');
  visuel.textContent = p.emoji || '★';
  document.getElementById('tv-categorie').textContent = p.categorie || '';
  document.getElementById('tv-tag').textContent = p.tag || '';
  document.getElementById('tv-titre').textContent = p.titre || '';
  document.getElementById('tv-description').textContent = p.description || '';

  /* fiche rôle / outils / résultat (masquée si le projet n'en a pas) */
  const fiche = document.getElementById('tv-fiche');
  if (fiche) {
    document.getElementById('tv-role').textContent = p.role || '';
    document.getElementById('tv-outils').textContent = p.outils || '';
    document.getElementById('tv-resultat').textContent = p.resultat || '';
    fiche.classList.toggle('vide', !(p.role || p.outils || p.resultat));
    fiche.querySelectorAll('div').forEach(l =>
      l.style.display = l.querySelector('dd').textContent ? '' : 'none');
  }

  const lien = document.getElementById('tv-lien');
  if (p.lien && p.lien !== '#') { lien.href = p.lien; lien.style.display = 'inline-block'; }
  else { lien.style.display = 'none'; }
}

/* --- Chaîne secrète CH 00 : arcade --- */
function afficherArcade() {
  masquerEchecs();
  canalCourant = -1;
  document.getElementById('tv-canal').textContent = 'CH 00';
  document.querySelector('.tv-contenu').style.display = 'none';
  document.getElementById('tv-arcade').style.display = '';
  document.body.classList.add('arcade-en-cours');   // le curseur custom gêne la raquette
  arcade.start();
}
function masquerArcade() {
  if (document.getElementById('tv-arcade').style.display === 'none') return;
  arcade.stop();
  document.body.classList.remove('arcade-en-cours');
  document.getElementById('tv-arcade').style.display = 'none';
  document.querySelector('.tv-contenu').style.display = '';
}

let fermetures = [];
function ouvrirTV(index, carte) {
  fermetures.forEach(clearTimeout); fermetures = [];   // une réouverture annule l'extinction en cours
  tv.classList.remove('extinction', 'eteint');
  tv.querySelectorAll('.tv-crt-off').forEach(f => f.remove());
  derniereCarte = carte || null;
  remplirTV(index);
  sons.tvOn();
  overlay.classList.add('ouvert');
  tv.classList.remove('eteint');
  tv.classList.add('allume');
  const numOuverture = index === -1 ? 'CH 00' : index === -2 ? 'CH 64' : 'CH ' + String(index + 1).padStart(2, '0');
  setTimeout(() => afficherOSD(numOuverture + ' \u25b8 SIGNAL OK'), 450);
  document.body.style.overflow = 'hidden';
  document.getElementById('tv-fermer').focus();
}

function fermerTV() {
  sons.tvOff();
  masquerArcade();
  masquerEchecs();
  /* extinction CRT : l'image s'écrase en ligne blanche qui se réduit en un point */
  const ecran = tv.querySelector('.tv-ecran');
  const flash = document.createElement('div');
  flash.className = 'tv-crt-off';
  ecran.appendChild(flash);
  tv.classList.add('extinction');
  fermetures.push(setTimeout(() => { tv.classList.remove('allume'); tv.classList.add('eteint'); }, 260));
  fermetures.push(setTimeout(() => {
    overlay.classList.remove('ouvert');
    tv.classList.remove('eteint', 'extinction');
    flash.remove();
    document.body.style.overflow = '';
    if (derniereCarte) derniereCarte.focus();
  }, 660));
}

let zapEnCours = false;
function changerCanal(delta) {
  if (zapEnCours || !listeProjets.length) return;
  zapEnCours = true;
  const total = listeProjets.length + 1;              // + la chaîne arcade
  const v = (canalCourant + 1 + delta + total) % total; // 0 = arcade, 1..n = projets
  const cible = v - 1;
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduit) { remplirTV(cible); zapEnCours = false; return; }

  sons.zap();
  statique.classList.add('actif');           // neige !
  afficherOSD('CH --', true);                 // l'OSD cherche le signal
  setTimeout(() => remplirTV(cible), 140);    // on change de chaîne sous la neige
  setTimeout(() => {
    statique.classList.remove('actif');
    zapEnCours = false;
    const num = cible === -1 ? 'CH 00' : 'CH ' + String(cible + 1).padStart(2, '0');
    afficherOSD(num + ' \u25b8 SIGNAL OK');
    /* saute d'image horizontale, comme un réglage de synchro */
    const ecran = tv.querySelector('.tv-ecran');
    ecran.classList.remove('hold');
    void ecran.offsetWidth;
    ecran.classList.add('hold');
  }, 320);
}

/* OSD vert incrusté en haut à droite de l'écran, comme sur une vraie télé */
let osdChrono = null;
function afficherOSD(texte, cherche) {
  const ecran = tv.querySelector('.tv-ecran');
  let osd = ecran.querySelector('.tv-osd');
  if (!osd) {
    osd = document.createElement('div');
    osd.className = 'tv-osd';
    osd.setAttribute('aria-hidden', 'true');
    ecran.appendChild(osd);
  }
  osd.textContent = texte;
  osd.classList.add('visible');
  clearTimeout(osdChrono);
  if (!cherche) osdChrono = setTimeout(() => osd.classList.remove('visible'), 1500);
}

document.getElementById('tv-fermer').addEventListener('click', fermerTV);
document.getElementById('tv-prec').addEventListener('click', () => changerCanal(-1));
document.getElementById('tv-suiv').addEventListener('click', () => changerCanal(1));
overlay.addEventListener('click', e => { if (e.target === overlay) fermerTV(); });
addEventListener('keydown', e => {
  if (!overlay.classList.contains('ouvert')) return;
  if (e.key === 'Escape') { fermerTV(); return; }
  if (e.key === 'Tab') {                              // le focus reste dans le dialogue
    const focusables = [...tv.querySelectorAll('button, a[href]')].filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    return;
  }
  if (canalCourant === -1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    arcade.clavier(e.key === 'ArrowLeft' ? -1 : 1); // sur CH 00, les flèches pilotent la raquette
    return;
  }
  if (e.key === 'ArrowLeft') changerCanal(-1);
  if (e.key === 'ArrowRight') changerCanal(1);
});

/* Indice du footer → ouvre directement CH 00 */
const footerArcade = document.getElementById('footer-arcade');
if (footerArcade) footerArcade.addEventListener('click', () => ouvrirTV(-1));

/* ===== CH 00 : casse-briques ===== */
const arcade = (() => {
  const canvas = document.getElementById('arcade-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('arcade-score');
  const msgEl = document.getElementById('arcade-msg');
  const COULEURS = ['#FFD400', '#FF3B00', '#2318E0', '#F1EDE2', '#8a8a8a'];

  let raf = null, actif = false, etat = 'attente'; // attente | jeu | fin
  let W, H, dpr, balle, raquette, briques, score;

  function dimensionner() {
    const larg = canvas.parentElement.clientWidth;
    const haut = Math.round(Math.min(420, larg * 0.68));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = larg * dpr; canvas.height = haut * dpr;
    canvas.style.height = haut + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = larg; H = haut;
  }

  function reinitialiser() {
    score = 0;
    scoreEl.textContent = 'SCORE 000';
    raquette = { w: W * 0.2, h: 10, x: W / 2 };
    balle = { x: W / 2, y: H - 40, r: 6, vx: W * 0.005, vy: -W * 0.006 };
    briques = [];
    const cols = 8, lignes = 5, marge = 4, top = 14;
    const bw = (W - marge * (cols + 1)) / cols, bh = 16;
    for (let l = 0; l < lignes; l++)
      for (let c = 0; c < cols; c++)
        briques.push({ x: marge + c * (bw + marge), y: top + l * (bh + marge),
                       w: bw, h: bh, couleur: COULEURS[l % COULEURS.length], vivante: true });
  }

  function dessiner() {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);
    briques.forEach(b => {
      if (!b.vivante) return;
      ctx.fillStyle = b.couleur;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
    ctx.fillStyle = '#F1EDE2';
    ctx.fillRect(raquette.x - raquette.w / 2, H - 20, raquette.w, raquette.h);
    ctx.fillStyle = '#FFD400';
    ctx.fillRect(balle.x - balle.r, balle.y - balle.r, balle.r * 2, balle.r * 2); // balle carrée, pixel oblige
  }

  function avancer() {
    balle.x += balle.vx; balle.y += balle.vy;
    if (balle.x < balle.r || balle.x > W - balle.r) balle.vx *= -1;
    if (balle.y < balle.r) balle.vy *= -1;

    /* raquette */
    const ry = H - 20;
    if (balle.vy > 0 && balle.y + balle.r >= ry && balle.y + balle.r <= ry + raquette.h + 8 &&
        balle.x > raquette.x - raquette.w / 2 - balle.r && balle.x < raquette.x + raquette.w / 2 + balle.r) {
      balle.vy = -Math.abs(balle.vy);
      sons.raquette();
      const decal = (balle.x - raquette.x) / (raquette.w / 2);   // -1 à 1
      balle.vx = decal * W * 0.007;
    }

    /* briques */
    for (const b of briques) {
      if (!b.vivante) continue;
      if (balle.x > b.x - balle.r && balle.x < b.x + b.w + balle.r &&
          balle.y > b.y - balle.r && balle.y < b.y + b.h + balle.r) {
        b.vivante = false;
        balle.vy *= -1;
        sons.brique(Math.round(900 - b.y * 4));
        score++;
        scoreEl.textContent = 'SCORE ' + String(score).padStart(3, '0');
        break;
      }
    }

    if (briques.every(b => !b.vivante)) finir(true);
    else if (balle.y > H + balle.r * 2) finir(false);
  }

  function finir(gagne) {
    etat = 'fin';
    if (gagne) sons.gagne(); else sons.perdu();
    msgEl.innerHTML = (gagne ? '★ Gagné ! ★' : 'Game over') +
      '<br>Score : ' + score + '<br><small>Touche pour rejouer</small>';
    msgEl.classList.remove('cache');
  }

  function boucle() {
    if (!actif) return;
    if (etat === 'jeu') { avancer(); }
    dessiner();
    raf = requestAnimationFrame(boucle);
  }

  function jouer() {
    if (etat === 'jeu') return;
    reinitialiser();
    etat = 'jeu';
    sons.demarrer();
    msgEl.classList.add('cache');
  }

  function bougerVers(clientX) {
    const r = canvas.getBoundingClientRect();
    raquette.x = Math.max(raquette.w / 2, Math.min(W - raquette.w / 2, clientX - r.left));
  }

  canvas.addEventListener('pointermove', e => { if (actif && etat === 'jeu') bougerVers(e.clientX); });
  canvas.addEventListener('pointerdown', e => {
    if (!actif) return;
    if (etat !== 'jeu') jouer();
    else bougerVers(e.clientX);
  });

  return {
    start() {
      if (actif) return;
      actif = true; etat = 'attente';
      msgEl.innerHTML = 'Touche ou clique<br>pour jouer';
      msgEl.classList.remove('cache');
      requestAnimationFrame(() => { dimensionner(); reinitialiser(); dessiner(); boucle(); });
      addEventListener('resize', this._r = () => { if (actif) { dimensionner(); reinitialiser(); etat = 'attente'; msgEl.classList.remove('cache'); } });
    },
    stop() {
      actif = false;
      if (raf) cancelAnimationFrame(raf);
      if (this._r) removeEventListener('resize', this._r);
    },
    clavier(dir) {
      if (!actif) return;
      if (etat !== 'jeu') { jouer(); return; }
      raquette.x = Math.max(raquette.w / 2, Math.min(W - raquette.w / 2, raquette.x + dir * W * 0.06));
    }
  };
})();

/* ===== Curseur custom ===== */
const cursor = document.getElementById('cursor');
let cx = innerWidth/2, cy = innerHeight/2, tx = cx, ty = cy;
addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
(function boucle(){
  cx += (tx - cx) * 0.2;
  cy += (ty - cy) * 0.2;
  cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
  requestAnimationFrame(boucle);
})();

/* ===== CH 64 : echecs contre l'IA (moteur maison, zero librairie) ===== */
const echecs = (() => {
  /* --- Plateau "mailbox" 10x12 : cases valides de 21 a 98 --- */
  const VIDE = '.', HORS = 'x', PROF = 3;
  const DIRS = {
    N: [-21, -19, -12, -8, 8, 12, 19, 21],
    B: [-11, -9, 9, 11],
    R: [-10, -1, 1, 10],
    K: [-11, -10, -9, -1, 1, 9, 10, 11]
  };
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
  /* tables de position (vues cote blanc, rangee 8 en haut) */
  const PST_P = [
    0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
    5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
    5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0];
  const PST_N = [
    -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
    -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
    -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
    -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50];
  const PST_K = [
    -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
    20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];

  let b, trait, roque, ep, nbCoups, fini;

  function nouvelle() {
    b = Array(120).fill(HORS);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[21 + r * 10 + c] = VIDE;
    const fond = 'rnbqkbnr';
    for (let c = 0; c < 8; c++) {
      b[21 + c] = fond[c]; b[31 + c] = 'p';
      b[81 + c] = 'P'; b[91 + c] = fond[c].toUpperCase();
    }
    trait = 'w'; roque = { K: true, Q: true, k: true, q: true };
    ep = 0; nbCoups = 1; fini = null;
  }

  const blanc  = p => p !== VIDE && p !== HORS && p === p.toUpperCase();
  const noir   = p => p !== VIDE && p !== HORS && p === p.toLowerCase();
  const allie  = (p, cl) => cl === 'w' ? blanc(p) : noir(p);
  const ennemi = (p, cl) => cl === 'w' ? noir(p) : blanc(p);

  /* la case m est-elle attaquee par la couleur "par" ? */
  function attaque(m, par) {
    for (const d of (par === 'w' ? [9, 11] : [-9, -11]))
      if (b[m + d] === (par === 'w' ? 'P' : 'p')) return true;
    for (const d of DIRS.N) if (b[m + d] === (par === 'w' ? 'N' : 'n')) return true;
    for (const d of DIRS.K) if (b[m + d] === (par === 'w' ? 'K' : 'k')) return true;
    for (const d of DIRS.B) {
      let s = m + d; while (b[s] === VIDE) s += d;
      const p = b[s];
      if (par === 'w' ? (p === 'B' || p === 'Q') : (p === 'b' || p === 'q')) return true;
    }
    for (const d of DIRS.R) {
      let s = m + d; while (b[s] === VIDE) s += d;
      const p = b[s];
      if (par === 'w' ? (p === 'R' || p === 'Q') : (p === 'r' || p === 'q')) return true;
    }
    return false;
  }
  function roi(cl) {
    const k = cl === 'w' ? 'K' : 'k';
    for (let m = 21; m < 99; m++) if (b[m] === k) return m;
    return -1;
  }

  /* generation des coups pseudo-legaux */
  function pseudo(cl) {
    const L = [];
    const aj = (de, a, extra) => L.push(Object.assign({ de, a, piece: b[de], prise: b[a] }, extra));
    for (let m = 21; m < 99; m++) {
      const p = b[m]; if (!allie(p, cl)) continue;
      const t = p.toUpperCase();
      if (t === 'P') {
        const av = cl === 'w' ? -10 : 10;
        const dep = cl === 'w' ? (m >= 81 && m <= 88) : (m >= 31 && m <= 38);
        const promo = cl === 'w' ? (m + av <= 28) : (m + av >= 91);
        if (b[m + av] === VIDE) {
          aj(m, m + av, promo ? { promo: cl === 'w' ? 'Q' : 'q' } : {});
          if (dep && b[m + 2 * av] === VIDE) aj(m, m + 2 * av, { double: true });
        }
        for (const d of [av - 1, av + 1]) {
          if (ennemi(b[m + d], cl)) aj(m, m + d, promo ? { promo: cl === 'w' ? 'Q' : 'q' } : {});
          else if (ep && m + d === ep) aj(m, m + d, { enPassant: true });
        }
      } else if (t === 'N' || t === 'K') {
        for (const d of DIRS[t]) {
          const c = b[m + d];
          if (c === VIDE || ennemi(c, cl)) aj(m, m + d, {});
        }
        if (t === 'K') {
          if (cl === 'w' && m === 95) {
            if (roque.K && b[96] === VIDE && b[97] === VIDE && b[98] === 'R' &&
                !attaque(95, 'b') && !attaque(96, 'b') && !attaque(97, 'b')) aj(95, 97, { roque: 'K' });
            if (roque.Q && b[94] === VIDE && b[93] === VIDE && b[92] === VIDE && b[91] === 'R' &&
                !attaque(95, 'b') && !attaque(94, 'b') && !attaque(93, 'b')) aj(95, 93, { roque: 'Q' });
          }
          if (cl === 'b' && m === 25) {
            if (roque.k && b[26] === VIDE && b[27] === VIDE && b[28] === 'r' &&
                !attaque(25, 'w') && !attaque(26, 'w') && !attaque(27, 'w')) aj(25, 27, { roque: 'k' });
            if (roque.q && b[24] === VIDE && b[23] === VIDE && b[22] === VIDE && b[21] === 'r' &&
                !attaque(25, 'w') && !attaque(24, 'w') && !attaque(23, 'w')) aj(25, 23, { roque: 'q' });
          }
        }
      } else {
        const dirs = t === 'B' ? DIRS.B : t === 'R' ? DIRS.R : DIRS.K;
        for (const d of dirs) {
          let s = m + d;
          while (b[s] === VIDE) { aj(m, s, {}); s += d; }
          if (ennemi(b[s], cl)) aj(m, s, {});
        }
      }
    }
    return L;
  }

  function jouer(mv) {
    mv.avRoque = { K: roque.K, Q: roque.Q, k: roque.k, q: roque.q };
    mv.avEp = ep;
    b[mv.a] = mv.promo || mv.piece;
    b[mv.de] = VIDE;
    ep = mv.double ? (mv.de + mv.a) / 2 : 0;
    if (mv.enPassant) {
      mv.pionPris = trait === 'w' ? mv.a + 10 : mv.a - 10;
      mv.prisePion = b[mv.pionPris];
      b[mv.pionPris] = VIDE;
    }
    if (mv.roque === 'K') { b[96] = 'R'; b[98] = VIDE; }
    if (mv.roque === 'Q') { b[94] = 'R'; b[91] = VIDE; }
    if (mv.roque === 'k') { b[26] = 'r'; b[28] = VIDE; }
    if (mv.roque === 'q') { b[24] = 'r'; b[21] = VIDE; }
    if (mv.piece === 'K') { roque.K = roque.Q = false; }
    if (mv.piece === 'k') { roque.k = roque.q = false; }
    if (mv.de === 91 || mv.a === 91) roque.Q = false;
    if (mv.de === 98 || mv.a === 98) roque.K = false;
    if (mv.de === 21 || mv.a === 21) roque.q = false;
    if (mv.de === 28 || mv.a === 28) roque.k = false;
    trait = trait === 'w' ? 'b' : 'w';
  }
  function dejouer(mv) {
    trait = trait === 'w' ? 'b' : 'w';
    b[mv.de] = mv.piece; b[mv.a] = mv.prise;
    if (mv.enPassant) { b[mv.pionPris] = mv.prisePion; b[mv.a] = VIDE; }
    if (mv.roque === 'K') { b[98] = 'R'; b[96] = VIDE; }
    if (mv.roque === 'Q') { b[91] = 'R'; b[94] = VIDE; }
    if (mv.roque === 'k') { b[28] = 'r'; b[26] = VIDE; }
    if (mv.roque === 'q') { b[21] = 'r'; b[24] = VIDE; }
    roque = mv.avRoque; ep = mv.avEp;
  }

  function legaux(cl) {
    return pseudo(cl).filter(mv => {
      jouer(mv);
      const ok = !attaque(roi(cl), cl === 'w' ? 'b' : 'w');
      dejouer(mv);
      return ok;
    });
  }
  const enEchec = cl => attaque(roi(cl), cl === 'w' ? 'b' : 'w');

  /* evaluation (positif = avantage blanc) */
  function evaluer() {
    let s = 0;
    for (let m = 21; m < 99; m++) {
      const p = b[m]; if (p === VIDE || p === HORS) continue;
      const t = p.toUpperCase(), w = blanc(p);
      const r = ((m / 10) | 0) - 2, c = m % 10 - 1;
      const i = w ? r * 8 + c : (7 - r) * 8 + c;
      let v = VAL[t];
      if (t === 'P') v += PST_P[i];
      else if (t === 'N') v += PST_N[i];
      else if (t === 'B') v += (PST_N[i] / 2) | 0;
      else if (t === 'K') v += PST_K[i];
      s += w ? v : -v;
    }
    return s;
  }

  const INFINI = 1e9;
  const valPrise = mv => mv.prise !== VIDE ? VAL[mv.prise.toUpperCase()] : (mv.enPassant ? 100 : 0);

  function negamax(prof, alpha, beta, ply) {
    if (prof === 0) return (trait === 'w' ? 1 : -1) * evaluer();
    const L = legaux(trait);
    if (!L.length) return enEchec(trait) ? -100000 + ply : 0;
    L.sort((a, c) => valPrise(c) - valPrise(a));
    for (const mv of L) {
      jouer(mv);
      const v = -negamax(prof - 1, -beta, -alpha, ply + 1);
      dejouer(mv);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function meilleurCoup() {
    const L = legaux(trait);
    if (!L.length) return null;
    /* petit melange pour varier les parties, puis captures en tete */
    for (let i = L.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [L[i], L[j]] = [L[j], L[i]];
    }
    L.sort((a, c) => valPrise(c) - valPrise(a));
    let best = null, bestV = -INFINI, alpha = -INFINI;
    for (const mv of L) {
      jouer(mv);
      const v = -negamax(PROF - 1, -INFINI, -alpha, 1);
      dejouer(mv);
      if (v > bestV) { bestV = v; best = mv; if (v > alpha) alpha = v; }
    }
    return best;
  }

  /* --- Interface --- */
  const plateau = document.getElementById('echecs-plateau');
  const statutEl = document.getElementById('echecs-statut');
  const coupsEl = document.getElementById('echecs-coups');
  const GLYPHE = { P: '\u265F', N: '\u265E', B: '\u265D', R: '\u265C', Q: '\u265B', K: '\u265A' };
  let selection = null, ciblesSel = [], dernier = null, reflexion = false;

  const statut = t => { statutEl.textContent = t; };

  function dessiner() {
    const caseEchec = enEchec(trait) ? roi(trait) : -1;
    plateau.innerHTML = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const m = 21 + r * 10 + c, p = b[m];
      const d = document.createElement('div');
      d.className = 'case' + ((r + c) % 2 ? ' sombre' : '');
      if (selection === m) d.classList.add('sel');
      if (dernier && (dernier.de === m || dernier.a === m)) d.classList.add('dernier');
      const cible = ciblesSel.find(mv => mv.a === m);
      if (cible) d.classList.add(cible.prise !== VIDE || cible.enPassant ? 'prise' : 'cible');
      if (m === caseEchec) d.classList.add('roi-echec');
      if (p !== VIDE) {
        const s = document.createElement('span');
        s.className = blanc(p) ? 'piece-blanc' : 'piece-noir';
        s.textContent = GLYPHE[p.toUpperCase()];
        d.appendChild(s);
      }
      d.addEventListener('click', () => clicCase(m));
      plateau.appendChild(d);
    }
    coupsEl.textContent = 'COUP ' + String(nbCoups).padStart(3, '0');
  }

  function majStatut() {
    if (fini === 'mat') {
      if (trait === 'w') statut('Echec et mat, l\u2019IA gagne');
      else statut('Echec et mat, tu gagnes ! \uD83C\uDFC6');
    } else if (fini === 'pat') statut('Pat : match nul');
    else if (reflexion) statut('L\u2019IA r\u00E9fl\u00E9chit...');
    else if (enEchec('w')) statut('\u00C9chec ! \u00C0 toi de jouer');
    else statut('\u00C0 toi de jouer (blancs)');
  }

  function verifierFin() {
    if (!legaux(trait).length) {
      fini = enEchec(trait) ? 'mat' : 'pat';
      if (fini === 'mat') (trait === 'w' ? sons.perdu() : sons.gagne());
    }
  }

  function appliquer(mv) {
    jouer(mv);
    dernier = mv;
    if (trait === 'w') nbCoups++;
    selection = null; ciblesSel = [];
    if (mv.prise !== VIDE || mv.enPassant) sons.brique(300 + Math.random() * 200);
    else if (mv.roque) sons.gare();
    else sons.clic();
    verifierFin();
    if (!fini && enEchec(trait)) sons.retard();
    dessiner();
    majStatut();
  }

  function clicCase(m) {
    if (fini || reflexion || trait !== 'w') return;
    const cible = ciblesSel.find(mv => mv.a === m);
    if (selection !== null && cible) {
      appliquer(cible);
      if (fini) return;
      reflexion = true;
      majStatut();
      setTimeout(() => {
        const rep = meilleurCoup();
        reflexion = false;
        if (rep) appliquer(rep); else { verifierFin(); dessiner(); majStatut(); }
      }, 350 + Math.random() * 400);
      return;
    }
    if (allie(b[m], 'w')) {
      selection = m;
      ciblesSel = legaux('w').filter(mv => mv.de === m);
      sons.survol();
    } else { selection = null; ciblesSel = []; }
    dessiner();
  }

  document.getElementById('echecs-reset').addEventListener('click', () => {
    nouvelle();
    selection = null; ciblesSel = []; dernier = null; reflexion = false;
    sons.demarrer();
    dessiner(); majStatut();
  });

  nouvelle();
  return {
    afficher() { dessiner(); majStatut(); },
    _dev: { legaux: cl => legaux(cl), jouer, dejouer, nouvelle, meilleurCoup, enEchec, etat: () => ({ trait, fini, ep, roque }) }
  };
})();

/* --- Chaine secrete CH 64 : echecs --- */
function afficherEchecs() {
  masquerArcade();
  canalCourant = -2;
  document.getElementById('tv-canal').textContent = 'CH 64';
  document.querySelector('.tv-contenu').style.display = 'none';
  document.getElementById('tv-echecs').style.display = '';
  echecs.afficher();
}
function masquerEchecs() {
  if (document.getElementById('tv-echecs').style.display === 'none') return;
  document.getElementById('tv-echecs').style.display = 'none';
  document.querySelector('.tv-contenu').style.display = '';
}

/* ===== Sound design : chiptune synthétisé (Web Audio, zéro fichier) ===== */
const sons = (() => {
  let ctx = null, master = null, bufBruit = null;
  let actif = localStorage.getItem('caron-son') !== 'off';

  function init() {
    if (ctx) return;
    if (navigator.audioSession) { try { navigator.audioSession.type = 'transient'; } catch (e) {} }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);
    const n = ctx.sampleRate * 0.5;
    bufBruit = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bufBruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  /* déverrouillage robuste : on réessaie à chaque geste tant que le contexte n'est pas actif,
     et on relance après une suspension (retour d'onglet, appel, verrouillage sur iOS) */
  const unlock = () => {
    init();
    if (ctx.state === 'running') return;
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  };
  ['pointerdown', 'mousedown', 'touchend', 'keydown', 'click'].forEach(evt =>
    document.addEventListener(evt, unlock, { capture: true, passive: true })
  );
  document.addEventListener('visibilitychange', () => {
    if (ctx && document.visibilityState === 'visible' && ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  });

  function pret(cb) {
    if (!actif) return;
    init();
    if (ctx.state === 'running') { cb(); return; }
    const p = ctx.resume();
    if (p && p.then) p.then(() => { if (actif && ctx.state === 'running') cb(); }).catch(() => {});
  }
  function blip(freq, duree = 0.07, type = 'square', vol = 1, glisse = null) {
    pret(() => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t + duree);
    g.gain.setValueAtTime(0.6 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duree);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + duree + 0.02);
    });
  }
  function bruit(duree = 0.2, vol = 1) {
    pret(() => {
    const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    s.buffer = bufBruit; s.loop = true;
    g.gain.setValueAtTime(0.35 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duree);
    s.connect(g); g.connect(master);
    s.start(t); s.stop(t + duree + 0.02);
    });
  }
  function arp(freqs, pas = 0.09, type = 'square') {
    freqs.forEach((f, i) => setTimeout(() => blip(f, pas * 0.95, type), i * pas * 1000));
  }

  return {
    get actif() { return actif; },
    basculer() {
      actif = !actif;
      localStorage.setItem('caron-son', actif ? 'on' : 'off');
      if (actif) { unlock(); arp([523, 659, 880], 0.07); }
      return actif;
    },
    survol()   { blip(1800, 0.025, 'square', 0.4); },
    clic()     { blip(660, 0.05); },
    tvOn()     { bruit(0.12, 0.6); blip(120, 0.3, 'sine', 1, 760); },
    tvOff()    { blip(620, 0.28, 'sine', 1, 70); },
    zap()      { bruit(0.26); },
    demarrer() { arp([880, 1320], 0.08); },
    raquette() { blip(210, 0.04, 'square', 0.7); },
    brique(f)  { blip(f, 0.05, 'square', 0.8); },
    gagne()    { arp([523, 659, 784, 1047], 0.1); },
    perdu()    { arp([392, 294, 220, 131], 0.12); },
    flap()     { blip(1400 + Math.random() * 800, 0.016, 'square', 0.12); },
    vapeur()   { bruit(0.06, 0.5); blip(95, 0.05, 'triangle', 0.5); },
    sifflet()  { blip(740, 0.5, 'triangle', 0.5, 690); blip(1109, 0.5, 'triangle', 0.3, 1035); },
    gare()     { arp([988, 1319, 1760], 0.07); },
    retard()   { arp([494, 415, 349], 0.14, 'triangle'); },
    retro()    { bruit(0.3, 0.5); blip(320, 0.5, 'sine', 1, 70); },
    warp()     { arp([392, 523, 659, 880], 0.055); },
    materialise(){ arp([880, 659, 988], 0.05); }
  };
})();

/* ===== Mire TV : masquage à la fin du chargement ===== */
const mireT0 = Date.now();
function cacherMire() {
  const mire = document.getElementById('mire');
  if (!mire) return;
  if (document.documentElement.classList.contains('px-in')) { mire.remove(); return; } // arrivée pixel : pas de mire
  const attente = Math.max(0, 700 - (Date.now() - mireT0)); // mire visible au moins 700 ms
  setTimeout(() => {
    mire.classList.add('fin');
    setTimeout(() => mire.remove(), 500);
  }, attente);
}

/* ===== Compteurs animés ===== */
function initCompteurs() {
  const nums = document.querySelectorAll('.stat-num');
  if (!nums.length) return;
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const obsNum = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obsNum.unobserve(e.target);
      const cible = +e.target.dataset.cible;
      const suffixe = e.target.textContent.replace(/^0/, '');
      if (reduit) { e.target.textContent = cible + suffixe; return; }

      /* odomètre : une colonne 0-9 par chiffre, qui roule comme un compteur kilométrique */
      const chiffres = String(cible).split('');
      e.target.textContent = '';
      const colonnes = chiffres.map((c, i) => {
        const col = document.createElement('span');
        col.className = 'odo-col';
        const strip = document.createElement('span');
        strip.className = 'odo-strip';
        /* les colonnes de droite font plus de tours complets, comme en mécanique */
        const tours = chiffres.length - i;
        let suite = '';
        for (let t = 0; t <= tours; t++)
          for (let d = 0; d <= 9; d++) suite += `<span class="odo-d">${d}</span>`;
        strip.innerHTML = suite;
        col.appendChild(strip);
        e.target.appendChild(col);
        return { strip, arret: tours * 10 + (+c), delai: i * 90 };
      });
      if (suffixe) {
        const s = document.createElement('span');
        s.className = 'odo-suffixe';
        s.textContent = suffixe;
        e.target.appendChild(s);
      }
      /* départ au frame suivant pour que la transition parte de 0 */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        colonnes.forEach(({ strip, arret, delai }, i) => {
          strip.style.transitionDelay = delai + 'ms';
          strip.style.transform = `translateY(-${arret}em)`;
          strip.addEventListener('transitionend', () => {
            try { sons.flap(); } catch (err) {}          // clac de calage, colonne par colonne
          }, { once: true });
        });
      }));
    });
  }, { threshold: 0.5 });
  nums.forEach(n => obsNum.observe(n));
}

/* ===== Boutons magnétiques ===== */
function initMagnetisme() {
  if (!matchMedia('(hover: hover)').matches ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.btn, nav a, .contact .mail').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ===== Easter egg : mode rétro noir & blanc ===== */
let retroEnCours = false;
function modeRetro() {
  if (retroEnCours) return;
  retroEnCours = true;
  sons.retro();
  const scan = document.getElementById('retro-scan');
  const centre = document.getElementById('badge-centre');
  document.documentElement.classList.add('retro');
  scan.classList.add('actif');
  if (centre) centre.textContent = '📼';
  setTimeout(() => {
    document.documentElement.classList.remove('retro');
    scan.classList.remove('actif');
    if (centre) centre.textContent = '★';
    retroEnCours = false;
  }, 1400);
}

const badge = document.getElementById('badge');
if (badge) {
  badge.addEventListener('click', modeRetro);
  badge.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); modeRetro(); }
  });
  badge.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  badge.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
}

/* ===== Section parcours : la ligne de train ===== */
const TRAIN_SVG = `
<svg id="train" viewBox="0 0 60 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <!-- tender a charbon (arriere) -->
  <rect x="12" y="3" width="36" height="26" rx="4" fill="var(--encre)"/>
  <rect x="18" y="8" width="6" height="6" fill="var(--papier)" opacity=".35"/>
  <rect x="30" y="14" width="6" height="6" fill="var(--papier)" opacity=".35"/>
  <rect x="22" y="20" width="6" height="5" fill="var(--papier)" opacity=".35"/>
  <!-- cabine du mecanicien -->
  <rect x="8" y="31" width="44" height="22" rx="3" fill="var(--rouge)" stroke="var(--encre)" stroke-width="4"/>
  <rect x="19" y="37" width="22" height="10" fill="var(--papier)" stroke="var(--encre)" stroke-width="3"/>
  <!-- chaudiere -->
  <rect x="13" y="53" width="34" height="46" rx="13" fill="var(--encre)"/>
  <rect x="15" y="64" width="30" height="4" fill="var(--jaune)"/>
  <rect x="15" y="80" width="30" height="4" fill="var(--jaune)"/>
  <!-- dome de vapeur -->
  <circle cx="30" cy="72" r="6" fill="var(--jaune)" stroke="var(--encre)" stroke-width="3"/>
  <!-- cheminee (avant) -->
  <circle cx="30" cy="92" r="7.5" fill="var(--encre)" stroke="var(--papier)" stroke-width="3"/>
  <circle cx="30" cy="92" r="2.5" fill="var(--papier)"/>
  <!-- traverse avant et tampons -->
  <rect x="10" y="101" width="40" height="7" fill="var(--rouge)" stroke="var(--encre)" stroke-width="3"/>
  <circle cx="17" cy="108" r="2" fill="var(--encre)"/>
  <circle cx="43" cy="108" r="2" fill="var(--encre)"/>
</svg>`;

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Effet panneau a palettes (split-flap) : les lettres defilent puis se calent */
function splitFlap(el) {
  const fin = el.textContent;
  if (mouvementReduit || !fin.trim() || el.dataset.flap) return;
  el.dataset.flap = '1';
  const chars = [...fin];
  const affiche = chars.map(c => /\s/.test(c) ? c : FLAP_CHARS[Math.random() * FLAP_CHARS.length | 0]);
  const tours = chars.map((c, i) => /\s/.test(c) ? 0 : 3 + Math.min(i, 16) + (Math.random() * 3 | 0));
  el.textContent = affiche.join('');
  let tic = 0;
  const iv = setInterval(() => {
    let fini = true;
    chars.forEach((c, i) => {
      if (tours[i] > 0) {
        tours[i]--; fini = false;
        affiche[i] = tours[i] === 0 ? c : FLAP_CHARS[Math.random() * FLAP_CHARS.length | 0];
      }
    });
    el.textContent = affiche.join('');
    if (tic++ % 2 === 0) sons.flap();
    if (fini) clearInterval(iv);
  }, 42);
}

function initTrain() {
  const wrap = document.getElementById('voie-wrap');
  const voie = document.getElementById('voie');
  if (!wrap || !voie || voie.dataset.pret) return;
  voie.dataset.pret = '1';

  const items = [...wrap.querySelectorAll('.parcours-item')];
  if (!items.length) return;

  /* Une gare par etape du parcours */
  const nodes = items.map(it => {
    const n = document.createElement('div');
    n.className = 'gare-node' + (it.classList.contains('travail') ? ' travail' : '');
    voie.appendChild(n);
    return n;
  });
  let gares = [];
  function mesurer() {
    const top = voie.getBoundingClientRect().top + scrollY;
    gares = items.map((it, i) => {
      const r = it.getBoundingClientRect();
      const y = r.top + scrollY - top + r.height / 2;
      nodes[i].style.top = (y - 10) + 'px';
      return y;
    });
  }
  mesurer();
  addEventListener('resize', mesurer);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mesurer);

  /* Split-flap quand chaque etape entre a l'ecran */
  const obsFlap = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const an = e.target.querySelector('.annee');
      const h3 = e.target.querySelector('h3');
      if (an) splitFlap(an);
      if (h3) setTimeout(() => splitFlap(h3), 120);
      obsFlap.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  items.forEach(it => obsFlap.observe(it));

  /* Le train */
  voie.insertAdjacentHTML('beforeend', TRAIN_SVG);
  const train = document.getElementById('train');
  const hTrain = () => train.getBoundingClientRect().height || 90;

  /* Easter egg : 3 clics sur le train = info trafic */
  let clics = 0, chrono = null;
  train.addEventListener('click', () => {
    sons.clic();
    clearTimeout(chrono);
    chrono = setTimeout(() => clics = 0, 1400);
    if (++clics >= 3) {
      clics = 0;
      afficherToastTrain('\u25c9 INFO TRAFIC : votre parcours arrive avec un retard estim\u00e9 de 15 min. Merci de votre compr\u00e9hension.');
      sons.retard();
    }
  });
  if (typeof cursor !== 'undefined' && cursor) {
    train.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    train.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  }

  if (mouvementReduit) { train.style.transform = 'translateY(0)'; return; }

  /* Avancee au scroll, lissee, avec clac-clac et arrivees en gare */
  let y = 0, cible = 0, distSon = 0, derniereFumee = 0, dernierSifflet = -1e9, enMouvement = false;
  const desservies = new Set();

  function calcCible() {
    const r = voie.getBoundingClientRect();
    const prog = Math.min(1, Math.max(0, (innerHeight * 0.55 - r.top) / r.height));
    cible = prog * Math.max(0, r.height - hTrain());
  }
  addEventListener('scroll', calcCible, { passive: true });
  calcCible();

  (function roule() {
    const avant = y;
    y += (cible - y) * 0.085;
    const v = y - avant;
    const vAbs = Math.abs(v);
    if (vAbs > 0.05) {
      const balancement = Math.sin(y / 14) * Math.min(2.5, vAbs * 0.6);
      train.style.transform = `translateY(${y}px) translateX(${balancement}px)`;
      const maintenant = performance.now();
      /* sifflet au depart */
      if (!enMouvement && vAbs > 1.5 && maintenant - dernierSifflet > 6000) {
        dernierSifflet = maintenant;
        sons.sifflet();
      }
      /* souffle de vapeur rythme */
      distSon += vAbs;
      if (distSon > 110) { distSon = 0; sons.vapeur(); }
      /* panaches de fumee depuis la cheminee */
      if (vAbs > 0.4 && maintenant - derniereFumee > 110) {
        derniereFumee = maintenant;
        const f = document.createElement('div');
        f.className = 'fumee';
        f.style.top = (y + hTrain() - 16) + 'px';
        f.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
        f.style.setProperty('--dy', ((v > 0 ? -1 : 1) * (55 + Math.random() * 45)).toFixed(0) + 'px');
        voie.appendChild(f);
        setTimeout(() => f.remove(), 1400);
      }
      const centre = y + hTrain() / 2;
      gares.forEach((g, i) => {
        if (!desservies.has(i) && Math.abs(centre - g) < 26) {
          desservies.add(i);
          nodes[i].classList.add('desservie', 'flash');
          sons.gare();
          if (i === gares.length - 1)
            afficherToastTrain('\u25c9 Terminus. Tout le monde descend !');
        }
      });
    }
    enMouvement = vAbs > 0.3;
    requestAnimationFrame(roule);
  })();
}

let toastTrainChrono = null;
function afficherToastTrain(msg) {
  let t = document.getElementById('toast-train');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-train';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('visible'));
  clearTimeout(toastTrainChrono);
  toastTrainChrono = setTimeout(() => t.classList.remove('visible'), 4200);
}



/* ===== Page projets : guide TV + filtres par catégorie ===== */
function initFiltres() {
  const zone = document.getElementById('filtres-projets');
  const guide = document.getElementById('guide-tv');
  if (guide) {
    const n = listeProjets.length;
    guide.innerHTML = '◉ CH 01 à CH ' + String(n).padStart(2, '0') +
      ' en antenne <span class="clign">●</span> 2 chaînes secrètes à trouver';
  }
  if (!zone) return;
  const cartes = [...document.querySelectorAll('#grille-projets .carte')];
  const grille = document.getElementById('grille-projets');
  const categories = ['Tout', ...new Set(listeProjets.map(p => p.categorie).filter(Boolean))];

  zone.innerHTML = categories.map((c, i) =>
    `<button class="filtre${i === 0 ? ' actif' : ''}" data-cat="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`
  ).join('');

  zone.querySelectorAll('.filtre').forEach(btn => {
    btn.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    btn.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    btn.addEventListener('click', () => {
      if (btn.classList.contains('actif')) return;
      zone.querySelectorAll('.filtre').forEach(b => {
        b.classList.toggle('actif', b === btn);
        b.setAttribute('aria-pressed', b === btn);
      });
      const cat = btn.dataset.cat;
      sons.zap();
      grille.classList.remove('zappe');
      void grille.offsetWidth;                       // relance l'animation
      grille.classList.add('zappe');
      setTimeout(() => {
        cartes.forEach(c => {
          const p = listeProjets[+c.dataset.index];
          c.classList.toggle('filtre-off', cat !== 'Tout' && (!p || p.categorie !== cat));
        });
      }, 90);                                        // le changement se fait sous la neige
    });
  });
}

/* ===== Page parcours : panneau d'affichage de gare ===== */
function initGareBoard(etapes) {
  const board = document.getElementById('gare-board');
  if (!board || !etapes || !etapes.length) return;
  const annees = etapes.map(e => String(e.annee || '').match(/\d{4}/g) || []).flat().map(Number);
  const depart = annees.length ? Math.min(...annees) : '';
  const arriveeCourt = etapes.map(e => (String(e.annee || '').match(/-(\d{2})\b/) || [])[1]).filter(Boolean).map(n => 2000 + +n);
  const arrivee = Math.max(...annees, ...(arriveeCourt.length ? arriveeCourt : [0])) || '';
  document.getElementById('gare-depart').textContent = depart;
  document.getElementById('gare-arrivee').textContent = arrivee;

  const obsBoard = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obsBoard.unobserve(e.target);
      board.querySelectorAll('.gare-val').forEach((v, i) => setTimeout(() => splitFlap(v), i * 140));
    });
  }, { threshold: 0.4 });
  obsBoard.observe(board);
}

/* ===== Page contact : carte de visite (standard horaire + copie de l'email) ===== */
function initCarteVisite(site) {
  const pastille = document.getElementById('cv-pastille');
  if (pastille) {
    /* le standard suit les horaires de bureau à Paris */
    let ouvert = true;
    try {
      const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', weekday: 'short', hour12: false });
      const parts = Object.fromEntries(f.formatToParts(new Date()).map(p => [p.type, p.value]));
      const heure = parseInt(parts.hour, 10);
      ouvert = !['sam.', 'dim.'].includes(parts.weekday) && heure >= 9 && heure < 19;
    } catch (e) {}
    pastille.classList.toggle('hors', !ouvert);
    document.getElementById('cv-statut').textContent =
      ouvert ? 'Disponible, réponse rapide' : 'Hors antenne · réponse sous 24h';
  }

  const copier = document.getElementById('copier-mail');
  if (copier) {
    copier.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    copier.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    copier.addEventListener('click', () => {
      const faire = navigator.clipboard
        ? navigator.clipboard.writeText(site.email)
        : Promise.reject();
      faire.then(() => {
        copier.textContent = '✓ Copié';
        copier.classList.add('copie');
        try { sons.clic(); } catch (e) {}
        setTimeout(() => { copier.textContent = '⧉ Copier'; copier.classList.remove('copie'); }, 1800);
      }).catch(() => { location.href = 'mailto:' + site.email; });
    });
  }
}

/* ===== Page contact : FAQ (contenu depuis site.json, HTML en secours) ===== */
function initFAQ(site) {
  const zone = document.querySelector('.faq');
  if (!zone || !Array.isArray(site.faq) || !site.faq.length) return;
  zone.innerHTML = site.faq.map(f => `
    <details class="faq-item">
      <summary>${esc(f.question)}</summary>
      <p>${esc(f.reponse)}</p>
    </details>`).join('');
  brancherFAQ();
}
function brancherFAQ() {
document.querySelectorAll('.faq-item summary').forEach(s => {
  s.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  s.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  s.addEventListener('click', () => { try { sons.clic(); } catch (e) {} });
});
}
brancherFAQ();

/* ===== Page contact : formulaire Netlify en AJAX ===== */
(function initFormulaire() {
  const form = document.getElementById('formulaire');
  if (!form) return;
  const statut = document.getElementById('form-statut');
  const bouton = document.getElementById('form-envoi');
  form.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('focus', () => { try { sons.survol(); } catch (e) {} });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    bouton.disabled = true;
    bouton.textContent = 'Transmission';
    bouton.classList.add('envoi');
    statut.className = 'form-statut';
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(r => {
      if (!r.ok) throw new Error(r.status);
      form.reset();
      statut.textContent = '◉ Message reçu 5/5. Réponse sous 24h !';
      statut.classList.add('ok');
      try { sons.gagne(); } catch (e) {}
      bouton.textContent = 'Envoyer le message ►';
      bouton.classList.remove('envoi');
      bouton.disabled = false;
    }).catch(() => {
      statut.textContent = '✕ Interférences sur la ligne. Réessaie, ou écris-moi directement par mail.';
      statut.classList.add('ko');
      try { sons.perdu(); } catch (e) {}
      bouton.textContent = 'Envoyer le message ►';
      bouton.classList.remove('envoi');
      bouton.disabled = false;
    });
  });
})();

/* ===== Transition 8-bit entre les pages : dissolution en pixels ===== */
let signalerContenuPret;
const contenuPret = new Promise(r => { signalerContenuPret = r; });

const pxTransition = (() => {
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('px-canvas');
  if (!canvas) return { partir: null };
  const ctx = canvas.getContext('2d');
  const _var = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const teinte = () => ({ ENCRE: _var('--encre') || '#141414', PAPIER: _var('--papier') || '#F1EDE2',
    JAUNE: _var('--jaune') || '#FFD400', ROUGE: _var('--rouge') || '#FF3B00', KLEIN: _var('--klein') || '#2318E0' });
  let { ENCRE, PAPIER, JAUNE, ROUGE, KLEIN } = teinte();
  let W, H, dpr, taille, cols, rows, ordre;

  function dimensionner() {
    ({ ENCRE, PAPIER, JAUNE, ROUGE, KLEIN } = teinte());
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    taille = Math.max(26, Math.round(W / 30));      // gros pixels, ~30 colonnes
    cols = Math.ceil(W / taille);
    rows = Math.ceil(H / taille);
    ordre = [...Array(cols * rows).keys()];
    for (let i = ordre.length - 1; i > 0; i--) {    // mélange de Fisher-Yates
      const j = (Math.random() * (i + 1)) | 0;
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
  }

  function cellule(i, couleur) {
    const x = (i % cols) * taille, y = ((i / cols) | 0) * taille;
    if (couleur) { ctx.fillStyle = couleur; ctx.fillRect(x, y, taille, taille); }
    else ctx.clearRect(x, y, taille, taille);
  }

  /* Carte "niveau" : nom de la page façon écran de chargement de console */
  function carte(label) {
    const cx = W / 2, cy = H / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    /* petits pixels décoratifs autour, aux couleurs du site */
    [JAUNE, ROUGE, KLEIN, PAPIER].forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.fillRect(cx - 140 + k * 90, cy - 110, 18, 18);
      ctx.fillRect(cx + 122 - k * 90, cy + 92, 18, 18);
    });
    ctx.fillStyle = JAUNE;
    ctx.font = "700 " + Math.max(13, W * 0.014) + "px 'Space Mono', monospace";
    ctx.fillText('NOW LOADING', cx, cy - 58);
    ctx.fillStyle = PAPIER;
    ctx.font = Math.min(84, Math.max(34, W * 0.07)) + "px 'Archivo Black', sans-serif";
    ctx.fillText('► ' + label.toUpperCase(), cx, cy + 6);
    /* barre de chargement pixel */
    const bw = Math.min(320, W * 0.5), bh = 14, bx = cx - bw / 2, by = cy + 64;
    ctx.strokeStyle = PAPIER; ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    const blocs = 12;
    for (let i = 0; i < blocs; i++) {
      ctx.fillStyle = i % 3 === 2 ? ROUGE : JAUNE;
      ctx.fillRect(bx + 4 + i * ((bw - 8) / blocs), by + 3, (bw - 8) / blocs - 3, bh - 6);
    }
  }

  function animer(remplir, duree, apres) {
    const total = ordre.length;
    let fait = 0;
    const t0 = performance.now();
    (function pas(t) {
      const cible = Math.min(total, Math.round(((t - t0) / duree) * total));
      while (fait < cible) { cellule(ordre[fait], remplir ? ENCRE : null); fait++; }
      if (fait % 90 < 3) { try { sons.flap(); } catch (e) {} } // clac-clac discret, jamais bloquant
      if (fait < total) requestAnimationFrame(pas);
      else apres && apres();
    })(t0);
  }

  /* Départ : on couvre l'écran, carte niveau, puis navigation */
  function partir(url, label) {
    if (reduit) { location.href = url; return; }
    dimensionner();
    ctx.clearRect(0, 0, W, H);
    canvas.classList.add('actif');
    try { sons.warp(); } catch (e) {}
    animer(true, 380, () => {
      carte(label);
      try { sessionStorage.setItem('px', label); } catch (e) {}
      setTimeout(() => { location.href = url; }, 520);
    });
  }

  /* Arrivée : écran déjà couvert (html.px-in), carte, puis dissolution inverse */
  function arriver() {
    let label = '';
    try { label = sessionStorage.getItem('px') || ''; sessionStorage.removeItem('px'); } catch (e) {}
    if (!document.documentElement.classList.contains('px-in')) return;
    const mire = document.getElementById('mire');
    if (mire) mire.remove();                             // pas de mire quand on arrive en pixels
    if (reduit) { document.documentElement.classList.remove('px-in'); return; }
    dimensionner();
    ctx.fillStyle = ENCRE;
    ctx.fillRect(0, 0, W, H);
    if (label) carte(label);
    canvas.classList.add('actif');
    document.documentElement.classList.remove('px-in'); // le voile statique laisse place au canvas
    const partir = () => animer(false, 380, () => {
      canvas.classList.remove('actif');
      try { sons.materialise(); } catch (e) {}
    });
    /* on attend la police pour la carte, puis courte pause de lecture */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (label) { ctx.fillStyle = ENCRE; ctx.fillRect(0, 0, W, H); carte(label); } });
    }
    /* on ne révèle pas une page vide : on attend les JSON (1,2 s max) */
    const minimum = new Promise(r => setTimeout(r, label ? 620 : 200));
    const contenus = Promise.race([contenuPret, new Promise(r => setTimeout(r, 1200))]);
    Promise.all([minimum, contenus]).then(partir);
  }

  arriver();
  return { partir };
})();

/* ===== Navigation entre pages : interception + lien actif ===== */
(function initNavigation() {
  const ici = location.pathname.replace(/index\.html$/, '');
  document.querySelectorAll('a[data-page]').forEach(a => {
    const dest = new URL(a.href).pathname.replace(/index\.html$/, '');
    if (dest === ici) a.classList.add('actif');
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (dest === ici) { e.preventDefault(); return; }   // déjà sur place
      if (!pxTransition.partir) return;                    // pas de canvas : navigation normale
      e.preventDefault();
      pxTransition.partir(a.href, a.dataset.page);
    });
  });
})();


/* ===== Hero : signal faible, une lettre glitche de temps en temps ===== */
(function initSignalFaible() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nom = document.getElementById('nom');
  if (!nom) return;
  (function prochainGlitch() {
    setTimeout(() => {
      const lettres = nom.querySelectorAll('.lettre');
      if (lettres.length && !document.hidden) {
        const lettre = lettres[Math.random() * lettres.length | 0];
        lettre.classList.add('glitche');
        setTimeout(() => lettre.classList.remove('glitche'), 360);
      }
      prochainGlitch();
    }, 10000 + Math.random() * 5000);   // toutes les 10 à 15 secondes
  })();
})();

/* ===== Code secret global : haut haut bas gauche droite ===== */
(function initCodeSecret() {
  const canvas = document.getElementById('px-canvas');
  if (!canvas) return;
  const SUITE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const _v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COULEURS = () => [_v('--jaune') || '#FFD400', _v('--rouge') || '#FF3B00', _v('--klein') || '#2318E0', _v('--papier') || '#F1EDE2'];
  let position = 0, enCours = false;

  function pluie() {
    if (enCours || canvas.classList.contains('actif')) return;   // jamais pendant une transition
    enCours = true;
    try { sons.gagne(); } catch (e) {}
    afficherToastTrain('◉ CODE SECRET ACCEPTÉ : pluie de pixels offerte par la régie');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.classList.add('actif');
    const t = Math.max(18, Math.round(W / 44));                  // taille d'un pixel
    const gouttes = Array.from({ length: Math.round(W / t) * 2 }, () => ({
      x: (Math.random() * W / t | 0) * t,
      y: -Math.random() * H,
      v: 4 + Math.random() * 7,
      c: (c => c[Math.random() * c.length | 0])(COULEURS())
    }));
    const fin = performance.now() + 2200;
    (function tombe(now) {
      ctx.clearRect(0, 0, W, H);
      const restant = fin - now;
      gouttes.forEach(g => {
        g.y += g.v;
        if (g.y > H && restant > 600) { g.y = -t * (1 + Math.random() * 8); }
        ctx.fillStyle = g.c;
        ctx.fillRect(g.x, (g.y / t | 0) * t, t - 2, t - 2);      // chute crantée, pixel oblige
      });
      if (restant > 0 || gouttes.some(g => g.y < H)) requestAnimationFrame(tombe);
      else { ctx.clearRect(0, 0, W, H); canvas.classList.remove('actif'); enCours = false; }
    })(performance.now());
  }

  addEventListener('keydown', e => {
    if (overlay.classList.contains('ouvert')) return;            // pas pendant la TV (flèches = zapping)
    const t = e.target;
    if (e.isComposing || t.matches?.('input, textarea, select') || t.isContentEditable) return; // pas en pleine saisie
    position = e.key === SUITE[position] ? position + 1 : (e.key === SUITE[0] ? 1 : 0);
    if (position === SUITE.length) { position = 0; pluie(); }
  });
})();

/* ===== Bouton son ON/OFF ===== */
const sonToggle = document.getElementById('son-toggle');
function majSonToggle() {
  sonToggle.textContent = sons.actif ? '♪ ON' : '♪ OFF';
  sonToggle.classList.toggle('coupe', !sons.actif);
  sonToggle.setAttribute('aria-pressed', sons.actif);
}
sonToggle.addEventListener('click', () => {
  const on = sons.basculer();
  majSonToggle();
  afficherToastTrain(on ? '\u266a Son activ\u00e9 : bienvenue sur CARON\u00b7TV' : '\u266a Son coup\u00e9');
});
sonToggle.addEventListener('mouseenter', () => cursor.classList.add('hover'));
sonToggle.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
majSonToggle();

charger()
  .then(() => { initCompteurs(); initMagnetisme(); })
  .catch(err => console.error('Erreur de chargement des contenus :', err))
  .finally(() => { cacherMire(); signalerContenuPret(); });
