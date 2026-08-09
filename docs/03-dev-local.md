# 03 — Développement local

## Prérequis

- Node ≥ 20, **pnpm**
- Docker + Docker Compose

## Démarrage

### 1. Infrastructure (Postgres + MinIO)

```bash
docker compose -f docker-compose.local.yml up -d
```

| Service | Conteneur | Ports | Identifiants |
|---|---|---|---|
| PostgreSQL 16 | `lagrenaille-back` | `5433` → 5432 | `root` / `root`, base `lagrenaille-db` |
| MinIO | `lagrenaille-minio` | `9002` (API), `9003` (console) | `root` / `password` |

Console MinIO : `http://localhost:9003`.

Le bloc `api` du compose est commenté — l'API tourne en local hors Docker, en watch.

### 2. Variables d'environnement

```bash
cp .env.example .env
```

⚠️ **Corrigez `DATABASE_URL` immédiatement.** Le `.env.example` contient `postgresql://lecreuset:lecreuset_secret@localhost:5433/lecreuset`, qui **ne correspond pas** au compose. La bonne valeur :

```
DATABASE_URL="postgresql://root:root@localhost:5433/lagrenaille-db?schema=public"
```

| Variable | Rôle | Valeur locale |
|---|---|---|
| `PORT` | port de l'API | `3000` |
| `DATABASE_URL` | connexion Postgres | voir ci-dessus |
| `JWT_SECRET` | signature des tokens | à changer en prod |
| `JWT_EXPIRES_IN` | durée de vie | `7d` |
| `CORS_ORIGIN` | origine autorisée | `*` en local |
| `STORAGE_DRIVER` | `local` ou `minio` | `local` |
| `STORAGE_LOCAL_PATH` | dossier des uploads | `./uploads` |
| `MINIO_*` | endpoint, clés, bucket | utilisé si `STORAGE_DRIVER=minio` |
| `SMTP_*`, `MAIL_FROM` | envoi d'emails | SMTP Infomaniak |
| `FRONTEND_URL` | liens dans les emails | `http://localhost:5173` |

`ConfigModule` lit **`.env.local` puis `.env`** — `.env.local` a la priorité, pratique pour des surcharges non versionnées.

Les variables de production sont documentées dans [`DEPLOYMENT.md`](../DEPLOYMENT.md).

### 3. API

```bash
pnpm install && pnpm prisma:generate && pnpm prisma:migrate && pnpm start:dev
```

API sur `http://localhost:3000/api`, health check sur `/api/health`.

Le front attend `VITE_API_URL=http://localhost:3000/api` — **avec** le suffixe `/api`.

## Pièges connus

| Symptôme | Cause | Solution |
|---|---|---|
| `P1001: can't reach database` | `.env.example` désaligné du compose | corriger `DATABASE_URL` (`root`/`root`, base `lagrenaille-db`) |
| Port 5433 déjà pris | un autre conteneur Postgres le squatte | `docker ps` puis stopper, ou changer le mapping |
| `@prisma/client did not initialize` | client non généré | `pnpm prisma:generate` (marche hors-ligne) |
| `prisma migrate deploy` échoue | base non démarrée | lancer le compose d'abord |
| Le lint casse sur des types Prisma | client non généré avant le lint | `pnpm prisma:generate` — c'est aussi l'ordre appliqué en CI |

## Créer un premier compte admin

Il n'y a **pas de seed** (le script `prisma:seed` est déclaré mais aucun fichier de seed n'existe).

1. S'inscrire via le front (`/register`) → le compte est créé en `PENDING`.
2. Le promouvoir en base :

```bash
docker exec -it lagrenaille-back psql -U root -d lagrenaille-db -c "UPDATE users SET status='ACTIVE', role='ADMIN' WHERE email='votre@email.fr';"
```

3. ⚠️ Cet `UPDATE` direct **ne crée pas les comptes poids** — l'initialisation est déclenchée par `PATCH /users/:id/status`. Pour un compte de test **client**, passez par l'interface admin (*Utilisateurs → Valider*) plutôt que par SQL.

## Tests

```bash
npx jest
```

19 suites, 126 tests, tous au vert (9 août 2026). Aucune base requise — Prisma est mocké via [`src/common/test-utils.ts`](../src/common/test-utils.ts).

```bash
npx jest src/orders
```

```bash
pnpm lint
```

Il n'existe **aucun test e2e** : le script `test:e2e` pointe vers un dossier `test/` inexistant.

## Parcours de recette manuelle

Les tests unitaires mockent Prisma — rien ne traverse la base. Un aller-retour complet sur les deux rôles reste indispensable :

1. **Inscription client** : `/register` avec KBIS + document douane → écran `/waiting-approval`.
2. **Validation admin** : *Utilisateurs* → valider → les 3 comptes poids sont créés.
3. **Crédit métal** : *Comptes Poids* → transaction `CREDIT` sur le compte or fin.
4. **Commande** : *Commandes* → création manuelle avec numéro suggéré → faire évoluer le statut.
5. **Clôture** : clôturer avec un PDF de facture et un débit poids → vérifier que le solde a bougé.
6. **Vue client** : se reconnecter en client → *Mes Factures*, *Mon Compte Poids*, *Mes Commandes*.
7. **Groupement** : créer 2 commandes, les grouper en une facture → **vérifier ce que le client voit** (aujourd'hui : rien, voir [l'audit](05-audit-retours-clients.md)).
8. **Bibliothèque** : déposer un STL et un moule côté admin → vérifier l'affichage et le viewer 3D côté client, y compris sur mobile.
