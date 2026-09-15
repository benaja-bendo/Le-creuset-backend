# 05 — Audit des retours clients (côté back)

Vérification des demandes du client **contre le code réel**, pas contre les cases à cocher des documents d'origine.

Audit initial réalisé le **9 août 2026** sur `develop` (`9482b30`). Ce document ne couvre que **la part backend**. Les points d'interface (responsive, modales, viewers, dashboard) sont audités dans le repo `Le-creuset`, fichier `docs/05-audit-retours-clients.md`.

---

## Retours d'août 2026 — corrigés

### ✅ Numéros de commande faux sur les factures

**Ce que le client voyait** : sur une facture groupée comme dans le sélecteur « commande associée » du dépôt de facture, des numéros de commande qui ne correspondaient à aucune commande connue. Et la disparition des notes de commande.

**Cause racine, côté back** : [`src/invoices/invoices.service.ts`](../src/invoices/invoices.service.ts) utilisait un `select` **imbriqué** sur la relation `order`, limité à `{ id, status, estimatedPrice }`. Contrairement à un `include` — qui renvoie tous les scalaires — un `select` imbriqué est une **liste blanche** : `orderNumber` et `notes` étaient amputés à la source. Le front n'avait donc pas le choix et se rabattait sur la queue du `cuid` (`orderId.slice(-6)`), un fragment d'identifiant technique qui ressemble à un numéro sans en être un.

**Correction** : les quatre chemins de lecture (`findAll`, `findByUserId`, `create`, et l'accès par id) partagent désormais une constante unique `ORDER_SUMMARY_SELECT` qui inclut `orderNumber`, `notes` et `estimatedPrice`. Une seule forme, un seul endroit à modifier.

`findByOrderId` est volontairement resté sans `include` : la route `GET /invoices/order/:orderId` n'a aucun consommateur front **et** ne vérifie pas la propriété de la commande — inutile d'y élargir la charge utile tant que ce contrôle manque.

Deux autres fuites du même identifiant tronqué, hors `select`, ont été corrigées dans la foulée :

| Fichier | Avant | Après |
|---|---|---|
| [`src/orders/orders.service.ts`](../src/orders/orders.service.ts) `closeOrder` | libellé de transaction poids `Commande #<cuid6> - <facture>`, **persisté en base** | `Commande <orderNumber> - <facture>` |
| [`src/orders/orders.controller.ts`](../src/orders/orders.controller.ts) `closeOrder` | email client « votre commande #<cuid6> est terminée » | `orderNumber` |
| [`src/mail/mail.service.ts`](../src/mail/mail.service.ts) | gabarit préfixant un `#` en dur → « commande #CMD-123456 » | l'appelant fournit la référence complète |

La référence est produite par un helper unique, [`src/common/order-ref.ts`](../src/common/order-ref.ts) → `orderReference()`, aligné sur son homologue front `orderRef()` de `src/lib/orders.ts`. Les deux formats apparaissent côte à côte pour un même client (email et interface) : ils doivent rester identiques.

> ⚠️ **Les données déjà écrites ne sont pas reprises.** Les libellés de transaction poids créés avant cette correction gardent l'ancien format : l'historique d'un compte poids peut donc mélanger `Commande #A1B2C3 - FAC-001` et `Commande CMD-123456 - FAC-002`. Un script de reprise est possible mais n'a pas été écrit — à arbitrer.

> ⚠️ **`orderNumber` est nullable.** Les commandes antérieures à la migration `20260606110139_add_order_number` n'en ont pas. Aucun backfill n'a été fait : le front affiche pour elles une mention explicite `Sans n° (ABC123)` plutôt qu'un faux numéro. Si un affichage homogène est souhaité, il faut décider d'un format de reprise (`CMD-LEG-…`, séquence par date de création) — l'index unique impose un choix déterministe.

**Couverture ajoutée.** Les assertions existantes utilisaient `expect.any(Object)` sur `include.order` : elles seraient restées vertes si le `select` reperdait `orderNumber`. Elles vérifient désormais la **forme** du select. Trois tests ont été renforcés ou ajoutés :

| Test | Ce qu'il garantit |
|---|---|
| `invoices.service.spec.ts` — `findAll`, `findByUserId` | le `select` imbriqué contient bien `orderNumber` et `notes` |
| `orders.service.spec.ts` — `closeOrder` | le libellé persisté vaut `Commande CMD-000001 - INV-002` |
| `orders.service.spec.ts` — nouveau cas `orderNumber: null` | repli explicite `Commande Sans n° (RDER-1) - INV-003` |
| `orders.controller.spec.ts` — clôture | l'email reçoit le numéro de commande, pas l'id |

`fakeOrder()` de `src/common/test-utils.ts` déclare maintenant `orderNumber`, absent depuis la migration.

**Vérification** : `npx tsc --noEmit` propre, `npx jest` 19 suites / **127 tests** verts. Contrôle par mutation : retirer `orderNumber` de `ORDER_SUMMARY_SELECT` fait bien échouer 2 tests — la régression d'origine est désormais gardée.

---

## Retours de septembre 2026

Retour du 15/09 après mise à jour de la dev pour test client. Verbatim et
décorticage complet dans `sites/retours-clients/2026-09-15-retour-dev.md`
(non versionné). Un seul point back, trouvé en traitant le retour plutôt
qu'annoncé par le client lui-même.

### ✅ `GET /users/:id` accessible à tout compte connecté, `passwordHash` inclus — fait

Repéré dès l'audit d'août (voir "Points d'attention hors retours clients"
ci-dessous), remonté en urgence en traitant le retour du 15/09 : en
corrigeant l'affichage du KBIS côté admin front, le même endpoint qu'il
fallait toucher exposait la fiche complète de n'importe quel utilisateur —
adresse, documents, `passwordHash` — à **n'importe quel client authentifié**,
pas seulement un admin.

**Correction** ([`src/users/users.controller.ts`](../src/users/users.controller.ts),
[`src/users/users.service.ts`](../src/users/users.service.ts)) :
- route sous `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("ADMIN")`, alignée
  sur les routes sœurs du contrôleur ;
- nouveau `findByIdForAdmin()` avec le même `select` que `getProfile()` (sans
  `passwordHash`), pour ne plus jamais renvoyer le modèle Prisma brut — `findById()`
  reste inchangé pour ses seuls appelants internes (notifications de statut).

PR [`Le-creuset-backend#12`](https://github.com/benaja-bendo/Le-creuset-backend/pull/12),
déployée en prod le 15/09.

---

## Retours de juin 2026

### ✅ Suppression totale et définitive d'un utilisateur — fait

`DELETE /api/users/:id`, réservé `ADMIN` ([`src/users/users.controller.ts:163`](../src/users/users.controller.ts)). `usersService.deleteUser()` ([`src/users/users.service.ts:235`](../src/users/users.service.ts)) purge dans une transaction, dans l'ordre : transactions → comptes métal → fichiers → devis → moules → factures → commandes → groupes de facturation → fichiers de bibliothèque → utilisateur.

> ⚠️ **Cette demande contredit la décision produit antérieure** (« suppression = désactivation douce `SUSPENDED` »). Les deux mécanismes coexistent. À clarifier avec le client : la suppression définitive est-elle réservée à des cas exceptionnels (RGPD) ou devient-elle la voie normale ? En l'état, l'interface admin peut détruire irréversiblement l'historique de facturation d'un client.

### ✅ Vision de la bibliothèque de moules — tranché et implémenté

La question était : les clients déposent-ils les fichiers à la commande, ou les admins les ajoutent-ils après ? **Réponse retenue dans le code : les admins déposent, les clients consultent.**

- `/molds` et `/library` : `POST`, `PATCH`, `DELETE` tous marqués `@Roles("ADMIN")` ([`src/molds/molds.controller.ts`](../src/molds/molds.controller.ts), [`src/library/library.controller.ts`](../src/library/library.controller.ts)) ;
- côté client, seules les lectures `/molds/me` et `/library/me` sont exposées.

### 🟠 Groupement de commandes (signalé « critique ») — partiel

**Ce qui a été durci** ([`src/invoice-groups/invoice-groups.service.ts`](../src/invoice-groups/invoice-groups.service.ts)) :
- toute l'opération est dans une transaction Prisma ;
- vérification que les commandes existent **et** appartiennent bien au `userId` (`:24-28`) ;
- refus si une commande appartient déjà à un groupe (`:30-35`) ;
- 2 suites de tests couvrent le module.

**Ce qui reste ouvert côté back :**

1. 🔴 **Aucune route client.** Les 5 routes `/invoice-groups` sont `@Roles("ADMIN")` ([`src/invoice-groups/invoice-groups.controller.ts:23-51`](../src/invoice-groups/invoice-groups.controller.ts)). Le front client ne lit que `/invoices/me`, qui interroge la table `invoices`. **Une commande facturée en groupe disparaît de l'espace client.**
2. 🟠 **Composition non modifiable.** `PATCH /invoice-groups/:id` ne prend pas d'`orderIds` : impossible d'ajouter ou retirer une commande. Il faut supprimer le groupe et le recréer.
3. 🟠 **Déliaison implicite.** `remove()` supprime le groupe sans détacher explicitement les commandes ; ça fonctionne grâce au `SetNull` par défaut de Prisma sur relation optionnelle, mais ce n'est écrit nulle part.
4. 🟠 **Numéro `FAC-GRP-{timestamp}`** — non séquentiel, collision possible avec la contrainte `@unique`.

### 🔴 Convention de numérotation des factures — toujours ouverte

C'est une **question posée par le client, jamais tranchée**. Trois conventions coexistent :

| Contexte | Numéro |
|---|---|
| `POST /invoices` (dépôt de facture) | saisi entièrement à la main |
| `POST /invoice-groups` | pré-généré `FAC-GRP-{timestamp}`, éditable |
| `POST /orders/:id/close` | saisi à la main dans le formulaire de clôture |

**Décision à prendre** : séquence annuelle côté serveur (`FA-2026-0001`), reprise de la numérotation comptable existante, ou maintien du manuel ? Tant que ce n'est pas arbitré, le risque de doublon reste.

### 🔴 Recette de bout en bout — non faite

- 126 tests unitaires, tous au vert, mais **avec Prisma mocké** — aucun ne traverse la base ;
- le script `test:e2e` de `package.json` pointe vers un dossier `test/` **qui n'existe pas**.

Un parcours de recette manuelle en 8 étapes est proposé dans [`03-dev-local.md`](03-dev-local.md#parcours-de-recette-manuelle).

### ❓ Erreur signalée sur `/client/invoices` — indéterminé

Aucun commit de correction identifiable. Le chemin de code back est sain : `GET /invoices/me` → `invoicesService.findByUserId()` → `findMany` avec `include: { order: {…} }`.

**Hypothèse la plus probable** : ce n'est pas une erreur runtime mais une **page vide** — le client dont les commandes ont été facturées en groupe ne voit rien (point 1 ci-dessus). À confirmer avec le message d'erreur exact.

---

## Points d'attention hors retours clients

Relevés en documentant le code, détaillés dans [`02-api.md`](02-api.md#points-dattention-repérés-à-la-lecture).

| Priorité | Problème |
|---|---|
| ~~🔴~~ | ~~`GET /users/:id` renvoie `passwordHash`…~~ — corrigé le 15/09, voir "Retours de septembre 2026" |
| 🟠 | `GET /orders/:id`, `GET /invoices/:id`, `GET /invoices/order/:orderId` ne vérifient pas la propriété |
| 🟠 | `orderNumber` et numéros de facture générés par `Date.now().slice(-6)` — collision possible |
| 🟡 | Débit poids silencieusement ignoré dans `closeOrder` si le compte du métal visé n'existe pas |
| 🟡 | `GET /orders` et `GET /orders/all` sont des doublons |

---

## Reste à faire, par priorité (back)

| Priorité | Action | Où |
|---|---|---|
| ~~🔴 1~~ | ~~Restreindre `GET /users/:id` et ajouter un `select` explicite~~ — fait le 15/09 | `src/users/` |
| 🔴 2 | Exposer les factures groupées au client (route `/invoice-groups/me`) | `src/invoice-groups/` |
| 🔴 3 | Trancher puis centraliser la numérotation des factures et des commandes | `src/invoices/`, `src/orders/` |
| 🟠 4 | Vérifier la propriété sur les lectures par ID | `src/orders/`, `src/invoices/` |
| 🟠 5 | Permettre la modification de la composition d'un groupe | `src/invoice-groups/` |
| 🟡 6 | Remonter une erreur explicite quand le débit poids ne peut pas s'appliquer | `src/orders/orders.service.ts` |
| 🟡 7 | Clarifier avec le client : suppression définitive vs suspension | produit |
