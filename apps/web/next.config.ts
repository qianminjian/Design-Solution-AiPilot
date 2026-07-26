import type { NextConfig } from "next";

/**
 * Next.js 15 配置
 * - transpilePackages：转译 antd / @ant-design/icons / 共享包，确保 SSR 与 ESM 兼容
 * - reactStrictMode：开发期额外检查副作用，符合 React 19 最佳实践
 * - experimental.esmExternals：允许 ESM 外部依赖
 * - rewrites：将 /api/* 代理到 BFF，前端同源调用避免 CORS
 */
const nextConfig: NextConfig = {
  // 部署在 /aidesign/ 子路径下（与 yun.gxjugu.com 其他项目共存）
  basePath: "/aidesign",
  reactStrictMode: true,
  transpilePackages: [
    "antd",
    "@ant-design/icons",
    "@ant-design/nextjs-registry",
    "@design-platform/shared",
  ],
  experimental: {
    esmExternals: true,
  },
  // BFF 代理：API 请求转发到 NestJS BFF
  async rewrites() {
    const bffUrl = process.env.BFF_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${bffUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
