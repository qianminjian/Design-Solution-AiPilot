import { test, expect, type Page, type Route } from "@playwright/test";
import { PortfolioApiPaths, AuthApiPaths } from "@design-platform/shared";
import type { ProjectDto } from "@design-platform/shared";
import {
  ACCESS_TOKEN_COOKIE,
  MOCK_ACCESS_TOKEN,
  buildSuccessResponse,
  createMockAuthContext,
  createMockProjectsPage,
  createTypicalMockProjects,
} from "../__support__/fixtures";

/**
 * 项目列表页 E2E 测试
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - Mock 已登录态：预设 access_token cookie + 拦截 /api/v1/auth/me
 * - Mock 项目列表：拦截 /api/v1/projects 返回固定 fixture
 * - 禁止真实调用 BFF
 *
 * 覆盖场景：
 * 1. 加载后显示 Table、搜索框、状态筛选器
 * 2. 表格渲染 mock 返回的项目数据
 * 3. 搜索框输入后触发带 keyword 的查询
 */

/** 列表页 mock 数据：3 条典型项目 */
const MOCK_PROJECTS: ProjectDto[] = createTypicalMockProjects();

/** 判断 URL 是否为项目列表接口 */
function isProjectsListUrl(url: URL): boolean {
  return url.pathname === PortfolioApiPaths.projects;
}

/** 拦截当前用户接口，返回已登录态 */
async function mockAuthMeSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(createMockAuthContext())),
  });
}

/** 拦截项目列表接口，返回固定 fixture */
async function mockProjectsListSuccess(route: Route): Promise<void> {
  const page = createMockProjectsPage(MOCK_PROJECTS);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(page)),
  });
}

/** 预设已登录态：注入 access_token cookie + 注册 /me mock */
async function setupLoggedInState(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: MOCK_ACCESS_TOKEN,
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.route(`**${AuthApiPaths.me}`, mockAuthMeSuccess);
}

test.describe("项目列表页", () => {
  test("应该在加载后显示 Table、搜索框与状态筛选器", async ({ page }) => {
    // Arrange（准备）
    await setupLoggedInState(page);
    await page.route(isProjectsListUrl, mockProjectsListSuccess);

    // Act（执行）：直接访问项目列表页
    await page.goto("/projects");

    // Assert（断言）：核心工具栏元素可见
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    // 搜索框：aria-label 仅作用于 textbox 本身，单元素命中安全
    await expect(page.locator('[aria-label="项目搜索"]')).toBeVisible();
    // 状态筛选：Ant Design Select 同时给外层 div 与内层 input 设置 aria-label，
    // 改用 role=combobox 精确定位到内层 input（单元素命中，避免 strict mode 违规）
    await expect(
      page.getByRole("combobox", { name: "状态筛选" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "新建项目" })).toBeVisible();
    // Table 容器存在（Ant Design Table 渲染为 table 元素）
    await expect(page.locator("table")).toBeVisible();
  });

  test("应该在表格中渲染 mock 返回的项目数据", async ({ page }) => {
    // Arrange（准备）
    await setupLoggedInState(page);
    await page.route(isProjectsListUrl, mockProjectsListSuccess);

    // Act（执行）
    await page.goto("/projects");

    // Assert（断言）：表格包含 mock 数据中的项目名称与编码
    // fixture 数据确定性，使用非空断言（noUncheckedIndexedAccess 兼容）
    const firstProject = MOCK_PROJECTS[0]!;
    const secondProject = MOCK_PROJECTS[1]!;
    await expect(
      page.getByRole("row", { name: new RegExp(firstProject.name) }),
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(secondProject.name) }),
    ).toBeVisible();
    // 项目编码以 Text code 形式渲染
    await expect(page.getByText(firstProject.code)).toBeVisible();
  });

  test("应该在搜索框输入关键字后触发带 keyword 的查询", async ({ page }) => {
    // Arrange（准备）：捕获查询参数
    const capturedKeywords: string[] = [];
    await setupLoggedInState(page);
    await page.route(isProjectsListUrl, async (route) => {
      const url = new URL(route.request().url());
      const keyword = url.searchParams.get("keyword");
      if (keyword) {
        capturedKeywords.push(keyword);
      }
      await mockProjectsListSuccess(route);
    });

    // Act（执行）：访问页面后输入关键字
    await page.goto("/projects");
    const searchInput = page.locator('[aria-label="项目搜索"]');
    await searchInput.fill("Sunrise");
    // debounce 300ms，等待查询触发
    await page.waitForTimeout(500);

    // Assert（断言）：keyword 参数被传递给 BFF
    expect(capturedKeywords).toContain("Sunrise");
  });
});
