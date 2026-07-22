# BFF Dockerfile — NestJS
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/bff/package.json apps/bff/tsconfig.json apps/bff/nest-cli.json apps/bff/

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared/src/ packages/shared/src/
COPY apps/bff/src/ apps/bff/src/
RUN pnpm --filter @design-platform/bff build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/bff/dist ./dist
COPY --from=builder /app/apps/bff/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ../packages/shared/node_modules

USER node

EXPOSE 3001
CMD ["node", "dist/main.js"]
