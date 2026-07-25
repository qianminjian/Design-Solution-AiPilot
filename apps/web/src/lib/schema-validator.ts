"use client";

import { ZodType, ZodError } from "zod";

/**
 * 前端响应验证失败错误
 *
 * 与 ApiError 区分：
 * - ApiError：HTTP/业务错误（来自 BFF ApiErrorResponse）
 * - ResponseValidationError：响应结构不符 schema（前端契约漂移）
 *
 * 设计原则：
 *  - 默认软验证：记录 console.warn，原数据透传，避免阻断用户流程
 *  - 严格模式（strict: true）：抛错让上层 React Query 进入 error 分支
 *  - 关键场景（如 AI 安全红线）应使用严格模式
 */
export class ResponseValidationError extends Error {
  /** 验证错误详情（zod flatten 后的路径-消息对） */
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
  /** 调用上下文（用于日志关联） */
  readonly context: string;

  constructor(context: string, zodError: ZodError) {
    const issues = zodError.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    super(
      `[${context}] 响应不符合 schema：${issues
        .map((i) => `${i.path}=${i.message}`)
        .join("; ")}`,
    );
    this.name = "ResponseValidationError";
    this.issues = issues;
    this.context = context;
  }
}

/**
 * 验证选项
 */
export interface ValidateOptions {
  /** 调用上下文标识（如 "useAuth.me" / "useProjects.list"），用于日志关联 */
  context: string;
  /**
   * 严格模式：验证失败抛 ResponseValidationError
   * 默认 false：软验证，记录 console.warn 并原数据透传
   */
  strict?: boolean;
}

/**
 * 软验证：验证失败记录 console.warn，原数据透传
 *
 * 适用场景：
 *  - 大多数查询接口（列表、详情），防止 BFF/后端契约漂移导致前端运行时错误
 *  - 渐进式接入：先观察契约漂移频率，再决定是否升级为严格模式
 *
 * @returns 验证通过返回解析后的数据；失败返回原数据（不抛异常）
 */
export function validateResponse<T>(
  data: unknown,
  schema: ZodType<T>,
  options: ValidateOptions,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const error = new ResponseValidationError(options.context, result.error);
  // 软模式：记录 console.warn，原数据透传
  // eslint-disable-next-line no-console
  console.warn(
    `[ResponseValidationError] context=${options.context} issues=${JSON.stringify(error.issues)}`,
  );

  // 返回原数据（类型断言为 T，因为前端 schema 通常比运行时数据更严格）
  return data as T;
}

/**
 * 严格验证：验证失败抛 ResponseValidationError
 *
 * 适用场景：
 *  - AI 安全红线（如 AI 响应必须包含 isAiAssisted/requiresHumanReview）
 *  - 认证响应（登录响应结构错误将导致前端无法登录）
 *  - 关键审计追溯记录
 *
 * @throws ResponseValidationError 当 schema 验证失败时
 */
export function validateResponseStrict<T>(
  data: unknown,
  schema: ZodType<T>,
  options: Omit<ValidateOptions, "strict">,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new ResponseValidationError(options.context, result.error);
}
