# E-Commerce Vue — Migration K3s / GitOps / Observabilité

Migration d'une application e-commerce (Vue 3 + 3 microservices Node/Express + MongoDB) depuis une stack Docker Swarm/PM2 documentée mais non fonctionnelle, vers un déploiement Kubernetes (K3s) piloté par GitOps (ArgoCD) avec supervision Prometheus/Grafana.

> L'audit de réutilisabilité du projet source se trouve dans [AUDIT_REUSE.md](AUDIT_REUSE.md). Ce README documente ce qui a été **effectivement construit**.

Repo GitOps : https://github.com/samirlbai/ecommerce-k8s-gitops

---

## 1. Architecture

```
                        ┌─────────────────────────┐
   Navigateur  ───────▶ │  Ingress (Traefik) :80   │
                        └────────────┬─────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │  frontend (nginx + Vue 3) │
                        │  proxy interne /api/*     │
                        └───┬───────┬───────┬───────┘
                            │       │       │
                 /api/auth/ │       │/api/products  │/api/orders
                            │       │/api/cart      │
                    ┌───────▼──┐ ┌──▼──────────┐ ┌──▼───────────┐
                    │auth-svc  │ │product-svc  │ │order-svc     │
                    │:3001     │ │:3000        │ │:3002         │
                    └───┬──────┘ └──┬──────────┘ └──┬───────────┘
                        │           │                │
                        └───────────┼────────────────┘
                                    ▼
                             MongoDB (1 pod, 3 bases logiques)
```

- **Frontend** : Vue 3 (Vite), servi par nginx non-root, proxy interne `/api/*` vers les 3 backends (pas d'appel direct backend depuis le navigateur).
- **auth-service** : inscription/connexion, JWT (HS256).
- **product-service** : catalogue produits + panier (pas d'authentification JWT — accès par header `userId` uniquement, dette héritée du projet source, documentée dans l'audit).
- **order-service** : commandes, routes protégées par JWT, vérifie le stock auprès de `product-service`.
- **MongoDB** : un seul pod, 3 bases logiques (`auth`, `ecommerce`, `orders`).

## 2. Stack infrastructure

| Composant | Choix | Détail |
|---|---|---|
| Orchestrateur | K3s v1.36 | single-node, sous WSL2 (Ubuntu) |
| Registry d'images | GHCR | `ghcr.io/samirlbai/{frontend,auth-service,product-service,order-service}` |
| CI | GitHub Actions | build + push automatique sur chaque push `main`, tag = short SHA + `latest` |
| GitOps | ArgoCD v3.5 | auto-sync + self-heal + prune, source = ce repo, path `k8s/` (récursif) |
| Ingress | Traefik (intégré K3s) | routing unique `/` → `frontend`, path-based en interne |
| Monitoring | kube-prometheus-stack (Helm) | Prometheus + Grafana + kube-state-metrics + node-exporter, Alertmanager désactivé (hors scope) |

## 3. Déploiement (résumé)

```bash
# Cluster
curl -sfL https://get.k3s.io | sh -

# ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/application.yaml   # auto-sync + self-heal + recurse:true

# Monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f monitoring/values-kube-prometheus-stack.yaml
```

Ensuite, tout changement applicatif suit le flux GitOps standard : `git push` → CI build+push l'image → mise à jour du tag dans `k8s/*/deployment.yaml` → `git push` → ArgoCD détecte et applique automatiquement (aucun `kubectl apply` manuel sur les ressources applicatives).

## 4. Journal de bord

| Jour | Contenu |
|---|---|
| J1 | Environnement (systemd, k3s, docker, gh, node), audit du code source, 3 fixes appliqués, Dockerfiles écrits from scratch (aucun n'existait), images poussées sur GHCR |
| J2 | Manifests K8s complets : namespace, Mongo (+ PVC), secrets, 3 backends, frontend, ingress |
| J3 | Pipeline CI GitHub Actions : build+push automatique sur push `main`, 4 jobs (1 par service) |
| J4 | ArgoCD installé, Application déclarative (auto-sync/self-heal), boucle GitOps prouvée par un aller-retour de scaling via git |
| J5 | kube-prometheus-stack installé (values allégées pour l'environnement WSL2), 28 dashboards Grafana par défaut |
| J6 | Migration du disque WSL2 (C:→D:, disque saturé), tests bout en bout réels via navigateur headless, bug découvert et corrigé, captures d'écran, ce rapport |

## 5. Incidents rencontrés et résolus

Cette section documente les problèmes réels rencontrés en cours de route — ils font partie du travail autant que le résultat final.

### 5.1 Corruption SQLite k3s (disque C: saturé pendant l'install ArgoCD)

Le disque Windows C: est tombé à 0,18 Go libre pendant un `kubectl apply` volumineux (manifests ArgoCD), provoquant une corruption de la base SQLite embarquée de k3s (`database disk image is malformed`) puis une indisponibilité complète de WSL2 (erreurs I/O jusqu'au niveau `getpwnam`). Résolu par libération d'espace (nettoyage DISM/Windows Update) puis `wsl --shutdown`/relance — l'état du cluster a survécu, à l'exception d'un CRD (`applicationsets.argoproj.io`) resté bloqué en `Installing`, recréé manuellement.

### 5.2 Bug de configuration ArgoCD : sous-dossiers non gérés

Le manifest `Application` initial ne précisait pas `directory.recurse: true`. Résultat : seuls les fichiers YAML à la racine de `k8s/` étaient appliqués par ArgoCD (namespace, secrets, ingress) — **aucun Deployment ni Service** (tous dans des sous-dossiers `k8s/<service>/`) n'était réellement synchronisé. Découvert en testant la boucle GitOps (un changement de replicas n'avait aucun effet). Corrigé en ajoutant `directory.recurse: true`.

### 5.3 Secret JWT écrasé puis supprimé par ArgoCD

`secret.example.yaml` (gabarit de documentation, valeurs placeholder) se trouvait dans `k8s/`, donc scanné et appliqué par ArgoCD — qui a écrasé le vrai `JWT_SECRET` par la valeur placeholder du dépôt public. En sortant ce fichier de `k8s/`, `prune: true` a ensuite **supprimé** les secrets (plus aucune déclaration git) au lieu de simplement arrêter de les gérer. Résolu par : déplacement définitif de `secret.example.yaml` à la racine du repo, régénération d'un nouveau `JWT_SECRET`, redémarrage des pods concernés pour cohérence. Vérifié par un test bout en bout réel (token émis par `auth-service`, accepté par `order-service`).

### 5.4 Disque C: structurellement trop juste → migration WSL2 vers D:

Après l'install de kube-prometheus-stack, retour à 0,82 Go libres sur C:. Migration complète du disque virtuel WSL2 de C: vers D: (export/unregister/import), avec vérification de taille avant toute suppression irréversible. Une instabilité post-migration (redémarrages en boucle de k3s, `WaitForBootProcess` en timeout côté WSL2) s'est résolue avec un simple `wsl --shutdown` + relance, sans nécessiter d'exclusion antivirus.

**Preuve de stabilité post-migration** — deux relevés `kubectl get pods -A` séparés de plus de 5 minutes (13 min réelles entre les deux, aucune commande `kubectl apply`/`rollout`/`delete` entre-temps), compteurs `RESTARTS` comparés pod par pod :

| Pod | RESTARTS (relevé 1) | RESTARTS (relevé 2, +13 min) | Nouveau restart ? |
|---|---|---|---|
| argocd-application-controller-0 | 22 | 22 | non |
| argocd-applicationset-controller | 18 | 18 | non |
| argocd-dex-server | 21 | 21 | non |
| argocd-notifications-controller | 22 | 22 | non |
| argocd-redis | 21 | 21 | non |
| argocd-repo-server | 22 | 22 | non |
| argocd-server | 22 | 22 | non |
| auth-service | 18 | 18 | non |
| frontend | 0 | 0 | non |
| mongo | 22 | 22 | non |
| order-service | 19 | 19 | non |
| product-service | 18 | 18 | non |
| coredns | 22 | 22 | non |
| local-path-provisioner | 24 | 24 | non |
| metrics-server | 24 | 24 | non |
| svclb-traefik | 44 | 44 | non |
| traefik | 23 | 23 | non |
| grafana | 39 | 39 | non |
| kube-state-metrics | 14 | 14 | non |
| prometheus-operator | 13 | 13 | non |
| node-exporter | 15 | 15 | non |
| prometheus | 24 | 24 | non |

**22/22 pods actifs : compteurs strictement identiques entre les deux relevés.** Les chiffres non nuls proviennent des cycles d'instabilité antérieurs à la stabilisation (§5.1 et la phase immédiatement post-migration) — aucun n'a bougé depuis. Le cluster est confirmé stable sur D:.

### 5.5 Bug applicatif trouvé par le test E2E : `GET /api/cart` → 301

Le test bout en bout (navigateur headless, voir §6) a révélé que `GET /api/cart` renvoyait un `301 Moved Permanently` au lieu des données du panier, bloquant l'affichage du panier après ajout d'un produit. Cause : `location /api/cart/` dans `nginx.conf` (slash final) ne correspond pas à la requête `GET /api/cart` (sans slash) envoyée par le frontend — incohérence avec `/api/products` et `/api/orders`, écrits sans slash final. Corrigé (`location /api/cart` sans slash), rebuild via CI, redéploiement via ArgoCD, re-testé avec succès (voir captures 03-05).

## 6. Test bout en bout

Réalisé avec Playwright (Chromium headless) piloté directement — `chromium-cli` n'étant pas disponible dans l'environnement, un script Node minimal a été écrit (`~/e2e-test/e2e.js`, non versionné, réutilisable).

Scénario couvert, sur l'application réellement déployée (via l'Ingress, pas de port-forward direct sur les backends) :

1. Inscription d'un nouvel utilisateur
2. Connexion automatique, affichage du catalogue (3 produits seedés via l'API pour la démo)
3. Ajout d'un produit au panier
4. Consultation du panier (total calculé)
5. Saisie de l'adresse de livraison et confirmation de la commande
6. Vérification de la commande dans l'historique

Résultat : **succès de bout en bout, 0 erreur console navigateur**, après correction du bug §5.5.

## 7. Tests unitaires

Les 3 backends ont des suites Jest existantes (héritées du projet source). Elles ne tournaient pas au moment de la reprise du projet — vérifié en les exécutant réellement (`npm test`), pas supposé.

**État initial (avant correction) :**

| Service | Résultat | Cause |
|---|---|---|
| `auth-service` | 0/10 — suite ne démarre même pas | `JWT_SECRET environment variable is required` : `tests/setup.js` charge un `.env.test` qui n'existait pas dans le dépôt |
| `product-service` | 0/3 — process planté (`UnhandledPromiseRejection`) | `Mongod instance closed with code "127"` |
| `order-service` | 0/9 | `Instance failed to start because a library is missing or cannot be opened: "libcrypto.so.1.1"` |

En creusant la cause réelle du code 127 (`product-service`) avec le binaire `mongod` exécuté directement : même erreur `libcrypto.so.1.1` que les deux autres. **Racine commune aux 3 services** : `mongodb-memory-server` était épinglé sur MongoDB **4.4.18**, compilé contre OpenSSL 1.1 — absent d'Ubuntu 24.04 (WSL2 actuel, et des runners GitHub Actions modernes, donc le problème n'est pas spécifique à cette machine). C'est exactement le risque déjà identifié dans [AUDIT_REUSE.md](AUDIT_REUSE.md) (§6, "MongoDB obsolète") avant même de commencer l'infrastructure — resté non corrigé jusqu'ici.

`product-service` avait un second problème propre : `mongodb-memory-server` y était resté en version `^6.9.6` (contre `^8.12.2` pour auth-service et `^9.1.1` pour order-service — la divergence de versions déjà pointée dans l'audit). Cette version ancienne détecte l'OS hôte comme `ubuntu1804` (table de détection obsolète, ne connaît pas Ubuntu 24.04), et aucune version récente de MongoDB n'est publiée pour cette distro — téléchargement en 403 quelle que soit la version demandée.

**Corrections appliquées (pas de contournement local, portable pour CI) :**

1. `.env.test` créés pour `auth-service`/`order-service` (`JWT_SECRET` factice, valeur de test uniquement) — exception explicite ajoutée au `.gitignore` (`!.env.test`) pour que ce fichier soit versionné, sinon la suite échoue chez quiconque clone le dépôt
2. MongoDB **4.4.18 → 8.0.4** (OpenSSL 3, plus de dépendance à `libcrypto.so.1.1`) dans les 3 services
3. `product-service` : `mongodb-memory-server` mis à jour `^6.9.6 → ^11.2.0`, API modernisée (`MongoMemoryServer.create()` / `.getUri()` au lieu du constructeur `new MongoMemoryServer()` déprécié)
4. `product-service` : `storageEngine: 'ephemeralForTest'` (retiré de MongoDB depuis plusieurs versions majeures) remplacé par `wiredTiger`, comme les deux autres services

**Résultat après correction, vérifié par exécution réelle :**

| Service | Résultat |
|---|---|
| `auth-service` | **10/10 ✓** |
| `product-service` | **3/3 ✓** |
| `order-service` | **9/9 ✓** |
| **Total** | **22/22 ✓** |

Limite assumée et non corrigée : la couverture de `product-service` reste faible (3 tests seulement, contre 10 et 9 pour les deux autres) — déjà signalé dans l'audit initial, pas dans le scope de ce projet infrastructure. Les tests ne sont par ailleurs **pas encore intégrés au pipeline CI** ([.github/workflows/build-push.yml](.github/workflows/build-push.yml) ne fait que build+push, aucune étape `npm test`) — ils passent en local, vérifié manuellement, mais rien ne bloque aujourd'hui un merge qui casserait un test.

## 8. Captures d'écran

Toutes dans [docs/screenshots/](docs/screenshots/).

| # | Capture | Contenu |
|---|---|---|
| 01 | `01-home-auth.png` | Page d'accueil, formulaires inscription/connexion |
| 02 | `02-products-logged-in.png` | Catalogue après connexion |
| 03 | `03-cart-with-item.png` | Panier avec produit ajouté et total (post-fix §5.5) |
| 04 | `04-checkout-address-filled.png` | Formulaire d'adresse de livraison rempli |
| 05 | `05-order-history.png` | Commande confirmée dans l'historique |
| 06 | `06-argocd-apps-list.png` | ArgoCD — vue applications |
| 07 | `07-argocd-app-detail.png` | ArgoCD — détail `ecommerce`, Synced/Healthy, arbre des 12 ressources gérées |
| 08 | `08-grafana-dashboards-list.png` | Grafana — liste des 28 dashboards par défaut |
| 09 | `09-grafana-cluster-dashboard.png` | Grafana — dashboard cluster, métriques CPU/mémoire réelles par namespace |

## 9. Limites connues / dette assumée

- **`product-service` : aucune vérification JWT sur les routes panier.** [`cartRoutes.js`](services/product-service/src/routes/cartRoutes.js) lit `userId` directement depuis un header HTTP non signé (`req.headers.userid`), sans passer par un middleware d'authentification — contrairement à `auth-service` et `order-service`, qui vérifient tous deux un JWT valide (`middleware/auth.js`) avant d'exposer leurs routes protégées. N'importe quel appelant peut donc lire/modifier le panier de n'importe quel `userId` en le devinant. C'est une dette héritée du projet source (documentée dans [AUDIT_REUSE.md](AUDIT_REUSE.md)), **assumée comme un choix de scope explicite et non corrigée** : ce projet porte sur l'infrastructure (K8s/GitOps/observabilité), pas sur une refonte applicative du code métier existant.
- Alertmanager désactivé (hors scope pédagogique de ce projet).
- Cluster single-node : pas de test de résilience multi-nœud (non applicable à K3s en environnement local WSL2).
- Rétention Prometheus volontairement courte (1 jour / 500 Mo) pour limiter l'empreinte disque sur l'environnement de développement.
