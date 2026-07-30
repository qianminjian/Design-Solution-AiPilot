# Web Dockerfile — Next.js (pnpm workspace monorepo)
FROM node:20-alpine

WORKDIR /app

# 使用 npm 镜像安装 pnpm，避免 corepack 从 npmjs.org 下载失败
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.15.0

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
