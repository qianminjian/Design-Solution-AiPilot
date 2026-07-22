# Web Dockerfile — Next.js
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared/src/ packages/shared/src/
COPY apps/web/src/ apps/web/src/
COPY apps/web/public/ apps/web/public/
RUN pnpm --filter @design-platform/web build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json

USER node

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
