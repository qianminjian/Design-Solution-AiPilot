/**
 * 测试运行 ID 工具（P0-1.2 测试数据隔离）
 *
 * 用途：CI 流水线注入唯一标识，标记测试产生的审计日志、通知、计量数据，
 * 使其在 SLO 报表自动排除或单独计量，避免污染业务指标。
 *
 * 设计原则：
 *  - 未设置或 "untracked" 视为未标记（生产/本地开发默认值）
 *  - CI 流水线注入 `${github.run_id}-${github.run_attempt}` 或 UUID 视为真实测试运行
 *  - 多语言共享：TypeScript（BFF/前端）+ Java（Core）+ Python（AI）使用相同常量
 *
 * 权威源：@design/D43-SLO-运营报表.md §测试数据排除规则
 *         + @design/D44-部署拓扑-Hybrid-Site.md §测试环境分级
 *         + .trae/rules/testing.md §Mock 规范
 */

// 复用 deployment.contract.ts 已定义的常量，避免重复导出冲突
import {
  TEST_RUN_ID_HEADER,
  TEST_RUN_ID_DEFAULT,
} from "../contracts/deployment.contract";

// 重新导出，方便外部从 testing 模块统一引用
export { TEST_RUN_ID_HEADER };

/** MDC key（Java）/ contextvars key（Python）/ AsyncLocalStorage key（Node.js） */
export const TEST_RUN_ID_MDC_KEY = "testRunId";

/** 默认值：未标记（生产或本地开发场景），与 TEST_RUN_ID_DEFAULT 别名 */
export const UNTRACKED_TEST_RUN_ID = TEST_RUN_ID_DEFAULT;

/** testRunId 最大长度（与数据库 VARCHAR(64) 一致） */
export const TEST_RUN_ID_MAX_LENGTH = 64;

/** UUIDv4 正则（不区分大小写） */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GitHub Actions run_id-run_attempt 格式（如 1234567890-1） */
const GITHUB_RUN_FORMAT_REGEX = /^[0-9]+-[0-9]+$/;

/**
 * 校验 testRunId 格式
 *
 * 接受的格式：
 *  - UUIDv4（推荐用于单次本地测试）
 *  - GitHub Actions run_id-run_attempt 格式（CI 流水线）
 *  - "untracked"（默认值，视为未标记）
 *
 * 拒绝的格式：
 *  - 空字符串、null、undefined
 *  - 超过 64 字符
 *  - 含非法字符（仅允许字母数字、连字符）
 *
 * @param value 待校验的 testRunId
 * @returns 是否合法
 */
export function isValidTestRunId(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (value.length > TEST_RUN_ID_MAX_LENGTH) {
    return false;
  }
  if (value === UNTRACKED_TEST_RUN_ID) {
    return true;
  }
  if (UUID_REGEX.test(value)) {
    return true;
  }
  return GITHUB_RUN_FORMAT_REGEX.test(value);
}

/**
 * 解析 HTTP Header 中的 testRunId
 *
 * 解析规则：
 *  - null / undefined / 空字符串 / 仅空白 → 返回 UNTRACKED_TEST_RUN_ID
 *  - 非法格式 → 返回 UNTRACKED_TEST_RUN_ID（容错，不抛异常）
 *  - 合法格式 → 返回标准化后的字符串（去除前后空白）
 *
 * @param header 请求头值
 * @returns 标准化后的 testRunId（永不为 null）
 */
export function parseTestRunId(header: string | null | undefined): string {
  if (typeof header !== "string") {
    return UNTRACKED_TEST_RUN_ID;
  }
  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return UNTRACKED_TEST_RUN_ID;
  }
  if (!isValidTestRunId(trimmed)) {
    // 非法格式容错：视为未标记，避免阻断请求
    return UNTRACKED_TEST_RUN_ID;
  }
  return trimmed;
}

/**
 * 生成新的 testRunId（UUIDv4）
 *
 * 适用场景：
 *  - 本地开发测试时手动生成
 *  - 测试套件 setup 阶段生成
 *  - 浏览器端测试运行时生成（注入到 localStorage 或 sessionStorage）
 *
 * @returns UUIDv4 格式的 testRunId
 */
export function generateTestRunId(): string {
  // 浏览器环境使用 crypto.randomUUID（Node.js >= 19 也支持）
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // 兜底：基于时间戳 + 随机数的 UUIDv4 生成
  // 仅在 crypto.randomUUID 不可用时使用（如旧版 Node.js 或浏览器）
  const timestamp = Date.now().toString(16).padStart(12, "0");
  const random = Math.random().toString(16).slice(2, 8).padStart(6, "0");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-4${random.slice(0, 3)}-a${random.slice(3, 6)}-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

/**
 * 判断是否为真实测试运行（已标记的测试数据）
 *
 * 用途：SLO 报表查询时排除测试数据
 *
 * @param testRunId 解析后的 testRunId
 * @returns true 表示为真实测试运行（应排除或单独计量），false 表示为生产或本地开发数据
 */
export function isTrackedTestRun(
  testRunId: string | null | undefined,
): boolean {
  if (typeof testRunId !== "string" || testRunId.length === 0) {
    return false;
  }
  return testRunId !== UNTRACKED_TEST_RUN_ID;
}

/**
 * 构建 SLO 报表查询的 testRunId 过滤条件
 *
 * 返回值含义：
 *  - { excludeTestRun: true }：排除所有已标记的测试数据（默认 SLO 报表查询）
 *  - { excludeTestRun: false, testRunId: "xxx" }：仅查询指定 testRunId 的测试数据
 *
 * @param testRunId 可选的 testRunId 过滤值
 * @returns 查询过滤参数
 */
export function buildTestRunIdFilter(
  testRunId?: string | null,
): { excludeTestRun: true } | { excludeTestRun: false; testRunId: string } {
  if (isTrackedTestRun(testRunId)) {
    return { excludeTestRun: false, testRunId: testRunId as string };
  }
  return { excludeTestRun: true };
}
