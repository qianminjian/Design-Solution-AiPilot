import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * 权威源：.trae/rules/testing.md
 * - E2E 命名 *.spec.ts，目录 apps/web/tests/e2e/
 * - CI 独立 stage 运行，失败阻断部署
 * - 禁止真实调用 BFF/API（用 page.route 拦截 mock）
 *
 * 基线：
 * - baseURL: http://localhost:3001（Next.js dev server 端口，避开默认 3000 冲突）
 * - chromium 为主浏览器（V1 技术试点最小集）
 * - trace 在首次重试时抓取，便于失败排查
 * - webServer 自动启动 Next.js dev，复用已有进程避免重复启动
 */
export default defineConfig({
  // E2E 测试目录，禁止在 src/ 内放测试（testing.md §3）
  testDir: "./tests/e2e",
  // 测试文件匹配模式
  testMatch: "**/*.spec.ts",
  // 完全并行执行，缩短 CI 总时长
  fullyParallel: true,
  // CI 中禁止 test.only，避免误合并
  forbidOnly: !!process.env.CI,
  // CI 重试 2 次，本地不重试
  retries: process.env.CI ? 2 : 0,
  // CI 单 worker 串行，本地按 CPU 核数并行
  workers: process.env.CI ? 1 : undefined,
  // 报告器：CI 用 line + html，本地用 list
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  // 全局配置
  use: {
    // 基础地址，所有 page.goto 使用相对路径
    baseURL: "http://localhost:3001",
    // 单测试超时 30s（Next.js dev 首屏编译较慢）
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // 抓取失败时的 trace，便于本地与 CI 排查
    trace: "on-first-retry",
    // 失败时截图
    screenshot: "only-on-failure",
    // 失败时录制视频
    video: "retain-on-failure",
  },
  // 浏览器项目：V1 技术试点仅 chromium
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // 自动启动 Next.js dev server（端口 3001，避开默认 3000 冲突）
  // 若本地已有 pnpm dev 在 3001 端口运行，Playwright 会复用，避免重复启动
  webServer: {
    command: "pnpm exec next dev --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // E2E 环境变量：BFF 走 mock，不依赖真实后端
      NEXT_PUBLIC_BFF_URL: "",
    },
  },
});
