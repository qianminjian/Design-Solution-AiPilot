# BFF Dockerfile — NestJS (pnpm workspace monorepo)
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/bff/ apps/bff/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install && \
    pnpm --filter @design-platform/shared build && \
    pnpm --filter @design-platform/bff build

EXPOSE 3001
WORKDIR /app/apps/bff
CMD ["node", "dist/main.js"]
