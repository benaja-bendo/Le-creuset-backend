# 01 — Architecture et domaine métier

Source de vérité du modèle : [`prisma/schema.prisma`](../prisma/schema.prisma).

---

## Partie 1 — Architecture

### Trois dépôts indépendants

Le projet n'est **pas** un monorepo. Trois dépôts git autonomes vivent côte à côte dans un dossier parent qui n'est lui-même pas versionné :

| Repo | Remote | Branche | Rôle |
|---|---|---|---|
| `back/` (**ici**) | `benaja-bendo/Le-creuset-backend` | `develop` | API REST |
| `front/` | `benaja-bendo/Le-creuset` | `develop` | SPA React |
| `vps_infra/` | `benaja-bendo/vps_infra` | `main` | Provisionnement serveur |

**Conséquences :**
- pas de commit atomique full-stack — une feature = 2 commits, 2 PR, 2 pipelines ;
- **déployer le back en premier** quand il introduit un endpoint ou un champ ;
- si le changement d'API est cassant, prévoir une fenêtre de compatibilité (champ optionnel, ancien endpoint conservé) — sinon le front en production tape une API qui a déjà changé.

### Flux

```
Navigateur
    │
    ├─ SPA React servie par nginx
    │
    └─ fetch  ──►  VITE_API_URL  ──►  NestJS, préfixe global /api   ◄── ce repo
                                          │
                                          ├─► PostgreSQL   (Prisma)
                                          ├─► MinIO / disque  (uploads, PDF, STL, photos)
                                          └─► SMTP           (emails transactionnels)
```

Le préfixe `/api` est posé dans [`src/main.ts`](../src/main.ts) (`app.setGlobalPrefix("api")`). CORS piloté par `CORS_ORIGIN`.

### Stack

| | |
|---|---|
| Framework | NestJS 10 |
| ORM | Prisma 6 · PostgreSQL 16 |
| Validation | Zod via `nestjs-zod` (`ZodValidationPipe` global) |
| Auth | JWT (`@nestjs/jwt` + Passport), expiration 7 j |
| Stockage | MinIO (S3) ou disque local — driver commutable |
| Email | `nodemailer` sur SMTP |
| Tests | Jest — 19 suites, 126 tests unitaires |
| Package manager | pnpm |

---

## Partie 2 — Le domaine

### Le concept central : le compte poids

Les clients de La Grenaille sont des bijoutiers professionnels qui **confient du métal précieux** à la fonderie.

Chaque client dispose donc d'un **compte poids par métal pur** (`MetalAccount`), en grammes à 3 décimales :

- **crédit** = le client dépose du métal ;
- **débit** = une commande est fondue et consomme du métal ;
- **solde négatif** = le client doit du métal à la fonderie. La vue admin trie par solde croissant pour faire remonter les dettes.

**Trois métaux seulement sont actifs** — `ACTIVE_BASE_METALS` dans [`src/weights/weights.service.ts`](../src/weights/weights.service.ts) :

```
OR_FIN · ARGENT_FIN · PLATINE
```

`PALLADIUM` reste dans l'enum `BaseMetalType` mais est **filtré partout** (lecture, agrégation, initialisation). Choix délibéré : pas de migration destructive sur les comptes existants, on les masque.

### Métal pur vs alliage

| Enum | Usage | Valeurs |
|---|---|---|
| `BaseMetalType` | comptes poids — **métal pur** | `OR_FIN`, `ARGENT_FIN`, `PLATINE`, (`PALLADIUM` inactif) |
| `MetalType` | commandes / devis — **alliage ou service** | `OR_JAUNE_375/750`, `OR_ROSE_375/750`, `OR_GRIS_375/750`, `OR_GRIS_750_PALLADIE_13`, `OR_ROUGE_750`, `PLATINE_950`, `PALLADIUM`, `ARGENT_925`, `PROTO_VISUEL`, `IMPRESSION_CIRE` |

Le mapping alliage → métal pur se fait au débit, dans `closeOrder` ([`src/orders/orders.service.ts`](../src/orders/orders.service.ts)), par simple préfixe :

```
"OR_*"       → OR_FIN
"ARGENT_*"   → ARGENT_FIN
"PLATINE_*"  → PLATINE
"PALLADIUM"  → PALLADIUM
```

> ⚠️ Ce mapping est textuel et ignore le titre. Un `OR_JAUNE_375` débite `OR_FIN` du poids saisi tel quel — c'est à l'admin de saisir la masse d'**or fin**, pas la masse de la pièce.

### Modèle de données

```
User ─┬─ MetalAccount ── Transaction
      ├─ Order ──┬─ Invoice
      │          └─ InvoiceGroup (n commandes → 1 facture groupée)
      ├─ Invoice
      ├─ InvoiceGroup
      ├─ Mold            (moules physiques, photo)
      ├─ LibraryFile     (fichiers STL du client, déposés par l'admin)
      ├─ Quote ── File
      └─ File
```

| Modèle | Table | Rôle |
|---|---|---|
| `User` | `users` | Compte, rôle, statut, documents légaux (KBIS, douane) |
| `MetalAccount` | `metal_accounts` | Solde en g d'un métal pur pour un client |
| `Transaction` | `transactions` | Mouvement `DEBIT` / `CREDIT` sur un compte |
| `Order` | `orders` | Commande : statut, `orderNumber`, STL, alliage, quantité, prix estimé |
| `Invoice` | `invoices` | Facture individuelle (PDF), liée ou non à une commande |
| `InvoiceGroup` | `invoice_groups` | Facture regroupant N commandes du même client |
| `Mold` | `molds` | Moule physique stocké chez la fonderie |
| `LibraryFile` | `library_files` | Fichier STL archivé pour le client |
| `Quote` | `quotes` | Devis (structure présente, flux applicatif limité) |
| `File` | `files` | Fichier générique + métadonnées (dimensions, volume STL) |

### Cycle de vie utilisateur — `UserStatus`

```
inscription
    │
    ▼
 PENDING ──┬── admin valide ──► ACTIVE ──┬── admin suspend ──► SUSPENDED
           │                             │                          │
           │                             └── DELETE /users/:id ──►  purge définitive
           │
           └── admin rejette ──► suppression réelle en base
```

- L'inscription crée toujours un compte `PENDING` ([`src/auth/auth.service.ts:114`](../src/auth/auth.service.ts)).
- Le passage à `ACTIVE` **initialise les comptes poids**, mais uniquement s'il n'en existe aucun ([`src/users/users.service.ts:92`](../src/users/users.service.ts)) — sinon la réactivation d'un compte suspendu les dupliquerait.
- `REJECTED` sur un `PENDING` **supprime réellement la ligne** (aucune donnée liée à ce stade).
- `SUSPENDED` est la voie de désactivation par défaut : réversible, login refusé avec un message dédié.
- `DELETE /users/:id` purge tout en cascade dans une transaction. Irréversible.

### Cycle de vie commande — `OrderStatus`

```
EN_ATTENTE ──► TIRAGE_OK ──► FONDU ──► EXPEDIE
 (reçue)      (cires prêtes)  (fondue)   (envoyée)
```

Le passage à `EXPEDIE` se fait normalement via **`POST /orders/:id/close`**, qui exécute dans une seule transaction :

1. création de la `Invoice` (numéro + PDF fournis par l'admin) ;
2. statut `EXPEDIE` et mise à jour du prix final ;
3. **optionnellement** débit du compte poids : `Transaction` `DEBIT` + mise à jour du solde.

> ⚠️ Si le compte poids du métal visé n'existe pas, le débit est **silencieusement ignoré** — la facture et le changement de statut passent quand même.

### Facturation — deux voies

| | Facture individuelle | Facture groupée |
|---|---|---|
| Modèle | `Invoice` | `InvoiceGroup` |
| Créée par | `POST /orders/:id/close` ou `POST /invoices` | `POST /invoice-groups` |
| Portée | 0 ou 1 commande | N commandes du **même client** |
| Visible par le client | ✅ `GET /invoices/me` | ❌ **non** |

**Garde-fous du groupement** ([`src/invoice-groups/invoice-groups.service.ts`](../src/invoice-groups/invoice-groups.service.ts)) : commandes existantes et appartenant au `userId` fourni, aucune déjà groupée, le tout dans une transaction Prisma.

> 🔴 **Trou fonctionnel connu** : les 5 routes `/invoice-groups` sont `@Roles("ADMIN")`. Un client dont les commandes ont été facturées en groupe **ne voit aucune facture**. Voir [l'audit](05-audit-retours-clients.md).

### Bibliothèque : l'admin dépose, le client consulte

| Ressource | Client | Admin |
|---|---|---|
| `Mold` (moules, photo) | lecture `/molds/me` | CRUD complet |
| `LibraryFile` (STL) | lecture `/library/me` | CRUD complet |

Le client **n'envoie pas de fichier au moment de la commande**. Il peut uploader un STL sur la page *Devis STL* pour le visualiser, mais la commande part par email.

### Règle produit structurante : pas de commande dans l'app

Les commandes se passent **par email à `contact@lagrenaille.fr`**. `POST /orders` existe toujours, mais le parcours normal est : email → l'admin crée la commande via `POST /orders/manual`.

### Reporté, non implémenté

- Commandes multi-produits (une commande = un article aujourd'hui).
- Dépôt de STL à la création de commande par le client.
