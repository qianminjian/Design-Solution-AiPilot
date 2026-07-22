import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@design-platform/shared", "antd"],
  // BFF 代理：API 请求转发到 NestJS BFF
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BFF_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
