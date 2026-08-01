/**
 * Pact 契约元数据类型定义（P0-1.3 契约测试基础设施）
 *
 * 用途：
 *  - 为 V1 zod schema 软验证模式提供统一的 Consumer/Provider 契约元数据
 *  - 为 V2 Pact Broker 自动化契约测试预留生成接口
 *
 * V1 策略：
 *  - BFF/前端调用 schema.safeParse 验证响应，失败计数到 monitoring schemaValidation
 *  - 不阻断用户访问，记录差异用于后续契约漂移分析
 *
 * V2 演进：
 *  - 基于 ConsumerExpectation 元数据自动生成 Pact V3 契约文件
 *  - push 到 docker/compose.ci.yml 中的 pact-broker 服务
 *  - Provider 端（Core Service）启动时拉取契约执行 verification
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 HTTP/OpenAPI 契约
 */
import type { ZodTypeAny } from "zod";

/**
 * 契约交互类型
 *
 * 对齐 Pact V3 规范的 interaction 类型
 *  - request：Consumer 发起请求的契约
 *  - response：Provider 返回响应的契约
 */
export type PactInteractionType = "request" | "response";

/**
 * 契约验证严格级别
 *
 *  - strict：严格验证，失败抛异常（用于 POST/PUT 等关键写入操作）
 *  - soft：软验证，失败仅记录计数到 monitoring（用于 GET 列表/详情）
 *  - passthrough：透传不验证（用于查询/删除/检入等流式操作）
 */
export type PactValidationStrictness = "strict" | "soft" | "passthrough";

/**
 * Schema 类型别名：zod schema 或 null
 *
 * 用于 ConsumerExpectation 的泛型约束，支持 GET/DELETE 等无请求体或响应体的契约
 */
export type SchemaOrNull = ZodTypeAny | null;

/**
 * Consumer 期望声明
 *
 * 描述 Consumer（BFF/前端）对 Provider（Core Service）的契约期望
 * 一个 ConsumerExpectation 对应一个 HTTP 端点的契约
 *
 * @template TReq 请求体 zod schema 类型（GET/DELETE 可为 null）
 * @template TRes 响应体 zod schema 类型（DELETE 可为 null）
 */
export interface ConsumerExpectation<
  TReq extends SchemaOrNull = SchemaOrNull,
  TRes extends SchemaOrNull = SchemaOrNull,
> {
  /** 契约稳定 ID（用于 V2 Pact 文件 can-i-deploy 查询） */
  readonly contractId: string;

  /** Consumer 名称（如 "@design-platform/bff" / "@design-platform/web"） */
  readonly consumer: string;

  /** Provider 名称（如 "@design-platform/core" / "@design-platform/ai"） */
  readonly provider: string;

  /** 业务域（auth/iam/portfolio/cde/ai 等，对齐 ApiDomain 枚举） */
  readonly domain: string;

  /** HTTP 方法 */
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  /** API 路径（如 "/api/v1/auth/login"） */
  readonly path: string;

  /** 简短描述（如 "用户登录"） */
  readonly description: string;

  /** 请求体 zod schema（GET/DELETE 可为 null） */
  readonly requestSchema: TReq;

  /** 响应体 zod schema（DELETE 可为 null） */
  readonly responseSchema: TRes;

  /** 验证严格级别（默认 soft） */
  readonly strictness: PactValidationStrictness;

  /**
   * 契约版本（语义化版本，初始 "1.0.0"）
   *
   * 契约变更时递增：
   *  - MAJOR：破坏性变更（删除字段、改变类型）
   *  - MINOR：兼容性新增（新增可选字段）
   *  - PATCH：修复（如收紧校验规则）
   */
  readonly version: string;
}

/**
 * 契约验证结果
 *
 * BFF 代理层 / 前端运行时调用 validateAgainstExpectation 后的返回值
 */
export interface PactValidationResult {
  /** 契约稳定 ID */
  readonly contractId: string;

  /** 验证是否通过 */
  readonly success: boolean;

  /** 验证类型（request/response） */
  readonly interactionType: PactInteractionType;

  /** 失败时的错误信息（zod error 格式化为字符串） */
  readonly errors: string[];

  /** 验证耗时（毫秒，用于 SLO 监控） */
  readonly durationMs: number;
}

/**
 * 契约验证统计（推送 monitoring schemaValidation 指标）
 *
 * 用于 BFF 启动时输出当前加载的契约总数，便于运维监控契约覆盖率
 */
export interface ContractRegistryStats {
  /** 已注册契约总数 */
  readonly totalContracts: number;

  /** 按 Provider 分组统计 */
  readonly byProvider: Readonly<Record<string, number>>;

  /** 按业务域分组统计 */
  readonly byDomain: Readonly<Record<string, number>>;

  /** 按严格级别分组统计 */
  readonly byStrictness: Readonly<Record<PactValidationStrictness, number>>;
}
