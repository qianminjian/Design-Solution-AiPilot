import { registerAs } from "@nestjs/config";

/**
 * 默认 CORS 源列表
 */
const DEFAULT_CORS_ORIGIN = ["http://localhost:3000"];

/**
 * 默认端口
 */
const DEFAULT_PORT = 3001;

/**
 * 解析 PORT 环境变量
 * - 合法数字：返回解析后的 number
 * - 非法值或未设置：返回默认 3001（防御性兜底）
 */
function parsePort(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_PORT;
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : DEFAULT_PORT;
}

/**
 * 解析 CORS_ORIGIN 环境变量
 * - 未设置：返回默认源列表
 * - 空字符串或仅含空白：返回默认源列表（避免 [""] 进入 CORS 白名单）
 * - 多个值按逗号分隔
 */
function parseCorsOrigin(raw: string | undefined): string[] {
  if (!raw) {
    return DEFAULT_CORS_ORIGIN;
  }
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return list.length > 0 ? list : DEFAULT_CORS_ORIGIN;
}

/**
 * 应用配置 - 从环境变量读取
 *
 * 防御性兜底：
 *  - PORT 非法时回退到 3001，避免 NaN 进入 listen 调用
 *  - CORS_ORIGIN 空白时回退到默认值，避免 [""] 进入白名单
 */
export default registerAs("app", () => ({
  name: "bff",
  version: process.env.npm_package_version || "0.1.0",
  environment: process.env.NODE_ENV || "development",
  port: parsePort(process.env.PORT),

  coreServiceUrl: process.env.CORE_SERVICE_URL || "http://localhost:8080",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",

  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),

  jwt: {
    secret: process.env.JWT_SECRET || "",
    accessTokenExpire: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m",
    refreshTokenExpire: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "7d",
  },
}));
