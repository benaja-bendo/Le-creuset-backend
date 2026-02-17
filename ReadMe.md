# Lagrenaille - Backend API

API REST développée avec NestJS, Prisma et PostgreSQL pour Lagrenaille.

## 🚀 Démarrage Rapide

### Prérequis
- Docker & Docker Compose
- Node.js (optionnel si utilisation de Docker)

### Lancement Local
```bash
# Lancer l'environnement complet (API + DB + MinIO)
docker compose -f docker-compose.local.yml up
```
- **API** : [http://localhost:3000](http://localhost:3000)
- **MinIO Console** : [http://localhost:9003](http://localhost:9003)

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
