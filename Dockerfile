FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init && \
    addgroup --system app && \
    adduser --system --ingroup app app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN chown -R app:app /app

USER app

EXPOSE 3000

CMD ["dumb-init", "node", "src/server.js"]
