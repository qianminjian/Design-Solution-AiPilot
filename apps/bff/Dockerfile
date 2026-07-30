# BFF Dockerfile — NestJS (pnpm workspace monorepo)
FROM node:20-alpine

WORKDIR /app

# 使用 npm 镜像安装 pnpm，避免 corepack 从 npmjs.org 下载失败
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.15.0

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/bff/ apps/bff/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install && \
    pnpm --filter @design-platform/shared build && \
    pnpm --filter @design-platform/bff build

EXPOSE 3001
WORKDIR /app/apps/bff
CMD ["node", "dist/main.js"]
