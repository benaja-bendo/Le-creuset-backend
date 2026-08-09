# 02 — API

NestJS 10 + Prisma 6 + PostgreSQL. Préfixe global **`/api`**, port **3000**.

## Bootstrap

[`src/main.ts`](../src/main.ts) fait trois choses : CORS (`CORS_ORIGIN`, défaut `*`), `setGlobalPrefix("api")`, écoute sur `PORT`.

[`src/app.module.ts`](../src/app.module.ts) enregistre `ConfigModule` global (lit `.env.local` puis `.env`), les modules métier, et surtout le **pipe de validation global** :

```ts
{ provide: APP_PIPE, useClass: ZodValidationPipe }
```

> La validation se fait donc en **Zod via `nestjs-zod`**, pas en `class-validator`. Un nouveau DTO doit exposer un schéma Zod, sinon il n'est pas validé.

## Modules

```
src/
├── prisma/          PrismaService (client partagé)
├── storage/         upload / lecture de fichiers — driver local ou MinIO
├── mail/            emails transactionnels (nodemailer / SMTP)
├── auth/            JWT, guards, stratégie Passport
├── users/           inscription, profil, validation admin, suppression
├── weights/         comptes poids et transactions métal
├── orders/          commandes, clôture, débit poids
├── invoices/        factures individuelles
├── invoice-groups/  factures groupées (N commandes → 1 facture)
├── molds/           moules physiques
├── library/         fichiers STL archivés
└── common/          test-utils.ts (mocks Jest partagés)
```

Chaque module suit la structure NestJS standard : `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, plus un `*.spec.ts` à côté de chaque controller et service.

## Authentification et autorisation

- **JWT** signé avec `JWT_SECRET`, durée `JWT_EXPIRES_IN` (7 j).
- `JwtStrategy` ([`src/auth/jwt.strategy.ts`](../src/auth/jwt.strategy.ts)) peuple `req.user` avec `{ id, email, role }`.
- Deux guards, appliqués **en pile** :

```ts
@Controller("orders")
@UseGuards(JwtAuthGuard)          // au niveau du contrôleur : authentification
export class OrdersController {

  @Get("all")
  @UseGuards(RolesGuard)          // au niveau de la route : autorisation
  @Roles("ADMIN")
  async getAllOrders() { … }
}
```

> ⚠️ **Le placement varie selon les modules.** `orders`, `invoices`, `invoice-groups` posent `JwtAuthGuard` sur le contrôleur ; `users` le pose route par route. **Vérifier avant d'ajouter un endpoint** — une route `users` sans `@UseGuards` est publique.

- **Login bloqué** pour les statuts `REJECTED` et `SUSPENDED`, avec des messages distincts ([`src/auth/auth.service.ts:134-137`](../src/auth/auth.service.ts)).

## Carte des endpoints

Toutes les URL sont préfixées par `/api`. **A** = réservé `ADMIN`, **C** = tout utilisateur authentifié, **P** = public.

### `/auth`
| | Route | Accès |
|---|---|---|
| POST | `/auth/register` | P |
| POST | `/auth/login` | P |
| POST | `/auth/logout` | C |
| GET | `/auth/me` | C |
| POST | `/auth/forgot-password` | P |
| POST | `/auth/reset-password` | P |
| POST | `/auth/mail-test` | — *(diagnostic SMTP)* |

### `/users`
| | Route | Accès |
|---|---|---|
| POST | `/users/register` | P |
| GET | `/users/me` | C |
| PATCH | `/users/me` | C |
| PATCH | `/users/me/password` | C |
| PATCH | `/users/me/documents` | C |
| GET | `/users/all` | A |
| GET | `/users/pending` | A |
| PATCH | `/users/:id/status` | A |
| PATCH | `/users/:id/documents` | A |
| PATCH | `/users/:id/role` | A |
| DELETE | `/users/:id` | A — **purge définitive en cascade** |
| GET | `/users/:id` | C ⚠️ *voir « Points d'attention »* |

### `/weights`
| | Route | Accès |
|---|---|---|
| GET | `/weights/me` | C |
| GET | `/weights/all` | A — trié solde croissant (dettes en tête) |
| GET | `/weights/user/:userId` | A |
| POST | `/weights/:id/transaction` | A |

### `/orders`
| | Route | Accès |
|---|---|---|
| GET | `/orders/me` | C |
| GET | `/orders/all` | A |
| GET | `/orders` | A — **doublon de `/orders/all`** |
| GET | `/orders/:id` | C ⚠️ |
| POST | `/orders` | C |
| POST | `/orders/manual` | A — création par l'admin après commande email |
| PATCH | `/orders/:id` | A |
| PATCH | `/orders/:id/status` | A |
| POST | `/orders/:id/close` | A — facture + statut `EXPEDIE` + débit poids optionnel |
| DELETE | `/orders/:id` | A — supprime d'abord les factures liées |

### `/invoices`
| | Route | Accès |
|---|---|---|
| GET | `/invoices` | A |
| GET | `/invoices/me` | C |
| GET | `/invoices/user/:userId` | A |
| GET | `/invoices/order/:orderId` | C ⚠️ |
| GET | `/invoices/:id` | C ⚠️ |
| POST | `/invoices` | A |
| DELETE | `/invoices/:id` | A |

### `/invoice-groups` — **entièrement ADMIN**
| | Route | Accès |
|---|---|---|
| POST | `/invoice-groups` | A |
| GET | `/invoice-groups` | A |
| GET | `/invoice-groups/:id` | A |
| PATCH | `/invoice-groups/:id` | A |
| DELETE | `/invoice-groups/:id` | A |

> 🔴 Aucune route client. Un client dont les commandes ont été facturées en groupe **ne voit pas sa facture**.

### `/molds` et `/library`
| | Route | Accès |
|---|---|---|
| GET | `/molds/me` · `/library/me` | C |
| GET | `/molds/all` · `/library/all` | A |
| GET | `/library/user/:userId` | A |
| POST | `/molds` · `/library` | A |
| PATCH | `/molds/:id` · `/library/:id` | A |
| DELETE | `/molds/:id` · `/library/:id` | A |

### `/storage` et `/health`
| | Route | Accès |
|---|---|---|
| POST | `/storage/upload` | multipart, champ `file` |
| GET | `/storage/file/:path` | lecture d'un fichier |
| GET | `/health` | P |

## Stockage de fichiers

Driver commutable par `STORAGE_DRIVER` :

| Valeur | Implémentation | Emplacement |
|---|---|---|
| `local` *(défaut en dev)* | `src/storage/local-storage.service.ts` | `uploads/`, servi via `GET /api/storage/file/:path` |
| `minio` *(prod)* | `src/storage/minio-storage.service.ts` | bucket `MINIO_BUCKET` |

Les deux respectent `src/storage/storage.interface.ts`. Les URL renvoyées peuvent être relatives — le front les résout avec son helper `resolveUrl()`.

## Emails

[`src/mail/mail.service.ts`](../src/mail/mail.service.ts) — `nodemailer` sur SMTP (Infomaniak par défaut), expéditeur `MAIL_FROM`. Utilisé pour la validation de compte, la réinitialisation de mot de passe et les notifications de commande. Une variable `RESEND_API_KEY` traîne dans `.env.example` mais Resend n'est pas utilisé.

## Base de données

```bash
pnpm prisma:generate   # génère le client — fonctionne hors-ligne
```

```bash
pnpm prisma:migrate    # crée + applique une migration (base requise)
```

```bash
pnpm prisma:studio     # inspecteur graphique
```

Migrations existantes :

```
20260117141822_init_prd
20260218220012_init_local
20260304033040_init_la_grenaille
20260601120000_dashboard_pro_improvements
20260601204115_
20260606110139_add_order_number
```

> Tout changement de `schema.prisma` **exige** une migration. Ne jamais utiliser `prisma db push` sur une base partagée.
> `docker-entrypoint.sh` applique les migrations au démarrage du conteneur : une migration destructive doit être vérifiée **avant** le merge sur `main`.

## Tests

```bash
npx jest
```

**19 suites, 126 tests, tous au vert** (vérifié le 9 août 2026). Aucune base requise — Prisma est mocké via [`src/common/test-utils.ts`](../src/common/test-utils.ts).

```bash
npx jest src/orders    # une seule suite
```

Le script `test:e2e` est déclaré dans `package.json` mais **le dossier `test/` n'existe pas**.

## Points d'attention repérés à la lecture

Ces points ne viennent pas des retours clients — ils ont été relevés en documentant. À arbitrer.

1. **🔴 `GET /users/:id` fuite le hash de mot de passe.** La route n'exige qu'un JWT valide (n'importe quel rôle) et `usersService.findById()` fait un `findUnique` **sans `select`** — la réponse contient `passwordHash`, plus l'adresse, le téléphone et les URL des documents légaux de n'importe quel utilisateur. Correction : `select` explicite + restriction (`ADMIN` ou propriétaire).
2. **🟠 Accès horizontal non contrôlé.** `GET /orders/:id`, `GET /invoices/:id` et `GET /invoices/order/:orderId` sont authentifiés mais ne vérifient pas la propriété : un client peut lire la commande ou la facture d'un autre en connaissant l'ID (les `cuid` limitent l'exploitation, mais l'ID circule dans les URL du front).
3. **🟠 Numéros non séquentiels.** `orderNumber` et le numéro de facture groupée sont générés par `Date.now().toString().slice(-6)`, côté back **et** côté front. Deux créations dans la même fenêtre de troncature violent la contrainte `@unique` et remontent une erreur Prisma brute.
4. **🟡 Débit poids silencieux.** Dans `closeOrder`, si le compte poids du métal visé n'existe pas, le débit est ignoré sans erreur.
5. **🟡 Route en double.** `GET /orders` et `GET /orders/all` appellent le même `findAll()`.
6. **🟡 `invoiceGroups.update()` ne peut pas modifier la composition d'un groupe** (le DTO ne porte pas `orderIds`) et `remove()` s'appuie sur le `SetNull` implicite de Prisma pour délier les commandes, sans le rendre explicite.
