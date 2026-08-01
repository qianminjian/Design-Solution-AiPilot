/**
 * 契约软验证 helper（P0-1.3 契约测试基础设施）
 *
 * 用途：
 *  - BFF 代理层调用 validateResponse 验证 Core Service 返回的响应
 *  - 前端运行时调用 validateResponse 验证 fetch 结果
 *  - 失败时不抛异常（除非 strict 级别），仅返回 PactValidationResult 供监控记录
 *
 * V1 策略：
 *  - soft 级别：失败计数到 monitoring schemaValidation，不阻断用户访问
 *  - strict 级别：失败抛 Error，由 GlobalExceptionHandler 转换为 5xx 响应
 *  - passthrough 级别：直接返回 success=true 不执行验证
 *
 * V2 演进：
 *  - 替换为 Pact V3 verification
 *  - Pact Broker can-i-deploy 检查
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 HTTP/OpenAPI 契约
 *         + monitoring.contract.ts schemaValidation 指标
 */
import type {
  ConsumerExpectation,
  PactValidationResult,
  PactValidationStrictness,
  SchemaOrNull,
} from "./types";

/**
 * 验证响应体是否符合契约期望
 *
 * @param expectation Consumer 期望声明
 * @param data 实际响应数据
 * @returns 验证结果（永不为 null，success=false 时不抛异常）
 */
export function validateResponse<
  TReq extends SchemaOrNull,
  TRes extends SchemaOrNull,
>(
  expectation: ConsumerExpectation<TReq, TRes>,
  data: unknown,
): PactValidationResult {
  return validateInternal(expectation, data, "response");
}

/**
 * 验证请求体是否符合契约期望
 *
 * Consumer 端发起请求前自检（用于 V2 Pact Consumer 测试）
 *
 * @param expectation Consumer 期望声明
 * @param data 实际请求数据
 * @returns 验证结果
 */
export function validateRequest<
  TReq extends SchemaOrNull,
  TRes extends SchemaOrNull,
>(
  expectation: ConsumerExpectation<TReq, TRes>,
  data: unknown,
): PactValidationResult {
  return validateInternal(expectation, data, "request");
}

/**
 * 内部统一验证逻辑
 */
function validateInternal<TReq extends SchemaOrNull, TRes extends SchemaOrNull>(
  expectation: ConsumerExpectation<TReq, TRes>,
  data: unknown,
  interactionType: "request" | "response",
): PactValidationResult {
  const startTime = Date.now();
  const schema =
    interactionType === "request"
      ? expectation.requestSchema
      : expectation.responseSchema;

  // passthrough 级别直接返回成功，不执行验证
  if (expectation.strictness === "passthrough") {
    return {
      contractId: expectation.contractId,
      success: true,
      interactionType,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  // schema 为 null 时不验证（GET 请求通常无 requestSchema）
  if (schema === null) {
    return {
      contractId: expectation.contractId,
      success: true,
      interactionType,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  const result = schema.safeParse(data);
  const durationMs = Date.now() - startTime;

  if (result.success) {
    return {
      contractId: expectation.contractId,
      success: true,
      interactionType,
      errors: [],
      durationMs,
    };
  }

  // 验证失败：格式化错误信息
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message} (code=${issue.code})`,
  );

  // strict 级别抛异常（由 GlobalExceptionHandler 转换为 5xx 响应）
  if (expectation.strictness === "strict") {
    throw new ContractValidationError(
      expectation.contractId,
      expectation.description,
      errors,
    );
  }

  // soft 级别返回失败结果，由调用方记录到 monitoring
  return {
    contractId: expectation.contractId,
    success: false,
    interactionType,
    errors,
    durationMs,
  };
}

/**
 * 契约验证失败异常（仅 strict 级别抛出）
 *
 * 由 BFF GlobalExceptionHandler 捕获并转换为 5xx 响应
 */
export class ContractValidationError extends Error {
  readonly contractId: string;
  readonly contractDescription: string;
  readonly validationErrors: string[];

  constructor(
    contractId: string,
    contractDescription: string,
    validationErrors: string[],
  ) {
    super(
      `Contract validation failed: ${contractId} (${contractDescription}) - ${validationErrors.join("; ")}`,
    );
    this.name = "ContractValidationError";
    this.contractId = contractId;
    this.contractDescription = contractDescription;
    this.validationErrors = validationErrors;
  }
}

/**
 * 默认严格级别（用于 ConsumerExpectation 构造时的便捷默认值）
 */
export const DEFAULT_STRICTNESS: PactValidationStrictness = "soft";

/**
 * 判断契约是否为关键写入操作（POST/PUT/PATCH/DELETE）
 *
 * 用于辅助 Consumer 决定 strictness 默认值
 */
export function isWriteOperation(
  method: ConsumerExpectation["method"],
): boolean {
  return method !== "GET";
}
