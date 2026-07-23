import { defineConfig } from "vitest/config";

/**
 * Vitest 配置
 * - 环境：node（BFF 是后端服务，无 DOM）
 * - 单测超时 5s，集成超时 10s（与 testing.md §8 一致）
 * - 覆盖率：v8 provider，行 ≥80%、分支 ≥70%
 * - 全局 setup：每个测试后重置 mocks，避免状态泄漏
 *
 * 权威源：.trae/rules/testing.md §8.1
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/e2e/**"],
    setupFiles: ["./tests/__support__/setup.ts"],
    testTimeout: 5_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "../../coverage/apps/bff",
      include: ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/config/**",
        "src/**/*.module.ts",
        "src/**/*.dto.ts",
        // ProxyInterceptor 依赖 RxJS 管道 + ExecutionContext，属集成层逻辑，
        // 单测成本高且不在本次任务范围；后续按集成测试补齐。
        "src/interceptors/proxy.interceptor.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
});
