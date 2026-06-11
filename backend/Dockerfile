FROM node:22-bookworm-slim

WORKDIR /app

ENV DATABASE_URL="postgresql://guesthouse_user:guesthouse_password@localhost:5432/guesthouse_management?schema=public"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json ./
COPY tsconfig*.json ./
COPY src ./src

RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && node dist/src/main"]
