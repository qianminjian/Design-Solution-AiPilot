import { defineConfig } from "vitest/config";

/**
 * Vitest 配置 — @design-platform/shared
 *
 * 覆盖率基线（testing.md §1）：
 *  - 总覆盖率 ≥ 80%
 *  - 新增代码 diff 覆盖率 = 100%
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: { lines: 80, branches: 70 },
    },
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
