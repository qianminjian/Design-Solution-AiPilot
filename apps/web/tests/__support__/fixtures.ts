import type {
  ApiResponse,
  AuthContext,
  LoginResponse,
  OffsetPageResponse,
  ProjectDto,
  DocumentDto,
  StageInstanceDto,
  GateDecisionDto,
  GenerateSolutionResponse,
  SolutionCandidate,
  GuardrailResult,
  AiGenerationRecordDto,
  AiReviewStatus,
} from "@design-platform/shared";
import { BIZ_CODE } from "@design-platform/shared";

/**
 * E2E 测试 mock 数据工厂
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - 禁止在测试中真实调用 BFF/API
 * - 所有 BFF 响应通过 page.route 拦截，返回固定 fixture
 * - 本文件只提供纯数据工厂，不依赖 Playwright API，便于复用与单测
 *
 * 用法：在 spec 文件中用 page.route 拦截对应路径，
 * 调用工厂函数构造响应体并 fulfill。
 */

/** 测试账号：固定邮箱与密码，避免魔法字符串 */
export const TEST_ACCOUNT = {
  email: "tester@example.com",
  password: "Passw0rd!",
  displayName: "E2E Tester",
  userId: "user-e2e-0001",
  tenantId: "tenant-e2e-0001",
  tenantName: "E2E Tenant",
  tenantCode: "E2E",
  region: "SG",
  language: "en",
} as const;

/** Cookie 名称常量（与 api-client.ts readCookie 一致） */
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** 测试用 access token（无意义占位串，仅用于 E2E mock 场景） */
export const MOCK_ACCESS_TOKEN = "mock-access-token-e2e-xxxxxxxxxxxx";

/**
 * 构造成功的 ApiResponse<T>
 * @param data 业务数据
 * @param message 可选提示信息
 */
export function buildSuccessResponse<T>(
  data: T,
  message?: string,
): ApiResponse<T> {
  return {
    code: BIZ_CODE.SUCCESS,
    data,
    traceId: `e2e-trace-${Date.now()}`,
    ...(message ? { message } : {}),
  };
}

/**
 * 构造 mock AuthContext（GET /api/v1/auth/me 响应体 data 部分）
 */
export function createMockAuthContext(): AuthContext {
  return {
    principal: {
      id: TEST_ACCOUNT.userId,
      tenantId: TEST_ACCOUNT.tenantId,
      email: TEST_ACCOUNT.email,
      displayName: TEST_ACCOUNT.displayName,
      type: "internal",
      status: "active",
      locale: "en-US",
      timezone: "Asia/Singapore",
    },
    tenant: {
      id: TEST_ACCOUNT.tenantId,
      name: TEST_ACCOUNT.tenantName,
      code: TEST_ACCOUNT.tenantCode,
      region: TEST_ACCOUNT.region,
      language: TEST_ACCOUNT.language,
    },
    roles: ["architect"],
    permissions: ["project:read", "project:write"],
    session: {
      id: "session-e2e-0001",
      issuedAt: "2026-07-22T00:00:00.000Z",
      expiresAt: "2026-07-22T01:00:00.000Z",
    },
  };
}

/**
 * 构造 mock LoginResponse（POST /api/v1/auth/login 响应体 data 部分）
 */
export function createMockLoginResponse(): LoginResponse {
  return {
    principal: {
      id: TEST_ACCOUNT.userId,
      tenantId: TEST_ACCOUNT.tenantId,
      email: TEST_ACCOUNT.email,
      displayName: TEST_ACCOUNT.displayName,
      type: "internal",
      status: "active",
      locale: "en-US",
      timezone: "Asia/Singapore",
    },
    accessToken: MOCK_ACCESS_TOKEN,
    accessTokenExpiresIn: 900,
    refreshTokenSet: true,
    tenant: {
      id: TEST_ACCOUNT.tenantId,
      name: TEST_ACCOUNT.tenantName,
      code: TEST_ACCOUNT.tenantCode,
      region: TEST_ACCOUNT.region,
      language: TEST_ACCOUNT.language,
    },
    roles: ["architect"],
    permissions: ["project:read", "project:write"],
  };
}

/**
 * 构造 mock 单个项目
 * @param overrides 部分字段覆盖
 */
export function createMockProject(
  overrides: Partial<ProjectDto> = {},
): ProjectDto {
  const index = overrides.id ?? "proj-e2e-0001";
  return {
    id: index,
    tenantId: TEST_ACCOUNT.tenantId,
    organizationId: null,
    code: overrides.code ?? `PRJ-${index.slice(-4)}`,
    name: overrides.name ?? `E2E 测试项目 ${index}`,
    description: null,
    status: overrides.status ?? "active",
    buildingType: overrides.buildingType ?? "office",
    floorsMin: overrides.floorsMin ?? 5,
    floorsMax: overrides.floorsMax ?? 15,
    gfa: overrides.gfa ?? "12000.00",
    siteArea: overrides.siteArea ?? "2000.00",
    region: TEST_ACCOUNT.region,
    language: TEST_ACCOUNT.language,
    classification: overrides.classification ?? "office-mid-rise",
    settings: {},
    metadata: {},
    startedAt: overrides.startedAt ?? "2026-07-01T00:00:00.000Z",
    targetCompletionAt:
      overrides.targetCompletionAt ?? "2027-06-30T00:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-22T00:00:00.000Z",
    createdBy: TEST_ACCOUNT.userId,
    updatedBy: TEST_ACCOUNT.userId,
    rowVersion: overrides.rowVersion ?? 1,
  };
}

/**
 * 构造 mock 项目列表分页响应
 * @param items 项目数组
 * @param total 总数（默认取 items 长度）
 * @param page 当前页
 * @param pageSize 每页条数
 */
export function createMockProjectsPage(
  items: ProjectDto[],
  options: { total?: number; page?: number; pageSize?: number } = {},
): OffsetPageResponse<ProjectDto> {
  const { total = items.length, page = 1, pageSize = 10 } = options;
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * 构造一组典型 mock 项目（3 条，覆盖不同状态与建筑类型）
 */
export function createTypicalMockProjects(): ProjectDto[] {
  return [
    createMockProject({
      id: "proj-e2e-0001",
      code: "PRJ-0001",
      name: "Sunrise Office Tower",
      status: "active",
      buildingType: "office",
      floorsMin: 8,
      floorsMax: 12,
    }),
    createMockProject({
      id: "proj-e2e-0002",
      code: "PRJ-0002",
      name: "Harbor View Complex",
      status: "on_hold",
      buildingType: "mixed",
      floorsMin: 5,
      floorsMax: 10,
    }),
    createMockProject({
      id: "proj-e2e-0003",
      code: "PRJ-0003",
      name: "Central Park Building",
      status: "completed",
      buildingType: "office",
      floorsMin: 6,
      floorsMax: 15,
    }),
  ];
}

// ── 核心业务流程（上传→AI 生成→复核→发布）mock 工厂 ──

/**
 * 构造 mock 单个文档
 * 对应契约：DocumentDto（CDE 域，PII: path 字段 L5）
 */
export function createMockDocument(
  overrides: Partial<DocumentDto> = {},
): DocumentDto {
  const id = overrides.id ?? "doc-e2e-0001";
  return {
    id,
    tenantId: TEST_ACCOUNT.tenantId,
    projectId: overrides.projectId ?? "proj-e2e-0001",
    name: overrides.name ?? "site-sketch-v1.dwg",
    path: overrides.path ?? `sketches/${id}/site-sketch-v1.dwg`,
    mimeType: overrides.mimeType ?? "application/acad",
    sizeBytes: overrides.sizeBytes ?? 102400,
    currentVersionId: overrides.currentVersionId ?? "ver-e2e-0001",
    status: overrides.status ?? "DRAFT",
    checksum: overrides.checksum ?? "sha256:abc123def456",
    createdBy: TEST_ACCOUNT.userId,
    createdAt: overrides.createdAt ?? "2026-07-22T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-22T00:00:00.000Z",
    version: overrides.version ?? 1,
  };
}

/**
 * 构造 mock 文档列表分页响应（核心业务流程-上传步骤）
 */
export function createMockDocumentsPage(
  projectId: string,
  count = 2,
): OffsetPageResponse<DocumentDto> {
  const items = Array.from({ length: count }, (_, i) =>
    createMockDocument({
      id: `doc-e2e-${String(i + 1).padStart(4, "0")}`,
      projectId,
      name: `site-sketch-v${i + 1}.dwg`,
      status: i === 0 ? "PUBLISHED" : "DRAFT",
    }),
  );
  return {
    items,
    total: count,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };
}

/**
 * 构造 mock 阶段实例（V0 裁剪：STG-P0~P7）
 */
export function createMockStage(
  projectId: string,
  overrides: Partial<StageInstanceDto> = {},
): StageInstanceDto {
  return {
    id: overrides.id ?? "stage-e2e-p0",
    tenantId: TEST_ACCOUNT.tenantId,
    projectId,
    stageCode: overrides.stageCode ?? "STG-P0",
    stageName: overrides.stageName ?? "前期策划",
    stageOrder: overrides.stageOrder ?? 0,
    status: overrides.status ?? "active",
    startedAt: overrides.startedAt ?? "2026-07-22T00:00:00.000Z",
    completedAt: overrides.completedAt ?? null,
    metadata: {},
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    rowVersion: 1,
  };
}

/**
 * 构造 mock 门禁决策（PENDING → DECIDED 状态流转）
 */
export function createMockGate(
  projectId: string,
  stageId: string,
  overrides: Partial<GateDecisionDto> = {},
): GateDecisionDto {
  return {
    id: overrides.id ?? "gate-e2e-g0",
    tenantId: TEST_ACCOUNT.tenantId,
    projectId,
    stageId,
    gateCode: overrides.gateCode ?? "G0",
    gateName: overrides.gateName ?? "前期策划门",
    status: overrides.status ?? "pending",
    decision: overrides.decision ?? null,
    decidedAt: overrides.decidedAt ?? null,
    decidedBy: overrides.decidedBy ?? null,
    baselineId: overrides.baselineId ?? null,
    comment: overrides.comment ?? null,
    evidence: overrides.evidence ?? [],
    metadata: {},
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    rowVersion: 1,
  };
}

/**
 * 构造 mock 方案候选（AI 生成结果）
 */
export function createMockSolutionCandidate(
  overrides: Partial<SolutionCandidate> = {},
): SolutionCandidate {
  return {
    name: overrides.name ?? "候选 1：紧凑布局方案",
    content:
      overrides.content ??
      "## 概念设计\n\n- 用地面积：2000 m²\n- 总建筑面积：12000 m²\n- 层数：10 层\n\n布局策略：核心筒居中，办公空间环绕。",
    risks: overrides.risks ?? ["用地面积偏紧，需复核退线要求"],
    feasibilityNotes:
      overrides.feasibilityNotes ?? "结构可行，机电竖井可与服务核心整合",
  };
}

/**
 * 构造 mock Guardrails 校验结果
 */
export function createMockGuardrailResult(
  overrides: Partial<GuardrailResult> = {},
): GuardrailResult {
  return {
    passed: overrides.passed ?? true,
    warnings: overrides.warnings ?? [],
    escalatedReview: overrides.escalatedReview ?? false,
  };
}

/**
 * 构造 mock 方案生成响应（核心业务流程-AI 生成步骤）
 *
 * 强制 isAiAssisted=true，requiresHumanReview=true（按 security.md §12 进入人工复核）
 */
export function createMockGenerateSolutionResponse(
  overrides: Partial<GenerateSolutionResponse> = {},
): GenerateSolutionResponse {
  return {
    candidates: overrides.candidates ?? [createMockSolutionCandidate()],
    rawContent:
      overrides.rawContent ??
      "RAW LLM OUTPUT: Concept design for office tower...",
    model: overrides.model ?? "gpt-4o-2024-08-06",
    usage: overrides.usage ?? {
      promptTokens: 320,
      completionTokens: 480,
      totalTokens: 800,
    },
    riskLevel: overrides.riskLevel ?? "medium",
    promptTemplateUsed: overrides.promptTemplateUsed ?? "concept-generation",
    guardrail: overrides.guardrail ?? createMockGuardrailResult(),
    isAiAssisted: true,
    requiresHumanReview: overrides.requiresHumanReview ?? true,
    latencyMs: overrides.latencyMs ?? 1840,
  };
}

/**
 * 构造 mock AI 生成记录（核心业务流程-复核步骤）
 */
export function createMockAiGenerationRecord(
  projectId: string,
  overrides: Partial<AiGenerationRecordDto> = {},
): AiGenerationRecordDto {
  return {
    id: overrides.id ?? "ai-rec-e2e-0001",
    tenantId: TEST_ACCOUNT.tenantId,
    projectId,
    designOptionId: overrides.designOptionId ?? null,
    promptTemplate: overrides.promptTemplate ?? "concept-generation",
    variables: overrides.variables ?? {},
    renderedPrompt:
      overrides.renderedPrompt ??
      "Generate concept design for 10-floor office tower",
    rawContent: overrides.rawContent ?? "RAW LLM OUTPUT...",
    candidates: overrides.candidates ?? { items: [] },
    model: overrides.model ?? "gpt-4o-2024-08-06",
    tokenUsage: overrides.tokenUsage ?? {
      promptTokens: 320,
      completionTokens: 480,
      totalTokens: 800,
    },
    riskLevel: overrides.riskLevel ?? "medium",
    guardrailResult: overrides.guardrailResult ?? {
      passed: true,
      warnings: [],
      escalatedReview: false,
    },
    requiresHumanReview: overrides.requiresHumanReview ?? true,
    latencyMs: overrides.latencyMs ?? 1840,
    traceId: overrides.traceId ?? "trace-e2e-0001",
    reviewStatus: overrides.reviewStatus ?? ("PENDING" as AiReviewStatus),
    reviewerId: overrides.reviewerId ?? null,
    reviewComment: overrides.reviewComment ?? null,
    reviewedAt: overrides.reviewedAt ?? null,
    reviewDecision: overrides.reviewDecision ?? null,
    createdBy: TEST_ACCOUNT.userId,
    createdAt: overrides.createdAt ?? "2026-07-22T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-22T00:00:00.000Z",
    rowVersion: 1,
  };
}
