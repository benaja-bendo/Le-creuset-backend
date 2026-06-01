# Lagrenaille - Backend API

API REST développée avec NestJS, Prisma et PostgreSQL pour Lagrenaille.

## 🚀 Démarrage Rapide

### Prérequis
- Docker & Docker Compose
- Node.js (optionnel si utilisation de Docker)

### Lancement Local

#### Lancer l'environnement complet (API + DB + MinIO)
```bash
# Lancer l'environnement complet (API + DB + MinIO)
docker compose -f docker-compose.local.yml up
```
- **API** : [http://localhost:3000](http://localhost:3000)
- **MinIO Console** : [http://localhost:9003](http://localhost:9003)

#### Lancer le serveur de développement (sans DB/MinIO)

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

## 🌍 Déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour les détails complets.

- **Dev** : `https://api.dev.lagrenaille.fr` (Branche `develop`)
- **Prod** : `https://api.lagrenaille.fr` (Branche `main`)

## 🛠 Tech Stack
- **Framework** : NestJS
- **ORM** : Prisma
- **Database** : PostgreSQL
- **Storage** : MinIO (S3 Compatible)
- **CI/CD** : GitHub Actions
