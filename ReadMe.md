# Le Creuset - Backend API

API REST développée avec NestJS, Prisma et PostgreSQL.

## Développement Local

1.  Lancer la base de données locale (via Docker) :
    ```bash
    docker compose up -d postgres
    ```
2.  Installer les dépendances :
    ```bash
    pnpm install
    ```
3.  Lancer le serveur de développement :
    ```bash
    pnpm start:dev
    ```

## Architecture de Déploiement

Le déploiement est automatisé via **GitHub Actions**, assurant une mise à jour fluide de l'API.

### Pipeline CI/CD (`.github/workflows/deploy.yml`)

À chaque `push` sur la branche `main` :

1.  **Build** : Construction de l'image Docker optimisée (Node Alpine, dépendances de production uniquement).
2.  **Push** : Envoi de l'image sur GitHub Container Registry (GHCR).
3.  **Deploy** :
    *   Connexion SSH au VPS.
    *   Pull de la dernière image (`docker compose pull back`).
    *   Redémarrage du service (`docker compose up -d back`).
    *   *Note* : Les migrations de base de données sont exécutées automatiquement au démarrage du conteneur via `docker-entrypoint.sh`.

### Gestion de la Base de Données

*   **ORM** : Prisma.
*   **Migrations** : Les changements de schéma sont appliqués automatiquement en production.
    *   Pour créer une migration en dev : `npx prisma migrate dev`.
    *   En prod : `npx prisma migrate deploy` (automatisé).

### Variables d'environnement Production

Les variables sensibles (DB password, API keys) sont gérées via un fichier `.env` sur le serveur de production (injecté via les Secrets GitHub lors du setup initial ou mis à jour manuellement).
