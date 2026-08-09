# Documentation — Backend La Grenaille

API NestJS + Prisma/PostgreSQL de **La Grenaille**, fonderie de bijoux.

Écrite le 9 août 2026 à partir d'une lecture du code réel. Guide opérationnel condensé : [`../CLAUDE.md`](../CLAUDE.md).

## Sommaire

| # | Document | Contenu |
|---|---|---|
| 01 | [Domaine métier](01-domaine-metier.md) | Architecture 3-repos, modèle de données, cycles de vie, règles |
| 02 | [API](02-api.md) | Modules NestJS, auth, carte complète des endpoints, Prisma |
| 03 | [Dev local](03-dev-local.md) | Démarrer la stack, variables, pièges, tests |
| 04 | [Déploiement](04-deploiement.md) | CI/CD GitHub Actions, Docker, VPS Ansible |
| 05 | [Audit des retours clients](05-audit-retours-clients.md) | Ce qui est fait / partiel / à faire, côté back |

Voir aussi, à la racine du repo : [`ReadMe.md`](../ReadMe.md) (démarrage express) et [`DEPLOYMENT.md`](../DEPLOYMENT.md) (domaines, secrets, variables de prod).

## Périmètre

Cette documentation couvre **ce repo uniquement**. Le front vit dans le dépôt `Le-creuset` et porte sa propre `docs/` :

| Sujet | Où |
|---|---|
| Modèle de données, règles métier, cycles de vie | **ici** — `prisma/schema.prisma` est la source de vérité |
| Endpoints, auth, guards | **ici** |
| Routing, pages, composants, conventions UI | repo `Le-creuset` → `docs/02-frontend.md` |
| Architecture 3-repos, contexte produit | dupliqué des deux côtés (versions adaptées) |

## Démarrage rapide

```bash
docker compose -f docker-compose.local.yml up -d && pnpm install && pnpm prisma:generate && pnpm prisma:migrate && pnpm start:dev
```

API sur `http://localhost:3000/api`, health check sur `/api/health`.

⚠️ Corriger `DATABASE_URL` après un `cp .env.example .env` — voir [03-dev-local.md](03-dev-local.md).
