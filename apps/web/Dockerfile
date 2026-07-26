# Web Dockerfile — Next.js (pnpm workspace monorepo)
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

RUN echo "shamefully-hoist=true" > .npmrc && \
    echo "registry=https://registry.npmmirror.com" >> .npmrc && \
    pnpm install && \
    pnpm --filter @design-platform/shared build && \
    pnpm --filter @design-platform/web build

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]
