# syntax=docker/dockerfile:1

# ---- Етап 1: зависимости ----
    FROM node:22-alpine AS deps
    WORKDIR /app
    COPY package.json ./
    RUN npm install --omit=dev --ignore-scripts
    
    # ---- Етап 2: билд ----
    FROM node:22-alpine AS build
    WORKDIR /app
    COPY package.json ./
    RUN npm install --ignore-scripts
    COPY . .
    ARG VITE_SUPABASE_URL
    ARG VITE_SUPABASE_PUBLISHABLE_KEY
    ARG VITE_SUPABASE_PROJECT_ID
    ARG VITE_STRIPE_PUBLISHABLE_KEY
    ARG VITE_SITE_URL
    ENV NITRO_PRESET=node-server
    RUN npm run build
    
    # ---- Етап 3: продукция ----
    FROM node:22-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    
    # Непривилегирован потребител
    RUN addgroup -g 1001 -S nodejs && adduser -S tursya -u 1001
    COPY --from=build --chown=tursya:nodejs /app/.output ./.output
    USER tursya
    
    EXPOSE 3000
    CMD ["node", ".output/server/index.mjs"]