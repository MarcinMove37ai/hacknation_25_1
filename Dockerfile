# Dockerfile
# Etap 1: Budowanie aplikacji
FROM node:24-slim AS builder

WORKDIR /app

# Kopiowanie plików package
COPY package.json package-lock.json ./

# Instalacja zależności
RUN npm ci

# Kopiowanie kodu aplikacji
COPY . .

# Wyłączenie telemetrii Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Ustawienie DATABASE_URL dla etapu budowania (można nadpisać przez --build-arg)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

# Budowanie aplikacji
RUN npm run build

# Etap 2: Produkcja
FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Kopiowanie package files
COPY --from=builder /app/package*.json ./

# Instalacja tylko zależności produkcyjnych
RUN npm ci --omit=dev

# Kopiowanie zbudowanej aplikacji
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Utworzenie użytkownika nextjs dla bezpieczeństwa
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /app nextjs

# Nadanie uprawnień
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000

# Uruchomienie aplikacji
CMD ["node_modules/.bin/next", "start"]