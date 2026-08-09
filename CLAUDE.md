# CLAUDE.md — La Grenaille · Backend

API NestJS + Prisma/PostgreSQL de **La Grenaille**, fonderie de bijoux.
Documentation détaillée : [`docs/`](docs/README.md). Démarrage rapide : [`ReadMe.md`](ReadMe.md). Déploiement : [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Le contexte en 30 secondes

La Grenaille fond des bijoux pour des professionnels. Ses clients lui **confient du métal précieux**, d'où le concept central de **compte poids** : un solde en grammes d'or fin, d'argent fin ou de platine, crédité au dépôt, débité à la fonte. Un solde négatif = le client doit du métal à la fonderie.

Ce n'est **pas** une boutique en ligne : les commandes se passent par email à `contact@lagrenaille.fr`. L'app sert à consulter son compte poids, suivre ses commandes, récupérer ses factures et sa bibliothèque de moules et de STL.

## Ce repo n'est qu'un tiers du projet

Trois dépôts git **indépendants**, côte à côte dans un dossier parent non versionné :

| Repo | Rôle | Branche |
|---|---|---|
| `Le-creuset-backend` (**ici**) | API REST | `develop` |
| `Le-creuset` | SPA React | `develop` |
| `vps_infra` | Provisionnement VPS (Ansible) | `main` |

**Aucun commit transverse n'est possible.** Une fonctionnalité full-stack = 2 commits, 2 PR, 2 pipelines. **Déployer le back en premier** quand il introduit un endpoint ou un champ, et garder l'API rétrocompatible le temps que le front suive.

## Où poser quoi

| Je veux… | Fichiers |
|---|---|
| changer le modèle de données | `prisma/schema.prisma` **+ migration obligatoire** dans `prisma/migrations/` |
| ajouter une règle métier | `src/<module>/<module>.service.ts` (+ le `.spec.ts` à côté) |
| ajouter une route | `src/<module>/<module>.controller.ts` — préfixe global `/api` |
| restreindre l'accès | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("ADMIN")` |
| valider une entrée | schéma **Zod** dans `src/<module>/dto/` — `ZodValidationPipe` est global |
| changer un email transactionnel | `src/mail/mail.service.ts` |
| toucher au stockage de fichiers | `src/storage/` (driver `local` ou `minio`) |

## Règles métier à ne pas casser

1. **Comptes poids : 3 métaux actifs seulement.** `ACTIVE_BASE_METALS = [OR_FIN, ARGENT_FIN, PLATINE]` dans `src/weights/weights.service.ts`. `PALLADIUM` existe encore dans l'enum Prisma mais est filtré partout — ne pas le réactiver sans validation.
2. **Métal pur ≠ alliage.** `BaseMetalType` (comptes poids) et `MetalType` (commandes/devis) sont deux enums distinctes. Le mapping se fait dans `closeOrder` (`src/orders/orders.service.ts`).
3. **Trois façons de retirer un compte, ne pas les confondre :**
   - `PATCH /users/:id/status` → `SUSPENDED` : désactivation douce, réversible, login bloqué. **Voie par défaut.**
   - `PATCH /users/:id/status` → `REJECTED` sur un `PENDING` : suppression réelle (aucune donnée liée à ce stade).
   - `DELETE /users/:id` : purge définitive en cascade. **Irréversible.**
4. **Passage à `ACTIVE` = initialisation des comptes poids**, mais uniquement s'il n'en existe aucun (sinon la réactivation d'un compte suspendu les dupliquerait).
5. **Bibliothèque en écriture admin seulement.** `POST`/`PATCH`/`DELETE` sur `/molds` et `/library` sont `@Roles("ADMIN")`. Le client ne dépose pas de fichier — l'admin les archive après coup.
6. **Les commandes arrivent par email.** `POST /orders/manual` est le vrai chemin de création côté admin. Ne pas réintroduire de parcours de commande en self-service sans validation.

## Conventions

- **Validation : Zod via `nestjs-zod`**, pas `class-validator`. Un DTO sans schéma Zod n'est **pas** validé.
- **Un `.spec.ts` par controller et par service.** Mocks Prisma partagés dans `src/common/test-utils.ts`.
- **Placement des guards non uniforme** : `orders`, `invoices`, `invoice-groups` posent `JwtAuthGuard` sur le contrôleur ; `users` le pose route par route. **Vérifier avant d'ajouter un endpoint** — une route `users` sans `@UseGuards` est publique.
- **Prisma** : `snake_case` en base via `@map`/`@@map`, `camelCase` en TS.
- **Langue** : messages d'erreur, emails et commentaires métier en français ; code en anglais.
- `ConfigModule` lit `.env.local` **puis** `.env` — `.env.local` gagne, pratique pour les surcharges non versionnées.

## Commandes

```bash
docker compose -f docker-compose.local.yml up -d
```

```bash
pnpm install && pnpm prisma:generate && pnpm prisma:migrate && pnpm start:dev
```

```bash
npx jest
```

## Pièges connus

- **`.env.example` est désaligné de `docker-compose.local.yml`.** L'exemple donne `lecreuset:lecreuset_secret@…/lecreuset`, le compose crée `root`/`root` sur la base `lagrenaille-db`. Corriger `DATABASE_URL` après un `cp .env.example .env` :
  ```
  DATABASE_URL="postgresql://root:root@localhost:5433/lagrenaille-db?schema=public"
  ```
- Le port `5433` peut être squatté par un autre conteneur Postgres.
- `prisma generate` marche hors-ligne ; `prisma migrate deploy` exige la base démarrée.
- **`pnpm test:e2e` est déclaré mais le dossier `test/` n'existe pas.** Il n'y a aucun test e2e.
- **Aucun seed** : `prisma:seed` est déclaré, aucun fichier de seed n'existe. Voir [`docs/03-dev-local.md`](docs/03-dev-local.md) pour créer un premier admin.
- `deploy-dev.yml` ne fait **que** lint/test/build — malgré son nom et malgré `DEPLOYMENT.md`, il ne déploie rien.

## Dettes ouvertes

Détaillées dans [`docs/05-audit-retours-clients.md`](docs/05-audit-retours-clients.md). Les deux plus urgentes :

- 🔴 **`GET /users/:id` renvoie `passwordHash`** et toutes les données personnelles de n'importe quel utilisateur à n'importe quel compte connecté (`findById` fait un `findUnique` sans `select`).
- 🔴 **Aucune route client sur `/invoice-groups`** : un client dont les commandes sont facturées en groupe ne voit aucune facture.
