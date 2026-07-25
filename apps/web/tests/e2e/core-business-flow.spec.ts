import { test, expect, type Page, type Route } from "@playwright/test";
import {
  AuthApiPaths,
  PortfolioApiPaths,
  WorkflowApiPaths,
  CdeApiPaths,
  SolutionsApiPaths,
  AiGenerationRecordApiPaths,
} from "@design-platform/shared";
import type {
  ProjectDto,
  StageInstanceDto,
  GateDecisionDto,
  DocumentDto,
  OffsetPageResponse,
  GenerateSolutionRequest,
  GenerateSolutionResponse,
} from "@design-platform/shared";
import {
  ACCESS_TOKEN_COOKIE,
  MOCK_ACCESS_TOKEN,
  buildSuccessResponse,
  createMockAuthContext,
  createMockProject,
  createMockStage,
  createMockGate,
  createMockDocumentsPage,
  createMockGenerateSolutionResponse,
  createMockAiGenerationRecord,
} from "../__support__/fixtures";

/**
 * 核心业务流程 E2E 测试：上传 → AI 生成 → 复核 → 发布
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - 所有 BFF/API 调用通过 page.route 拦截，返回固定 fixture
 * - 禁止真实调用 BFF/AI Service/LLM Provider
 *
 * 覆盖场景：
 * 1. 上传：访问项目文档库，验证草图文档列表渲染
 * 2. AI 生成：访问 AI 方案生成页，触发"生成方案"，验证候选卡片与 isAiAssisted 标记
 * 3. 复核：访问 AI 审签中心，验证待审查项统计与已批准/已拒绝卡片
 * 4. 发布：访问 Stage Gate 页面，验证门禁决策列表与门禁代码渲染
 *
 * 安全约束（security.md §12）：
 * - AI 输出强制 isAiAssisted=true
 * - 所有 AI 结果按风险等级进入人工复核
 * - AI 不替代注册建筑师/工程师的专业审签
 */

/** 测试项目 ID（贯穿四个流程步骤） */
const TEST_PROJECT_ID = "proj-e2e-flow-0001";

/** 测试项目 fixture（贯穿四个流程步骤） */
const TEST_PROJECT: ProjectDto = createMockProject({
  id: TEST_PROJECT_ID,
  code: "PRJ-FLOW",
  name: "核心流程测试项目",
  status: "active",
  buildingType: "office",
  floorsMin: 8,
  floorsMax: 12,
});

/** 测试阶段 fixture（贯穿四个流程步骤，STG-P0 前期策划） */
const TEST_STAGE: StageInstanceDto = createMockStage(TEST_PROJECT_ID, {
  id: "stage-e2e-flow-p0",
  stageCode: "STG-P0",
  stageName: "前期策划",
  stageOrder: 0,
  status: "active",
});

/** 测试门禁 fixture（G0 前期策划门） */
const TEST_GATE: GateDecisionDto = createMockGate(
  TEST_PROJECT_ID,
  TEST_STAGE.id,
  {
    id: "gate-e2e-flow-g0",
    gateCode: "G0",
    gateName: "前期策划门",
    status: "pending",
  },
);

/** AI 方案生成 mock 响应（强制人工复核） */
const TEST_GENERATE_RESPONSE: GenerateSolutionResponse =
  createMockGenerateSolutionResponse({
    riskLevel: "medium",
    requiresHumanReview: true,
  });

/** 已发布的草图文档（上传步骤 mock 数据） */
function createMockDocumentsResponse(): OffsetPageResponse<DocumentDto> {
  return createMockDocumentsPage(TEST_PROJECT_ID, 2);
}

/** 拦截 /me 接口返回已登录态 */
async function mockAuthMeSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(createMockAuthContext())),
  });
}

/** 预设已登录态：注入 access_token cookie + 拦截 /me */
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

/** 拦截项目详情 */
async function mockProjectDetail(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse(TEST_PROJECT)),
  });
}

/** 拦截阶段列表 */
async function mockStagesList(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse([TEST_STAGE])),
  });
}

/** 拦截门禁列表 */
async function mockGatesList(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildSuccessResponse([TEST_GATE])),
  });
}

/** 注册项目详情 + 阶段 + 门禁 mock（多个页面共用） */
async function setupProjectMocks(page: Page): Promise<void> {
  await page.route(
    `**${PortfolioApiPaths.project(TEST_PROJECT_ID)}`,
    mockProjectDetail,
  );
  await page.route(
    `**${WorkflowApiPaths.stages(TEST_PROJECT_ID)}*`,
    mockStagesList,
  );
  await page.route(
    `**${WorkflowApiPaths.stageGates(TEST_STAGE.id)}*`,
    mockGatesList,
  );
}

test.describe("核心业务流程：上传 → AI 生成 → 复核 → 发布", () => {
  test("1) 上传：访问文档库应渲染草图文档列表", async ({ page }) => {
    // Arrange（准备）：拦截文档列表 API 返回 2 条 mock 数据
    await setupLoggedInState(page);
    await setupProjectMocks(page);
    const documentsPage = createMockDocumentsResponse();
    await page.route(
      `**${CdeApiPaths.documents(TEST_PROJECT_ID)}*`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildSuccessResponse(documentsPage)),
        });
      },
    );

    // Act（执行）：访问项目文档库
    await page.goto(`/projects/${TEST_PROJECT_ID}/documents`);

    // Assert（断言）：页面标题与文档列表可见
    // 实际页面标题为 "Documents"（projects/[id]/documents/page.tsx）
    await expect(
      page.getByRole("heading", { name: "Documents" }),
    ).toBeVisible();
    // 列表中第一条文档名为 site-sketch-v1.dwg（来自 fixtures）
    await expect(page.getByText("site-sketch-v1.dwg")).toBeVisible();
    // 列表中第二条文档名为 site-sketch-v2.dwg
    await expect(page.getByText("site-sketch-v2.dwg")).toBeVisible();
    // 返回项目按钮可见（流程衔接点，实际按钮文本为"返回项目详情"）
    await expect(
      page.getByRole("button", { name: "返回项目详情" }),
    ).toBeVisible();
  });

  test("2) AI 生成：触发生成方案后应渲染候选卡片与 isAiAssisted 标记", async ({
    page,
  }) => {
    // Arrange（准备）：拦截方案生成 API
    await setupLoggedInState(page);
    await setupProjectMocks(page);

    let generateRequestBody: GenerateSolutionRequest | null = null;
    await page.route(`**${SolutionsApiPaths.generate}`, async (route) => {
      const request = route.request();
      generateRequestBody = request.postDataJSON() as GenerateSolutionRequest;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TEST_GENERATE_RESPONSE),
      });
    });

    // Act（执行）：访问 AI 方案生成页
    await page.goto(`/projects/${TEST_PROJECT_ID}/ai-generation`);

    // 等待页面渲染完成（标题区可见）
    await expect(
      page.getByRole("heading", { name: "AI 方案生成" }),
    ).toBeVisible();

    // 填写 concept-generation 模板的所有必填变量（4 项：场地描述/设计任务书/参考图 URL/硬约束）
    // Form.Item 通过 label 设置可访问名称（非 name 属性）
    const requiredVariables: ReadonlyArray<{ label: string; value: string }> = [
      { label: "场地描述", value: "Singapore downtown 2000m² 商业地块" },
      { label: "设计任务书", value: "办公塔楼 8-12 层，框架结构" },
      { label: "参考图 URL", value: "无" },
      { label: "硬约束", value: "限高 60m，容积率 3.0" },
    ];
    for (const v of requiredVariables) {
      const textarea = page.getByRole("textbox", { name: v.label });
      // 部分模板可能未渲染该字段，跳过避免误失败
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill(v.value);
      }
    }

    // 点击"生成方案"按钮（位于 Card 的 extra 区域）
    await page.getByRole("button", { name: "生成方案" }).click();

    // Assert（断言）：
    // 1. 请求已发出且包含 promptTemplate=concept-generation
    expect(generateRequestBody).not.toBeNull();
    const requestBody =
      generateRequestBody as unknown as GenerateSolutionRequest;
    expect(requestBody.promptTemplate).toBe("concept-generation");
    expect(requestBody.projectId).toBe(TEST_PROJECT_ID);

    // 2. 响应元信息卡片：模型 Tag + 风险等级 Tag 可见
    await expect(
      page.getByText(TEST_GENERATE_RESPONSE.model, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("风险: medium")).toBeVisible();

    // 3. AI 安全红线标记：需人工复核 Tag 可见（security.md §12）
    // 使用精确匹配避免与顶部 "AI 辅助 · 需人工复核" 与候选卡片 Alert "此候选需人工复核..." 冲突
    await expect(page.getByText("需人工复核", { exact: true })).toBeVisible();

    // 4. 候选卡片标题可见
    const firstCandidate = TEST_GENERATE_RESPONSE.candidates[0]!;
    await expect(page.getByText(firstCandidate.name)).toBeVisible();

    // 5. AI 辅助安全提示 Alert 可见
    await expect(
      page.getByText(
        "所有 AI 输出标记为 AI 辅助，不替代注册建筑师/工程师的专业审签",
      ),
    ).toBeVisible();
  });

  test("3) 复核：访问 AI 审签中心应渲染待审查项统计与待复核记录", async ({
    page,
  }) => {
    // Arrange（准备）：拦截 review 相关 API
    await setupLoggedInState(page);
    await setupProjectMocks(page);

    // mock 合规检查运行结果（2 项通过，1 项失败）
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT_ID}/compliance-check`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildSuccessResponse({
              id: "compliance-run-flow-0001",
              projectId: TEST_PROJECT_ID,
              status: "completed",
              totalRules: 3,
              passedRules: 2,
              failedRules: 1,
              startedAt: "2026-07-22T00:00:00.000Z",
              completedAt: "2026-07-22T00:01:00.000Z",
              results: [
                {
                  id: "result-1",
                  ruleName: "最小层数要求",
                  ruleCode: "CODE_MIN_5_FLOORS",
                  applicableObjects: 1,
                  passCount: 1,
                  failCount: 0,
                  naCount: 0,
                  uncertainCount: 0,
                  status: "passed",
                  lastRunAt: "2026-07-22T00:01:00.000Z",
                },
              ],
            }),
          ),
        });
      },
    );

    // mock 合规发现列表（1 条 pending，1 条 approved）
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT_ID}/findings`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildSuccessResponse([
              {
                id: "finding-1",
                reviewId: "review-1",
                projectId: TEST_PROJECT_ID,
                ruleName: "退线要求",
                ruleCode: "CODE_SETBACK",
                objectName: "Site Boundary",
                objectId: "obj-1",
                severity: "high",
                status: "pending",
                confidence: 0.85,
                description: "用地红线与建筑退线不足",
                codeReference: "OD-02",
                suggestedFix: "调整建筑外轮廓",
                assignedTo: null,
                createdAt: "2026-07-22T00:00:00.000Z",
                updatedAt: "2026-07-22T00:00:00.000Z",
              },
              {
                id: "finding-2",
                reviewId: "review-1",
                projectId: TEST_PROJECT_ID,
                ruleName: "层高要求",
                ruleCode: "CODE_FLOOR_HEIGHT",
                objectName: "Floor 1",
                objectId: "obj-2",
                severity: "low",
                status: "approved",
                confidence: 0.92,
                description: "首层层高 4.5m 满足要求",
                codeReference: "OD-02",
                suggestedFix: "",
                assignedTo: null,
                createdAt: "2026-07-22T00:00:00.000Z",
                updatedAt: "2026-07-22T00:00:00.000Z",
              },
            ]),
          ),
        });
      },
    );

    // mock 门禁汇总
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT_ID}/review/gate-summary`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildSuccessResponse({
              stageName: "前期策划",
              stageCode: "STG-P0",
              gateCode: "G0",
              gateName: "前期策划门",
              passRate: 67,
              pendingItems: 1,
              totalFindings: 2,
              criticalFindings: 0,
              status: "pending",
            }),
          ),
        });
      },
    );

    // mock BCF 协调问题（空列表）
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT_ID}/coordination/issues`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildSuccessResponse([])),
        });
      },
    );

    // mock AI 生成记录待复核列表（1 条 PENDING 记录）
    const pendingRecord = createMockAiGenerationRecord(TEST_PROJECT_ID, {
      id: "ai-rec-flow-pending-0001",
      reviewStatus: "PENDING",
    });
    await page.route(
      `**${AiGenerationRecordApiPaths.pendingReviews(TEST_PROJECT_ID)}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildSuccessResponse([pendingRecord])),
        });
      },
    );

    // Act（执行）：访问 AI 审签中心
    await page.goto(`/review/${TEST_PROJECT_ID}`);

    // Assert（断言）：
    // 1. 页面标题可见
    await expect(
      page.getByRole("heading", { name: "AI 审签中心" }),
    ).toBeVisible();

    // 2. 待审查项统计卡片显示 1（来自 findings 中的 1 条 pending）
    // 使用精确匹配避免与"1 项严重问题需关注"等文本冲突
    await expect(
      page.getByText("待审查项").locator("..").getByText("1", { exact: true }),
    ).toBeVisible();

    // 3. 已批准统计卡片显示 1（来自 findings 中的 1 条 approved）
    await expect(
      page.getByText("已批准").locator("..").getByText("1", { exact: true }),
    ).toBeVisible();

    // 4. 协调问题卡片显示 0（BCF 空列表）
    // 实际渲染结构："0"（总数）+ "0 Open / 0 In Progress"（明细）
    // 使用精确匹配 "0" 避免与子明细冲突，并通过 first 定位到统计值
    await expect(
      page.getByText("协调问题").locator("..").getByText("0", { exact: true }),
    ).toBeVisible();
  });

  test("4) 发布：访问 Stage Gate 页面应渲染门禁列表与 G0 门禁代码", async ({
    page,
  }) => {
    // Arrange（准备）：拦截项目详情 + 阶段 + 门禁 + 合规检查
    await setupLoggedInState(page);
    await setupProjectMocks(page);

    // mock 合规检查运行结果（用于 ComplianceSummary 组件）
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT_ID}/compliance-check`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildSuccessResponse({
              id: "compliance-run-flow-0001",
              projectId: TEST_PROJECT_ID,
              status: "completed",
              totalRules: 3,
              passedRules: 2,
              failedRules: 1,
              startedAt: "2026-07-22T00:00:00.000Z",
              completedAt: "2026-07-22T00:01:00.000Z",
              results: [],
            }),
          ),
        });
      },
    );

    // Act（执行）：访问 Stage Gate 页面
    await page.goto(`/stage-gate/${TEST_PROJECT_ID}`);

    // Assert（断言）：
    // 1. 页面标题与项目名称可见
    await expect(
      page.getByRole("heading", { name: "Stage Gate" }),
    ).toBeVisible();
    await expect(page.getByText(TEST_PROJECT.name)).toBeVisible();

    // 2. 总体进度统计卡片可见
    await expect(page.getByText("Overall Progress")).toBeVisible();

    // 3. 门禁代码 G0 渲染可见（来自 TEST_GATE fixture）
    await expect(page.getByText("G0", { exact: true })).toBeVisible();

    // 4. 前期策划门门禁名称可见
    await expect(page.getByText("前期策划门")).toBeVisible();
  });
});
