/* ===== Page Omniscius : la table de jeu qui raconte l'histoire =====
   Une section haute (560vh) et une scène collante : le scroll distribue
   d'abord les cinq cartes depuis la pioche, puis les soulève et les
   retourne une à une. Zéro librairie, tout est piloté à la main. */
(function initTableOmniscius() {
  const section = document.getElementById('omni-table');
  if (!section) return;

  const cartes   = [...section.querySelectorAll('.omni-carte')];
  const panneau  = document.getElementById('omni-panneau');
  const elIndex  = document.getElementById('omni-index');
  const elTitre  = document.getElementById('omni-titre');
  const elRecit  = document.getElementById('omni-recit');
  const points   = [...document.querySelectorAll('#omni-points i')];
  const invite   = document.getElementById('omni-invite');
  const pioche   = document.getElementById('omni-pioche');
  const fin      = document.getElementById('omni-fin');
  const colle    = section.querySelector('.omni-colle');
  const N = cartes.length;

  /* --- Mouvement réduit : pas de scène, les cinq cartes posées face visible --- */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('statique');
    return;
  }

  /* --- Géométrie : les cartes se posent en arc sur le tapis --- */
  const ANGLES = [-52, -26, 0, 26, 52];               // éventail, en degrés
  let places = [];                                    // position finale de chaque carte
  function calerScene() {
    const w = colle.clientWidth, h = colle.clientHeight;
    const rx = Math.min(w * 0.36, 430);               // rayon horizontal de l'arc
    const ry = Math.min(h * 0.24, 210);               // rayon vertical
    places = ANGLES.map(a => {
      const r = a * Math.PI / 180;
      return { x: Math.sin(r) * rx, y: (1 - Math.cos(r)) * ry + h * 0.06, rot: a * 0.55 };
    });
  }
  calerScene();
  addEventListener('resize', calerScene);

  /* --- Découpage du scroll en phases ---
     0.00 → 0.16 : la donne (les cartes glissent de la pioche vers l'arc)
     ensuite      : une fenêtre par carte pour la soulever et la retourner
     0.90 → 1.00 : fin de partie */
  const DONNE_FIN = 0.16;
  const FEN = (0.88 - DONNE_FIN) / N;                 // fenêtre de retournement par carte
  const lisse = t => t * t * (3 - 2 * t);             // easing doux (smoothstep)
  const borne = t => Math.max(0, Math.min(1, t));

  const etat = { distribuees: cartes.map(() => false), retournees: cartes.map(() => false), finie: false };
  let derniereLue = -1;

  function peindre(p) {
    const donne = lisse(borne(p / DONNE_FIN));

    cartes.forEach((carte, i) => {
      const cible = places[i];
      const dLocal = lisse(borne((p - i * 0.018) / (DONNE_FIN - 0.07)));   // donne décalée carte par carte
      const x = cible.x * dLocal;
      const y = cible.y * dLocal;
      const rot = cible.rot * dLocal;

      /* retournement : fenêtre propre à chaque carte */
      const f = lisse(borne((p - (DONNE_FIN + i * FEN)) / (FEN * 0.72)));
      const levee = Math.sin(Math.PI * Math.min(f, 1)) * 0.22;             // la carte se soulève pendant le flip
      carte.style.transform =
        'translate(' + x.toFixed(1) + 'px,' + (y - f * 8).toFixed(1) + 'px)' +
        ' rotate(' + rot.toFixed(2) + 'deg)' +
        ' scale(' + (1 + levee).toFixed(3) + ')';
      carte.querySelector('.oc-int').style.transform = 'rotateY(' + (180 * f).toFixed(1) + 'deg)';
      carte.classList.toggle('soulevee', f > 0.03 && f < 0.97);

      /* sons : uniquement au premier passage vers l'avant */
      if (!etat.distribuees[i] && dLocal > 0.9) { etat.distribuees[i] = true; try { sons.flap(); } catch (e) {} }
      if (!etat.retournees[i] && f > 0.5)       { etat.retournees[i] = true; try { sons.zap(); }  catch (e) {} }
    });

    /* pioche et invite s'effacent une fois la donne faite */
    pioche.style.opacity = String(1 - donne);
    invite.style.opacity = String(1 - donne);

    /* panneau récit : la carte en cours (ou la dernière retournée) */
    const enCours = Math.min(N - 1, Math.max(0, Math.floor((p - DONNE_FIN) / FEN)));
    const visible = p > DONNE_FIN * 0.9 && p < 0.92;
    panneau.classList.toggle('visible', visible);
    if (visible && enCours !== derniereLue) {
      derniereLue = enCours;
      const c = cartes[enCours];
      elIndex.textContent = 'CARTE 0' + (enCours + 1) + ' / 0' + N;
      elTitre.textContent = c.dataset.titre;
      elRecit.textContent = c.dataset.recit;
      points.forEach((pt, k) => pt.classList.toggle('fait', k <= enCours));
    }

    /* fin de partie */
    const finie = p > 0.93;
    fin.classList.toggle('visible', finie);
    fin.setAttribute('aria-hidden', finie ? 'false' : 'true');
    if (finie && !etat.finie) { etat.finie = true; try { sons.gagne(); } catch (e) {} }
    if (!finie) etat.finie = false;
  }

  /* --- Boucle : progression = position du scroll dans la section --- */
  let demande = false;
  function surScroll() {
    if (demande) return;
    demande = true;
    requestAnimationFrame(() => {
      demande = false;
      const r = section.getBoundingClientRect();
      const total = section.offsetHeight - innerHeight;
      peindre(borne(-r.top / Math.max(1, total)));
    });
  }
  addEventListener('scroll', surScroll, { passive: true });
  addEventListener('resize', surScroll);
  surScroll();
})();
