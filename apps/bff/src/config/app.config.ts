import { registerAs } from "@nestjs/config";

/**
 * 应用配置 - 从环境变量读取
 */
export default registerAs("app", () => ({
  name: "bff",
  version: process.env.npm_package_version || "0.1.0",
  environment: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),

  coreServiceUrl: process.env.CORE_SERVICE_URL || "http://localhost:8080",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",

  corsOrigin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],

  jwt: {
    secret: process.env.JWT_SECRET || "",
    accessTokenExpire: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m",
    refreshTokenExpire: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "7d",
  },
}));
