import { test, expect, type Page, type Route } from "@playwright/test";
import { AuthApiPaths } from "@design-platform/shared";
import {
  TEST_ACCOUNT,
  MOCK_ACCESS_TOKEN,
  ACCESS_TOKEN_COOKIE,
  buildSuccessResponse,
  createMockLoginResponse,
  createMockAuthContext,
} from "../__support__/fixtures";

/**
 * 登录核心 E2E 流程
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - 用 page.route 拦截 /api/v1/auth/login 与 /api/v1/auth/me
 * - 禁止真实调用 BFF
 *
 * 覆盖场景：
 * 1. 登录成功 → 跳转受保护页面（dashboard）
 * 2. 登录请求体携带用户输入的邮箱与密码
 *
 * 注意：login-form.tsx 实际跳转目标为 /dashboard（非 /projects），
 * 测试按代码实际行为断言，并在简报中说明与任务描述的差异。
 */

/** 拦截登录接口，返回成功响应 + Set-Cookie */
async function mockLoginSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      // BFF 模式下 access token 由 httpOnly Cookie 携带
      "Set-Cookie": `${ACCESS_TOKEN_COOKIE}=${MOCK_ACCESS_TOKEN}; Path=/; HttpOnly; SameSite=Strict`,
    },
    body: JSON.stringify(buildSuccessResponse(createMockLoginResponse())),
  });
}

/** 拦截当前用户接口，返回已登录态（AuthGuard 依赖此接口放行） */
async function mockAuthMeSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(createMockAuthContext())),
  });
}

/** 注册所有 mock 路由 */
async function setupAuthMocks(page: Page): Promise<void> {
  await page.route(`**${AuthApiPaths.login}`, mockLoginSuccess);
  await page.route(`**${AuthApiPaths.me}`, mockAuthMeSuccess);
}

test.describe("登录核心流程", () => {
  test("应该在登录成功后跳转到受保护的 dashboard 页面", async ({ page }) => {
    // Arrange（准备）：注册 mock 路由
    await setupAuthMocks(page);

    // Act（执行）：访问登录页并提交表单
    await page.goto("/login");
    // 等待登录卡片渲染完成
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Ant Design Form.Item 的 name prop 不会渲染为 <input name="..."> 属性，
    // 改用 placeholder 定位输入框（更稳健、符合 Playwright 推荐方式）
    await page.getByPlaceholder("name@example.com").fill(TEST_ACCOUNT.email);
    await page.getByPlaceholder("至少 8 个字符").fill(TEST_ACCOUNT.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Assert（断言）：跳转到 dashboard 页面
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard$/);
    // dashboard 欢迎卡片标题可见，证明受保护页面已渲染
    await expect(
      page.getByRole("heading", { name: "欢迎使用施工图全流程 AI 平台" }),
    ).toBeVisible();
  });

  test("应该在登录请求中携带用户输入的邮箱与密码", async ({ page }) => {
    // Arrange（准备）：捕获登录请求体
    let loginPayload: unknown = null;
    await page.route(`**${AuthApiPaths.login}`, async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      loginPayload = body;
      await mockLoginSuccess(route);
    });
    await page.route(`**${AuthApiPaths.me}`, mockAuthMeSuccess);

    // Act（执行）：填写表单并提交
    await page.goto("/login");
    // Ant Design Form.Item 的 name prop 不会渲染为 <input name="..."> 属性，
    // 改用 placeholder 定位输入框（更稳健、符合 Playwright 推荐方式）
    await page.getByPlaceholder("name@example.com").fill(TEST_ACCOUNT.email);
    await page.getByPlaceholder("至少 8 个字符").fill(TEST_ACCOUNT.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    // 等待跳转完成，确保请求已发出
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Assert（断言）：请求体邮箱已归一化（小写），密码原样保留
    expect(loginPayload).toEqual({
      email: TEST_ACCOUNT.email.toLowerCase(),
      password: TEST_ACCOUNT.password,
      rememberMe: false,
    });
  });

  test("应该在登录响应中设置 access_token Cookie", async ({ page }) => {
    // Arrange（准备）
    await setupAuthMocks(page);

    // Act（执行）
    await page.goto("/login");
    // Ant Design Form.Item 的 name prop 不会渲染为 <input name="..."> 属性，
    // 改用 placeholder 定位输入框（更稳健、符合 Playwright 推荐方式）
    await page.getByPlaceholder("name@example.com").fill(TEST_ACCOUNT.email);
    await page.getByPlaceholder("至少 8 个字符").fill(TEST_ACCOUNT.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Assert（断言）：浏览器上下文已存储 access_token cookie
    // 注：httpOnly cookie 仍可通过 context.cookies() 读取（仅页面 JS 不可读）
    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === ACCESS_TOKEN_COOKIE);
    expect(accessToken).toBeDefined();
    expect(accessToken?.value).toBe(MOCK_ACCESS_TOKEN);
  });
});
