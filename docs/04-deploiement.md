# 04 — Déploiement

Détails opérationnels (domaines, secrets, variables de prod) : [`DEPLOYMENT.md`](../DEPLOYMENT.md). Ce document décrit la **mécanique** et ses écarts par rapport à ce qui est documenté ailleurs.

## Environnements

| | Branche | URL |
|---|---|---|
| Production API | `main` | `https://api.lagrenaille.fr` |
| Développement API | `develop` | `https://api.dev.lagrenaille.fr` |

Le front correspondant : `https://lagrenaille.fr` (prod) et `https://dev.lagrenaille.fr` (dev).

## Chaîne réelle

```
push develop  ──►  deploy-dev.yml : lint + tests + build       ← AUCUN déploiement
push main     ──►  deploy.yml : image Docker ──► ghcr.io ──► SSH VPS ──► compose up
```

> ⚠️ **Écart avec `DEPLOYMENT.md`.** Ce dernier décrit un environnement de dev déployé depuis `develop`, mais `.github/workflows/deploy-dev.yml` ne contient **qu'un seul job** (`checks`) : lint, tests, build. Il ne construit ni ne pousse d'image, et ne se connecte à aucun serveur. Malgré son nom, il ne déploie rien. Soit l'environnement de dev est déployé à la main, soit le job a été retiré — à clarifier avant de s'y fier.

## CI — `develop`

`.github/workflows/deploy-dev.yml`, déclenché sur `push` et `pull_request` vers `develop`, plus `workflow_dispatch`.

Job `checks` :

```
pnpm install → prisma generate → lint → jest → build
```

Le `prisma generate` **avant** le lint est indispensable : sans client généré, les types Prisma manquent et le lint casse.

## CD — `main`

`.github/workflows/deploy.yml`, déclenché sur `push` vers `main` et `workflow_dispatch`. Deux jobs :

1. **`build-and-push`** — build Docker (Buildx), push vers **GitHub Container Registry** (`ghcr.io`), tags issus de `docker/metadata-action`.
2. **`deploy`** — prépare le dossier cible sur le VPS, y copie les fichiers de déploiement (`.deploy/`, `docker-compose.prod.yml`), puis se connecte en SSH pour tirer l'image et relancer la stack.

Secrets attendus : hôte, utilisateur et clé SSH du VPS, plus les variables d'environnement de production (liste dans [`DEPLOYMENT.md`](../DEPLOYMENT.md)).

## Image

`Dockerfile` → Node + build NestJS. `docker-entrypoint.sh` **applique les migrations Prisma au démarrage du conteneur**, puis lance l'API.

Conséquence : une migration destructive part en production dès le merge sur `main`. À vérifier avant, pas après.

## Fichiers de déploiement

```
Dockerfile                 image de production
docker-entrypoint.sh       migrations puis démarrage
docker-compose.prod.yml    stack de production
docker-compose.dev.yml     environnement de dev serveur
docker-compose.local.yml   dépendances locales (Postgres + MinIO)
.deploy/                   fichiers copiés sur le VPS
.env.production            gabarit des variables de prod
DEPLOYMENT.md              domaines, secrets, variables
```

## Infrastructure : le repo `vps_infra`

Le VPS Ubuntu est provisionné par un projet Ansible séparé (`benaja-bendo/vps_infra`, branche `main`), joué à la main.

Rôles actifs : `setup` (Docker), `traefik` (reverse proxy + TLS), `portainer`, `postgres`, `adminer`, `minio`, `dozzle` (logs).
Rôles présents mais **commentés** dans le playbook : `cloudbeaver`, `rabbitmq` (la file de messages n'est pas utilisée par l'application).

```bash
ansible-playbook -i inventory.ini playbook.yml --tags traefik
```

## Livrer une fonctionnalité full-stack

Il n'y a pas de commit transverse entre ce repo et le front. L'ordre compte :

1. développer sur `develop` des deux côtés ;
2. **déployer le back en premier** s'il introduit un endpoint ou un champ ;
3. déployer le front ensuite ;
4. si le changement d'API est cassant, prévoir une période de compatibilité (nouveau champ optionnel, ancien endpoint conservé) — sinon le front en production tape une API qui a déjà changé.
