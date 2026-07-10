/* ===== Page MonCapy : la frise des personnages =====
   Une section haute (760vh) et une scène collante : le scroll vertical
   fait défiler la frise horizontalement. Kap le capybara marche au
   premier plan et change de costume à chaque époque. Zéro librairie. */
(function initFriseMonCapy() {
  const section = document.getElementById('capy-frise');
  if (!section) return;

  const bande    = document.getElementById('capy-bande');
  const stations = [...bande.querySelectorAll('.capy-station')];
  const annee    = document.getElementById('capy-annee');
  const epoque   = document.getElementById('capy-epoque');
  const kap      = document.getElementById('kap');
  const N = stations.length;

  /* --- Mouvement réduit : pas de frise animée, les affiches en grille --- */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('statique');
    stations.forEach(s => s.classList.add('active'));
    return;
  }

  const borne = t => Math.max(0, Math.min(1, t));
  let active = -1;
  let precedentP = 0;
  let minuterieArret = null;

  function activerStation(i) {
    if (i === active) return;
    const avancait = i > active;
    active = i;
    const s = stations[i];
    stations.forEach((st, k) => st.classList.toggle('active', k === i));

    /* l'année se tamponne */
    annee.textContent = s.dataset.annee;
    epoque.textContent = s.dataset.epoque.toUpperCase();
    annee.classList.remove('tampon');
    void annee.offsetWidth;                       // relance l'animation
    annee.classList.add('tampon');

    /* Kap enfile le bon costume */
    kap.querySelectorAll('.acc').forEach(a =>
      a.classList.toggle('porte', a.dataset.acc === s.dataset.acc));

    if (avancait) { try { sons.gare(); } catch (e) {} }
    else          { try { sons.materialise(); } catch (e) {} }
  }

  function peindre(p) {
    /* défilement horizontal de la bande */
    const course = bande.scrollWidth - innerWidth;
    bande.style.transform = 'translateX(' + (-p * course).toFixed(1) + 'px)';

    /* station la plus proche du centre */
    activerStation(Math.round(p * (N - 1)));

    /* Kap marche pendant le défilement, dans le bon sens */
    const delta = p - precedentP;
    if (Math.abs(delta) > 0.00035) {
      kap.classList.add('marche');
      kap.classList.toggle('recule', delta < 0);
      clearTimeout(minuterieArret);
      minuterieArret = setTimeout(() => kap.classList.remove('marche'), 160);
    }
    precedentP = p;
  }

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
