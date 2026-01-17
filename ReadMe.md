# Le Creuset - Backend API

Backend NestJS pour la gestion des devis et fichiers 3D.

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Langage | TypeScript (Strict mode) |
| Framework | NestJS |
| Base de données | PostgreSQL |
| ORM | Prisma |
| Stockage | MinIO (S3-compatible) |
| Emails | Resend |
| Validation | Zod |

## Démarrage rapide

### 1. Démarrer les services Docker

```bash
docker-compose up -d
```

Services disponibles:
- **PostgreSQL**: `localhost:5432`
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin123)
- **Mailhog**: http://localhost:8025

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

### 4. Initialiser la base de données

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. Lancer l'application

```bash
npm run start:dev
```

L'API est accessible sur http://localhost:3000/api

## Structure du projet

```
src/
├── main.ts              # Point d'entrée
├── app.module.ts        # Module racine
├── health.controller.ts # Endpoint /health
├── prisma/              # Service Prisma (global)
├── storage/             # Service MinIO (global)
└── mail/                # Service Resend (global)
```

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Health check |

## Scripts disponibles

```bash
npm run start:dev     # Développement (watch mode)
npm run build         # Build production
npm run start:prod    # Lancer en production
npm run lint          # Linter
npm run test          # Tests unitaires
npm run prisma:studio # Interface Prisma
```
