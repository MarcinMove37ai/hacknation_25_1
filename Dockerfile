# Etap 1: Budowanie aplikacji
FROM node:24-slim AS builder

WORKDIR /app

# Kopiowanie plików package
COPY package.json package-lock.json ./

# Instalacja zależności (w tym devDependencies potrzebnych do budowania i Prismy)
RUN npm ci

# Kopiowanie kodu aplikacji (w tym folderu prisma/ i pliku schema.prisma)
COPY . .

# Wyłączenie telemetrii Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Ustawienie DATABASE_URL (wymagane, aby prisma generate zadziałało, jeśli waliduje połączenie, choć zazwyczaj wystarczy sama obecność zmiennej)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

# --- KLUCZOWA ZMIANA ---
# Generowanie klienta Prisma PRZED buildem
RUN npx prisma generate
# -----------------------

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

# --- KLUCZOWA ZMIANA 2 ---
# Kopiowanie wygenerowanego klienta Prisma z etapu budowania
# Dzięki temu aplikacja produkcyjna ma dostęp do bazy danych
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Kopiujemy też folder prisma (opcjonalnie, przydatne do migracji)
COPY --from=builder /app/prisma ./prisma
# -------------------------

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