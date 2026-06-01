# Étape 1 : Installation des dépendances (deps)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Étape 2 : Dépendances de production (prod-deps)
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile
RUN pnpm prisma generate

# Étape 3 : Build de l'application (build)
FROM deps AS build
WORKDIR /app
COPY prisma ./prisma
COPY src ./src
COPY nest-cli.json tsconfig*.json ./
RUN pnpm prisma generate
RUN pnpm build
# Compilation du seed séparément si nécessaire
RUN npx tsc --outDir dist-seed --esModuleInterop --module commonjs --target es2020 --resolveJsonModule --skipLibCheck prisma/seed.ts

# Étape 4 : Image finale (runner)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# Récupération des node_modules de prod et du build compilé
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY --from=build /app/prisma ./prisma
COPY package.json pnpm-lock.yaml ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
