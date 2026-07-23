import { afterEach, vi } from "vitest";

/**
 * Vitest 全局 setup
 * - 每个测试结束后重置所有 mock，避免 mock 状态在测试间泄漏
 * - 重置 mock 调用计数与实现
 *
 * 权威源：.trae/rules/testing.md §4.2（Mock 红线：禁止真实调用付费 API / 外部 HTTP）
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.clearAllMocks();
});
