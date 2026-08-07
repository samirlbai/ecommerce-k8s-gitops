# Audit de réutilisabilité — Migration vers K3s / GitOps / Observabilité

> Analyse en lecture seule du dépôt `e-commerce-vue` en vue de sa réutilisation pour un nouveau projet cible : Kubernetes (K3s), pipeline CI/CD, GitOps (ArgoCD/Flux), monitoring (Prometheus/Grafana).
> Aucun fichier du projet source n'a été modifié.

---

## ⚠️ Constat préalable important

Le [README.md](README.md) décrit une stack Docker complète (`Dockerfile`, `Dockerfile.dev` par service, `docker-compose.yml`, `docker-compose.prod.yml`, pipelines GitLab CI fonctionnels dans les `build-*.yml`). **Aucun de ces fichiers n'existe réellement dans l'arborescence livrée** :

- Aucun `Dockerfile` nulle part (racine, `frontend/`, `services/*/`).
- Aucun `docker-compose*.yml`.
- `.gitlab-ci.yml` (racine) : **fichier vide** (0 octet).
- `frontend/build-front.yml`, `services/*/build-*.yml` : **tous vides**.
- Le dépôt livré n'est pas un dépôt Git (`.git` absent) — impossible de vérifier via l'historique si ces fichiers ont existé puis ont été supprimés avant l'export, ou n'ont jamais été inclus dans cette livraison.

**Conséquence** : cet audit documente ce qui existe réellement sur disque, et s'appuie sur le README uniquement pour reconstituer l'intention d'architecture (noms de services Swarm, ports, workflow) quand le fichier concret est absent. Toute section ci-dessous précise sa source (code réel vs. README).

---

## 1. Architecture actuelle

### 1.1 Services et ports

| Service | Port (`.env`) | Point d'entrée | Framework |
|---|---|---|---|
| `frontend` | 8080 | [frontend/server.cjs](frontend/server.cjs) (Express + reverse proxy) servant le build Vite (`dist/`) | Vue 3 + Express |
| `auth-service` | 3001 | [services/auth-service/src/app.js](services/auth-service/src/app.js) | Express |
| `product-service` (produits + panier) | 3000 | [services/product-service/src/app.js](services/product-service/src/app.js) | Express |
| `order-service` | 3002 | [services/order-service/src/app.js](services/order-service/src/app.js) | Express |

Chaque service expose `GET /api/health` retournant `{status:'OK', service:'<nom>'}` — **statique**, ne vérifie pas l'état réel de la connexion MongoDB (voir §4).

### 1.2 Communication inter-services

- **Frontend → backends** : proxy HTTP via `http-proxy-middleware` dans `server.cjs`, cible configurée par variables d'env (`VITE_AUTH_SERVICE_URL`, `VITE_PRODUCT_SERVICE_URL`, `VITE_ORDER_SERVICE_URL`) — pattern de *service discovery par nom DNS* (`http://product-service:3000`), hérité de Docker Compose/Swarm.
- **order-service → product-service** : appel HTTP synchrone via `axios` (vérification de stock à la commande, `GET /api/products/:id`, puis `PATCH /api/products/:id/stock` à l'annulation) — voir [services/order-service/src/controllers/orderController.js](services/order-service/src/controllers/orderController.js). URL cible lue depuis `process.env.VITE_PRODUCT_SERVICE_URL` avec fallback `http://product-service:3000`.
- Pas de message broker, pas d'API Gateway dédiée : le proxy Express du frontend joue ce rôle.

### 1.3 Dépendances (package.json)

**Frontend** ([frontend/package.json](frontend/package.json)) : `vue@3.3`, `vue-router@4.4`, `vuex@4.1`, `axios@1.6`, `express@4.21`, `http-proxy-middleware@3.0`, build via `vite@5.4`, tests `vitest@1.6` + `@vue/test-utils`.

**auth-service** ([services/auth-service/package.json](services/auth-service/package.json)) : `express@4.18`, `mongoose@7`, `jsonwebtoken@9`, `bcryptjs@2.4`, `cors@2.8`, `dotenv@16`. Tests : `jest@29`, `supertest@6`, `mongodb-memory-server-core@8.12`.

**product-service** ([services/product-service/package.json](services/product-service/package.json)) : `express@4.18`, `mongoose@7`, `cors@2.8`, `dotenv@16`. Pas de `jsonwebtoken`/`bcrypt` en direct (l'auth déléguée). Tests : `jest@29`, `mongodb-memory-server@6.9` (**version différente** de celle utilisée par auth-service), `jest-junit`, `eslint`.

**order-service** ([services/order-service/package.json](services/order-service/package.json)) : `express@4.18`, `mongoose@7`, `jsonwebtoken@9`, `axios@1.6`, `cors@2.8`, `dotenv@16`. Tests : `jest@29`, `mongodb-memory-server@9.1` (**encore une 3ᵉ version différente**), `@babel/*` en `^7.x.x` (range invalide, voir §6).

Aucun `package.json` (racine ni services) ne déclare de champ `engines` pour fixer la version de Node.

### 1.4 Variables d'environnement (clés uniquement, valeurs non révélées)

| Fichier | Clés présentes |
|---|---|
| `.env`, `.env.development`, `.env.production` (racine) | `VITE_PRODUCT_SERVICE_URL`, `VITE_AUTH_SERVICE_URL`, `VITE_ORDER_SERVICE_URL`, `MONGODB_URI`, `JWT_SECRET` |
| `frontend/.env`, `frontend/.env.production` | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `VITE_PRODUCT_SERVICE_URL`, `VITE_AUTH_SERVICE_URL`, `VITE_ORDER_SERVICE_URL`, `NODE_ENV` |
| `services/auth-service/.env`, `.env.production` | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV` |
| `services/product-service/.env` | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV` |
| `services/order-service/.env` | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `VITE_PRODUCT_SERVICE_URL`, `NODE_ENV` |

Remarques :
- Le frontend porte des clés `MONGODB_URI` / `JWT_SECRET` dont il n'a **aucun usage** dans `server.cjs` (pas de connexion Mongo ni de vérification JWT côté frontend) — copier-coller resté en place, à ne pas reporter tel quel.
- `order-service/.env` porte une clé préfixée `VITE_*` (convention frontend/Vite) pour un usage purement backend — nommage incohérent, à corriger dans la cible (ex. `PRODUCT_SERVICE_URL`).
- Ces fichiers `.env` **ne sont pas exclus** par les `.gitignore` du dépôt (voir §6) : ils sont documentés comme faisant partie de la livraison, pas comme secrets à instancier localement.

### 1.5 Bases de données et mode de connexion

- **1 base MongoDB logique par service**, sur la même instance MongoDB partagée (nom de base différent dans l'URI : `/auth`, `/ecommerce`, `/orders`), pas 3 instances séparées.
- Connexion via `mongoose.connect(process.env.MONGODB_URI)`, aucune option explicite (pool size, timeouts, TLS) — voir [services/*/src/config/database.js](services/auth-service/src/config/database.js).
- Comportement de reconnexion **incohérent entre services** :
  - `auth-service` et `order-service` : en cas d'échec de connexion, `process.exit(1)` (sauf en mode test) → adapté à un redémarrage par orchestrateur (K8s `restartPolicy`), pas de retry interne.
  - `product-service` : en cas d'échec, `setTimeout(connectDB, 5000)` → retry interne infini, **pas de sortie du process** → un pod K8s ne serait jamais recréé par une probe de liveness basée sur le crash, seule une probe applicative détecterait le problème (voir §4).
- Pas d'authentification MongoDB visible dans les URIs fournies (`mongodb://127.0.0.1:27017/...` en dev, `mongodb://mongodb:27017` en "prod" racine) — pas de user/password dans la chaîne de connexion.

---

## 2. Dockerfiles existants

**Aucun Dockerfile n'est présent dans le dépôt livré**, pour aucun service.

| Service | Dockerfile | Dockerfile.dev | Multi-stage | Healthcheck | Ports exposés (`EXPOSE`) |
|---|---|---|---|---|---|
| frontend | ❌ absent | ❌ absent | N/A | N/A | N/A |
| auth-service | ❌ absent | — | N/A | N/A | N/A |
| product-service | ❌ absent | — | N/A | N/A | N/A |
| order-service | ❌ absent | — | N/A | N/A | N/A |

Le README (§ Structure des Répertoires, § Déploiement Docker) atteste qu'ils existaient dans une version antérieure du projet (mention explicite de builds multi-stage via un `target` de build, d'images pré-construites poussées en registre via `CI_REGISTRY_IMAGE`/`IMAGE_TAG`/`IMAGE_FULL`). **Rien de cela n'est vérifiable dans le code fourni.**

➡️ Pour le nouveau projet K8s, les Dockerfiles devront être **écrits intégralement from scratch** (pas de portage possible), en s'appuyant uniquement sur :
- les scripts `start` des `package.json` (`node src/app.js` pour les 3 services, `node server.cjs` pour le frontend après `vite build`),
- les ports `.env` ci-dessus,
- les endpoints `/api/health` existants comme base de healthcheck.

---

## 3. Éléments réutilisables tels quels pour K8s

- **Code applicatif Node.js/Express** des 3 microservices et du frontend : logique métier, routes, contrôleurs, modèles Mongoose — indépendants de l'infrastructure, portables sans modification.
- **Endpoints `/api/health`** sur chaque service backend — utilisables immédiatement comme cible de probe HTTP (avec les limites du §4).
- **Séparation des bases par service** (`/auth`, `/ecommerce`, `/orders`) — principe "database per service" directement compatible avec un déploiement K8s (StatefulSet Mongo unique multi-bases, ou 3 déploiements Mongo séparés).
- **Lecture de la config via variables d'environnement** (`PORT`, `MONGODB_URI`, `JWT_SECRET`, URLs des services) — modèle 12-factor déjà en place, directement mappable sur des `ConfigMap`/`Secret` K8s sans changer une ligne de code.
- **Résolution de service par nom DNS plat** (`http://product-service:3000`) — le nommage Swarm/Compose (`product-service`, `auth-service`, `order-service`) correspond exactly au nommage attendu pour un `Service` K8s (`ClusterIP`) dans le même namespace ; les fallbacks codés en dur dans `orderController.js` et `server.cjs` fonctionneront tels quels si les `Service` K8s portent les mêmes noms.
- **Suites de tests Jest/Vitest** existantes (748 lignes cumulées, voir §6) — réutilisables telles quelles comme étape `test` d'un pipeline CI, indépendamment de l'orchestrateur cible.
- **`scripts/init-products.sh`** — utilisable tel quel ou quasi tel quel comme Job K8s de seed de données (à vérifier : script non lu en détail dans cet audit, à valider avant réutilisation).

---

## 4. Éléments à adapter en profondeur

- **Absence totale de manifests d'orchestration** (Dockerfiles, docker-compose) : il n'y a rien à "convertir" mécaniquement — il faut concevoir directement en cible K8s (`Deployment`, `Service`, `ConfigMap`, `Secret`) à partir du code source, sans passer par une étape de traduction Compose→K8s (type Kompose), faute de fichier source.
- **Gestion des secrets** : `JWT_SECRET` et `MONGODB_URI` doivent passer de fichiers `.env` committés en clair à des `Secret` K8s (montés en variables d'env ou fichiers), idéalement gérés via un outil GitOps-friendly (Sealed Secrets, External Secrets Operator, SOPS) plutôt que des `Secret` bruts en clair dans le dépôt Git ArgoCD/Flux.
- **Healthcheck → probes K8s** : les endpoints `/api/health` actuels renvoient un statut **statique**, sans vérifier `mongoose.connection.readyState`. Il faut :
  - soit enrichir `/api/health` pour distinguer *liveness* (process vivant) de *readiness* (DB joignable) avant de les mapper sur `livenessProbe`/`readinessProbe` ;
  - soit ajouter un endpoint dédié (`/ready`) qui teste la connexion Mongo.
  - Le comportement `product-service` (retry infini sans jamais quitter le process, cf. §1.5) doit être aligné sur celui des deux autres services pour qu'un `livenessProbe` en échec puisse réellement déclencher un redémarrage de pod cohérent.
- **Service discovery** : fonctionnellement compatible (noms plats → noms de `Service` K8s), mais les URLs sont actuellement **hardcodées en fallback dans le code** (`orderController.js`, `server.cjs`) plutôt que fournies uniquement par `ConfigMap`. À nettoyer pour ne dépendre que de la configuration externe (12-factor strict), afin de gérer proprement plusieurs environnements (dev/staging/prod) via Kustomize/Helm/overlays ArgoCD.
- **CORS** : `auth-service` a une origine CORS **hardcodée** (`http://localhost:8080`, voir [services/auth-service/src/app.js:18](services/auth-service/src/app.js#L18)) alors que `product-service`/`order-service` utilisent `cors()` sans restriction — à unifier et externaliser (via env/ConfigMap) pour supporter le nouvel Ingress K8s.
- **Middleware d'authentification JWT dupliqué 3 fois** (un fichier `middleware/auth.js` quasi identique par service, avec un **secret de fallback différent** entre auth-service — `efrei_super_pass` — et order-service — `test_secret`, voir [services/order-service/src/middleware/auth.js:17](services/order-service/src/middleware/auth.js#L17)) : à factoriser en package partagé ou au moins aligner les fallbacks, sans quoi une désynchronisation de `Secret` K8s entre déploiements peut casser silencieusement la validation de token sur un seul service.
- **CI/CD** : à reconstruire entièrement (voir §5) — rien du pipeline GitLab existant (vide) n'est récupérable ; seule l'intention documentée dans le README (étapes build/test/lint/scan) sert de cahier des charges.
- **Déploiement manuel PM2** (`scripts/deploy.sh`, `scripts/setup.sh`) : logique d'installation de dépendances système (Node, MongoDB, libssl) à **abandonner** au profit d'images de base K8s, mais la séquence *install deps → build frontend → start services* reste une référence utile pour écrire les Dockerfiles.

---

## 5. Éléments non réutilisables

- **Toute référence Docker Swarm** : `docker stack deploy`, `docker swarm init`, notion de nœuds manager/worker — concept sans équivalent direct en K3s (remplacé par les primitives K8s natives).
- **GitLab CI/CD avec runners Docker-in-Docker internes à l'entreprise** (mentionné dans le README, fichiers `build-*.yml` vides en pratique) : dépendance à une infra GitLab Runner privée non portable vers un pipeline générique. Si le nouveau projet change d'outil CI (GitHub Actions, GitLab.com SaaS, Tekton...) ou de modèle d'exécution (GitOps pull-based avec ArgoCD/Flux plutôt que push-based), toute la philosophie de pipeline est à revoir, pas seulement la syntaxe.
- **Déploiement PM2 sur VM Debian 12 nue** (`scripts/deploy.sh`) : installation système de Node/MongoDB/libssl via `apt`/`dpkg`, `pm2 save`, synchronisation `rsync` vers un serveur fixe par IP (`192.168.1.108`) — modèle *pet server* incompatible avec un modèle *cattle* K8s/GitOps.
- **Scripts d'installation MongoDB 4.4 sur Debian avec patch `libssl1.1`** ([services/auth-service/libssl1.1-error-troubleshooting.sh](services/auth-service/libssl1.1-error-troubleshooting.sh), section MongoDB de `deploy.sh`) : contournement lié à l'obsolescence de MongoDB 4.4 sur Debian 11/12 — n'a plus lieu d'être avec une image MongoDB officielle en conteneur ou un service managé.
- **`.deb` binaire committé dans le dépôt** ([services/auth-service/libssl1.1_1.1.1w-0+deb11u2_amd64.deb](services/auth-service/libssl1.1_1.1.1w-0+deb11u2_amd64.deb)) : artefact binaire non versionnable proprement, à ne pas reporter.
- **`server.cjs` en tant que reverse-proxy applicatif** : dans un cluster K8s, ce rôle est mieux tenu par un `Ingress`/`Service` natif ; le garder en plus introduit une couche de proxy applicatif redondante avec l'Ingress Controller (à trancher : soit on le supprime au profit d'un Ingress avec path-based routing, soit on assume un frontend "BFF" volontairement — à décider avec l'équipe, pas un simple portage).
- **Rapports générés committés** ([services/product-service/junit.xml](services/product-service/junit.xml), `gl-code-quality-report.json` référencés dans les scripts `lint:report`) : artefacts de build qui ne devraient jamais être versionnés, à exclure définitivement (`.gitignore`) plutôt qu'à porter.

---

## 6. Dette technique et risques

| Risque | Détail | Sévérité |
|---|---|---|
| **Secrets en clair committés** | `JWT_SECRET` identique et en clair dans **7 fichiers `.env*`** (racine, frontend, 3 services, dev et prod), non exclus par `.gitignore` — le même secret sert en dev et en "prod". | 🔴 Élevé |
| **MongoDB obsolète** | `deploy.sh` installe explicitement **MongoDB 4.4** (fin de support upstream), avec contournement `libssl1.1` sur Debian — dette d'infra assumée dans le tooling de déploiement. | 🔴 Élevé |
| **`.dockerignore` absent** | Aucun `.dockerignore` nulle part (cohérent avec l'absence de Dockerfile) — à créer dès l'écriture des nouveaux Dockerfiles pour éviter d'embarquer `node_modules`, `.env`, `coverage/`, `tests/` dans les images. | 🟠 Moyen (à anticiper) |
| **`.gitignore` incomplet** | Les `.gitignore` présents excluent `node_modules`, `coverage`, `package-lock.json`, mais **pas** les fichiers `.env*` ni le `.deb` binaire ni `junit.xml`/`gl-code-quality-report.json` déjà committés. | 🟠 Moyen |
| **`package.json` racine orphelin** | Ne contient que `devDependencies` (`vite`, `terser`) sans rapport clair avec un besoin racine — reliquat probable d'une mauvaise manipulation, à ne pas reporter tel quel. | 🟡 Faible |
| **Versions Node non pincées** | Aucun `engines` dans les 4 `package.json`. Le README recommande Node ≥14.x, `deploy.sh` installe Node 18.x — incohérence documentaire ; à fixer explicitement (ex. Node 20 LTS) dans les nouveaux Dockerfiles. | 🟠 Moyen |
| **Versions de dépendances de test divergentes** | `mongodb-memory-server` en version 8.12 (auth), 6.9 (product), 9.1 (order) pour un même besoin — signe d'absence de gouvernance des dépendances inter-services. | 🟡 Faible |
| **Range semver invalide** | `order-service/package.json` déclare `@babel/core: "^7.x.x"` — syntaxe non standard, risque de résolution imprévisible selon le gestionnaire de paquets. | 🟡 Faible |
| **Tests présents mais volume limité** | Jest/Vitest configurés et fonctionnels (`auth.test.js` 155 lignes, `order.test.js` 277 lignes, `product.test.js` **46 lignes seulement** — très en retrait par rapport aux deux autres services), `mongodb-memory-server`/`supertest` en place. Pas de mesure de couverture consolidée observée (rapports non commités hors `junit.xml` obsolète). | 🟡 Faible/Moyen |
| **Pas de tests d'intégration inter-services** | L'appel `order-service → product-service` (vérification de stock) n'est testable qu'en mockant `axios` ; aucune preuve de test de bout-en-bout observée dans les fichiers inspectés. | 🟠 Moyen |
| **Secret JWT de fallback divergent** | `auth-service`/`product-service` retombent sur `efrei_super_pass` si `JWT_SECRET` est absent, `order-service` retombe sur `test_secret` — un oubli de configuration casserait silencieusement la validation de token sur un seul service. | 🟠 Moyen |
| **Health check non représentatif** | `/api/health` ne teste pas l'état réel de la connexion Mongo (voir §4) — un futur `readinessProbe` naïf donnerait de faux positifs. | 🟠 Moyen |
| **Logging non structuré** | `console.log`/`console.error` bruts, y compris logs de debug HTTP (`onProxyReq`, requêtes reçues) laissés actifs — à remplacer par un logger structuré (JSON) pour l'intégration avec une stack d'observabilité (Loki/Prometheus). | 🟡 Faible |
| **README désynchronisé du code livré** | Toute la documentation Docker/Swarm/CI du README ne correspond à aucun fichier réel du dépôt (voir constat préalable) — risque de décisions prises sur une base documentaire non vérifiable. | 🔴 Élevé (fiabilité de l'audit lui-même) |

---

## 7. Recommandation

**GARDER** : le code applicatif métier (3 microservices Express + modèles Mongoose + contrôleurs + middleware JWT + frontend Vue/Vuex), la logique 12-factor par variables d'environnement, le découpage "1 base Mongo par service", les endpoints `/api/health` comme point de départ, et les suites de tests Jest/Vitest existantes. Tout ceci est fonctionnel, indépendant de l'infrastructure et directement portable.

**REPARTIR DE ZÉRO** pour absolument toute la couche infrastructure/déploiement : Dockerfiles (inexistants), manifests K8s, pipeline CI/CD, stratégie GitOps et configuration du monitoring — rien n'existe à convertir, et ce qui existait en documentation (Swarm, GitLab CI interne) ne correspond de toute façon pas au modèle cible (K3s + ArgoCD/Flux + Prometheus/Grafana).

En résumé : c'est un **portage applicatif**, pas une migration d'infrastructure — le gain de réutilisation se situe à 100% dans le code Node.js/Vue existant (avec un nettoyage ciblé : secrets, healthchecks, fallback JWT, `.env` du frontend), et à 0% dans l'outillage Docker/CI/déploiement, qu'il faut concevoir intégralement pour K3s/GitOps.
