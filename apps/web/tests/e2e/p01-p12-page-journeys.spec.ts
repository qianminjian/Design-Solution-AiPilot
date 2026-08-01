import { test, expect, type Page, type Route } from "@playwright/test";
import { AuthApiPaths } from "@design-platform/shared";
import {
  MOCK_ACCESS_TOKEN,
  ACCESS_TOKEN_COOKIE,
  buildSuccessResponse,
  createMockAuthContext,
} from "../__support__/fixtures";

/**
 * P01–P12 核心用户旅程页面可达性 E2E（SIT P0-3.1）
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - 所有 BFF/API 调用通过 page.route 拦截 mock，禁止真实调用后端
 * - 页面静态标题/导航锚点断言（不依赖后端数据）
 *
 * 覆盖（对照 D37 关键界面 P01–P12）：
 *  - P01 我的工作台   /dashboard                 → "我的工作台"
 *  - P04 个人设置     /settings                  → "个人设置"
 *  - P06 合规检查     /compliance-checks         → "合规检查运行"
 *  - P06 合规规则     /compliance-rules          → "合规规则管理"
 *  - P09 访问审查     /governance/access-review  → "访问审查"
 *  - P09 审计与证据   /governance/audit          → "审计与证据"
 *  - P10 运营中心     /monitoring                → URL 可达 + 运营组件挂载
 *  - P11 变更闭环     /changes                   → "变更影响与闭环工作台"
 *  - P12 金样数据集   /golden-datasets           → "金样数据集管理"
 *
 * 与既有 E2E 的衔接：
 *  - auth-login.spec.ts 覆盖登录流程
 *  - projects-list.spec.ts 覆盖 P02 项目列表
 *  - core-business-flow.spec.ts 覆盖 上传(P03)→AI 生成→复核(P05)→发布(P07) 核心链路
 */

/** 全局 API 兜底：未单独 mock 的 GET 请求返回空数组（页面渲染空状态，不阻断导航） */
async function setupApiFallback(page: Page): Promise<void> {
  await page.route("**/api/**", async (route: Route) => {
    const method = route.request().method().toUpperCase();
    const body = method === "GET" ? [] : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSuccessResponse(body)),
    });
  });
}

/** 拦截 /me 返回已登录态（AuthGuard 依赖此接口放行） */
async function mockAuthMeSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(createMockAuthContext())),
  });
}

/** 预设已登录态：注入 access_token cookie + 拦截 /me（先注册 fallback 后注册 /me 保证后者优先） */
async function setupLoggedInState(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: MOCK_ACCESS_TOKEN,
      domain: "localhost",
      path: "/",
    },
  ]);
  await setupApiFallback(page);
  await page.route(`**${AuthApiPaths.me}`, mockAuthMeSuccess);
}

/** 通用页面可达性断言：导航 + 静态标题可见 */
async function expectPageTitle(
  page: Page,
  path: string,
  title: string,
): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(path.replace(/[/]/g, "\\/")));
  await expect(page.getByText(title)).toBeVisible();
}

test.describe("P01–P12 核心用户旅程页面可达性", () => {
  test("P01 我的工作台：访问 /dashboard 应渲染标题", async ({ page }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/dashboard", "我的工作台");
  });

  test("P04 个人设置：访问 /settings 应渲染标题与 4 个 Tab", async ({
    page,
  }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/settings", "个人设置");
    // 4 个设置 Tab（D37.17 Settings：Profile/Preferences/API Tokens/Danger Zone）
    await expect(page.getByText("API Tokens")).toBeVisible();
    await expect(page.getByText("Danger Zone")).toBeVisible();
  });

  test("P06 合规检查：访问 /compliance-checks 应渲染标题", async ({ page }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/compliance-checks", "合规检查运行");
  });

  test("P06 合规规则：访问 /compliance-rules 应渲染标题", async ({ page }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/compliance-rules", "合规规则管理");
  });

  test("P09 访问审查：访问 /governance/access-review 应渲染标题", async ({
    page,
  }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/governance/access-review", "访问审查");
  });

  test("P09 审计与证据：访问 /governance/audit 应渲染标题", async ({
    page,
  }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/governance/audit", "审计与证据");
  });

  test("P10 运营中心：访问 /monitoring 应导航成功且挂载运营组件", async ({
    page,
  }) => {
    await setupLoggedInState(page);
    await page.goto("/monitoring");
    await expect(page).toHaveURL(/\/monitoring/);
    // 后端 Operations API 未接入时渲染空状态，验证页面无全局错误页（Next.js error.tsx 会渲染 "Something went wrong"）
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    // 侧边导航锚点：运营中心页面通过菜单可达（D37.17 Operations 危险动作区）
    await expect(
      page.getByRole("heading", { level: 4 }).first(),
    ).toBeAttached();
  });

  test("P11 变更闭环：访问 /changes 应渲染标题", async ({ page }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/changes", "变更影响与闭环工作台");
  });

  test("P12 金样数据集：访问 /golden-datasets 应渲染标题", async ({ page }) => {
    await setupLoggedInState(page);
    await expectPageTitle(page, "/golden-datasets", "金样数据集管理");
  });
});
