# Portfolio caroncharles.fr — Guide de mise en ligne

Site portfolio brutaliste néo-rétro avec contenus éditables via Sveltia CMS (gratuit).

## Ce que contient ce dossier

```
portfolio/
├── index.html              → le site (design + animations)
├── admin/
│   ├── index.html          → l'interface d'administration (caroncharles.fr/admin)
│   └── config.yml          → la configuration du CMS (⚠️ une ligne à modifier)
├── content/
│   ├── site.json           → hero, ticker, contact, footer
│   ├── projets.json        → tes projets
│   ├── competences.json    → tes compétences
│   └── parcours.json       → ton parcours
└── images/                 → les images que tu ajouteras via l'admin
```

Tout ce qui est dans `content/` est modifiable depuis l'admin, sans toucher au code.

---

## Étape 1 — Créer le dépôt GitHub (10 min)

1. Crée un compte gratuit sur **github.com** si tu n'en as pas.
2. Clique sur **New repository**, nomme-le `portfolio-caroncharles`, laisse-le en **Public** (ou Private, ça marche aussi), puis **Create repository**.
3. Sur la page du dépôt vide, clique sur **uploading an existing file** et glisse-dépose **tout le contenu** de ce dossier (index.html, admin/, content/, images/).
4. Clique sur **Commit changes**.

## Étape 2 — Modifier la config du CMS (1 min)

1. Dans ton dépôt GitHub, ouvre `admin/config.yml` et clique sur le crayon ✏️.
2. Remplace la ligne :
   ```yaml
   repo: TON-PSEUDO/portfolio-caroncharles
   ```
   par ton vrai pseudo GitHub, par exemple :
   ```yaml
   repo: charlescaron/portfolio-caroncharles
   ```
3. **Commit changes**.

## Étape 3 — Connecter Netlify (5 min)

1. Sur **app.netlify.com** : **Add new project → Import an existing project → GitHub**.
2. Autorise Netlify à accéder à ton compte GitHub et sélectionne `portfolio-caroncharles`.
3. Ne change aucun réglage de build (il n'y en a pas besoin, le site est statique). Clique sur **Deploy**.
4. Ton site est en ligne sur une URL temporaire du type `xxx.netlify.app`.

Désormais, **chaque modification dans GitHub (ou via l'admin) redéploie le site automatiquement**.

## Étape 4 — Brancher caroncharles.fr (10 min + propagation)

1. Dans Netlify : **Domain management → Add a domain → caroncharles.fr**.
2. Netlify t'indique les enregistrements DNS à créer. Chez ton registrar (OVH, Gandi, Ionos…), dans la zone DNS de caroncharles.fr :
   - Enregistrement **A** : `@` → `75.2.60.5`
   - Enregistrement **CNAME** : `www` → `ton-site.netlify.app`
   
   (Ou plus simple : utilise **Netlify DNS** en changeant les serveurs de noms chez ton registrar — Netlify te guide.)
3. Attends la propagation (de quelques minutes à 24 h). Netlify active le **HTTPS automatiquement**.

## Étape 5 — Activer la connexion à l'admin (10 min)

L'admin utilise GitHub pour t'identifier, via la passerelle OAuth gratuite de Netlify :

1. Sur GitHub : **Settings (de ton compte) → Developer settings → OAuth Apps → New OAuth App** :
   - **Application name** : `Admin caroncharles.fr`
   - **Homepage URL** : `https://caroncharles.fr`
   - **Authorization callback URL** : `https://api.netlify.com/auth/done`
2. Clique sur **Register application**, puis **Generate a new client secret**. Garde la page ouverte (Client ID + Client Secret).
3. Dans Netlify : **Site configuration → Access & security → OAuth → Install provider → GitHub**, colle le **Client ID** et le **Client Secret**.

## Étape 6 — Utiliser l'admin 🎉

1. Va sur **caroncharles.fr/admin**.
2. Connecte-toi avec ton compte GitHub.
3. Modifie tes projets, compétences, textes… Chaque **Publier** enregistre dans GitHub et redéploie le site (en ligne sous ~1 minute).

---

## Dépannage rapide

- **Page /admin blanche** → vérifie que `admin/config.yml` contient bien ton pseudo GitHub exact.
- **Erreur à la connexion** → vérifie le Client ID/Secret dans Netlify (étape 5) et que la callback URL est exactement `https://api.netlify.com/auth/done`.
- **Les modifs n'apparaissent pas** → regarde l'onglet **Deploys** dans Netlify : un déploiement doit se lancer après chaque publication (~30-60 s).

## Coût total

- Netlify (hébergement + HTTPS + domaine perso) : **0 €**
- GitHub : **0 €**
- Sveltia CMS : **0 €**
- Seul coût : le renouvellement annuel du nom de domaine caroncharles.fr chez ton registrar.
