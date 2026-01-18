# Backend – API NestJS

API NestJS pour l’espace professionnel (auth, utilisateurs, devis/commandes, stockage, emails).

## Stack
- TypeScript, NestJS, Prisma (PostgreSQL)
- MinIO (S3-compatible) pour le stockage
- Resend ou SMTP (Mailhog) pour les emails
- Zod pour la validation DTO

## Démarrage local
```bash
pnpm install
docker compose up -d
pnpm prisma:migrate --name init_prd
pnpm prisma:seed
pnpm start:dev
```
API: http://localhost:3000/api

Services Docker:
- PostgreSQL: localhost:5433
- MinIO: API http://localhost:9002, Console http://localhost:9003
- Mailhog: SMTP localhost:1026, Web UI http://localhost:8026

## Configuration (.env)
- PORT, NODE_ENV
- DATABASE_URL
- MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
- RESEND_API_KEY (facultatif), MAIL_FROM
- SMTP_HOST, SMTP_PORT (fallback dev → Mailhog)
- ADMIN_EMAIL
- CORS_ORIGIN

## Authentification
- Inscription: `POST /api/auth/register`
  - Crée un utilisateur `PENDING`, envoie un email à l’admin
- Connexion: `POST /api/auth/login`
  - Accepte `PENDING`, refuse `REJECTED`, renvoie le `status` dans la réponse
- Déconnexion: `POST /api/auth/logout` (no-op pour dev)
- Validation admin:
  - `GET /api/users/pending`
  - `PATCH /api/users/:id/status` → `ACTIVE` (email de bienvenue) ou `REJECTED` (suppression compte)

## Santé
- `GET /api/health` → état global + base de données

## Commandes utiles
```bash
pnpm prisma:generate   # Générer client Prisma
pnpm prisma:migrate    # Migrations dev
pnpm prisma:studio     # Studio Prisma
pnpm prisma:seed       # Créer l’admin par défaut
pnpm start:dev         # Dév (watch)
pnpm build && pnpm start:prod
```

## Notes
- En dev, les emails passent par SMTP Mailhog si RESEND_API_KEY n’est pas défini.
- Les ports sont ajustés pour éviter les collisions locales.
