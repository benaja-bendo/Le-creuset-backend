# Déploiement Backend - Lagrenaille API

Ce projet utilise une stratégie de déploiement séparée pour les environnements de **Développement** et de **Production**.

## Domaines API

- **Production** : `https://api.lagrenaille.fr`
- **Développement** : `https://api.dev.lagrenaille.fr`

## Environnements

### 🟢 Production
- **Branche** : `main`
- **URL** : `https://api.lagrenaille.fr`
- **Dossier VPS** : `/opt/apps/backend-prod`
- **Base de Données** : `lecreuset` (Schema: `prod`)
- **MinIO Bucket** : `lecreuset-prod`
- **Workflow** : `.github/workflows/deploy-prod.yml`

### 🟡 Développement (Staging)
- **Branche** : `develop`
- **URL** : `https://api.dev.lagrenaille.fr`
- **Dossier VPS** : `/opt/apps/backend-dev`
- **Base de Données** : `lecreuset` (Schema: `dev`)
- **MinIO Bucket** : `lecreuset-dev`
- **Workflow** : `.github/workflows/deploy-dev.yml`

## Développement Local

Pour travailler localement avec une base de données et MinIO dédiés :

1. Copier le fichier d'exemple `.env.example` vers `.env` (si nécessaire).
2. Lancer l'environnement complet :
   ```bash
   docker compose -f docker-compose.local.yml up
   ```
   - **API** : `http://localhost:3000`
   - **Postgres** : Port `5433` (User: `lecreuset`, Pass: `lecreuset_secret`)
   - **MinIO Console** : `http://localhost:9003` (User: `minioadmin`, Pass: `minioadmin123`)

## Secrets Requis (GitHub Actions)

Pour que le déploiement fonctionne, les secrets suivants doivent être configurés dans le dépôt GitHub :

### VPS Access
- `VPS_HOST` : IP du serveur
- `VPS_USER` : Utilisateur SSH (ex: `ubuntu`)
- `VPS_KEY` : Clé privée SSH
- `VPS_PASSPHRASE` : Passphrase de la clé (si applicable)

### Infrastructure (Base de données & MinIO)
Ces identifiants doivent correspondre à ceux configurés par Ansible sur le VPS.
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `MINIO_ROOT_USER` (Utilisé comme Access Key)
- `MINIO_ROOT_PASSWORD` (Utilisé comme Secret Key)

### Application
- `JWT_SECRET` : Clé secrète pour les tokens JWT
- `ADMIN_EMAIL` : Adresse email de l’administrateur qui reçoit les notifications
- `MAIL_FROM` : Adresse d’expédition (ex: `"Lagrenaille <contact@lagrenaille.fr>"`)
- `SMTP_HOST` : Hôte SMTP (ex: `mail.infomaniak.com`)
- `SMTP_PORT` : Port SMTP (ex: `587`)
- `SMTP_USER` : Identifiant SMTP
- `SMTP_PASSWORD` : Mot de passe SMTP
- `SMTP_SECURE` : `false` pour STARTTLS sur le port 587, `true` pour TLS implicite (465)
- `RESEND_API_KEY` : Clé API Resend (optionnelle, si tu utilises Resend)
- `MAIL_FROM` : Adresse d’envoi par défaut
- `FRONTEND_URL` : URL publique du frontend (ex: `https://lagrenaille.fr` ou `https://dev.lagrenaille.fr`)

## Architecture & Infrastructure

L'API Backend se connecte aux services d'infrastructure gérés par Ansible (`vps_infra`) :

- **Réseaux Docker** :
  - `proxy` : Pour être accessible via Traefik et accéder à MinIO.
  - `db_internal` : Pour accéder à la base de données Postgres de manière sécurisée (non exposée au web).

- **Base de Données (Postgres)** :
  - Instance unique partagée.
  - Isolation logique via les **schémas PostgreSQL** (`?schema=dev` vs `?schema=prod`).
  - Migrations automatiques exécutées au démarrage du conteneur via `docker-entrypoint.sh`.

- **Stockage (MinIO)** :
  - Instance unique partagée.
  - Isolation via des **buckets différents** (`lecreuset-dev` vs `lecreuset-prod`).
  - Création automatique du bucket au démarrage de l'application si inexistant.
