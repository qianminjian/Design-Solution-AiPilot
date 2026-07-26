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

// ── 本地失败计数器（V1 可观测性） ──
//
// 设计目的：
//  - 在 Sentry/APM 接入前，先建立本地可观测基线
//  - 开发期可通过 window.__schemaValidationFailures 排查契约漂移频率
//  - V2 接入 Sentry 后改为 captureMessage 上报，采样率 10%
//
// 数据结构：Map<context, Map<schemaName, count>>
//  - context：调用上下文（如 "useReview.ragQuery"）
//  - schemaName：schema 名称（如 "ragQueryResponseSchema"）
//  - count：累计失败次数
type FailureCounter = Map<string, Map<string, number>>;

interface SchemaValidationFailureGlobal {
  __schemaValidationFailures?: FailureCounter;
}

/** 安全获取全局失败计数器（SSR 安全） */
function getFailureCounter(): FailureCounter | null {
  if (typeof window === "undefined") return null;
  const globalObj = window as unknown as SchemaValidationFailureGlobal;
  if (!globalObj.__schemaValidationFailures) {
    globalObj.__schemaValidationFailures = new Map();
  }
  return globalObj.__schemaValidationFailures ?? null;
}

/** 递增失败计数器 */
function incrementFailureCounter(context: string, schemaName: string): void {
  const counter = getFailureCounter();
  if (!counter) return;
  const contextMap = counter.get(context) ?? new Map<string, number>();
  contextMap.set(schemaName, (contextMap.get(schemaName) ?? 0) + 1);
  counter.set(context, contextMap);
}

/**
 * 读取累计的失败计数快照（开发期排查用）
 *
 * 返回浅拷贝，避免外部直接修改内部状态
 */
export function readSchemaValidationFailures(): Record<
  string,
  Record<string, number>
> {
  const counter = getFailureCounter();
  if (!counter) return {};
  const snapshot: Record<string, Record<string, number>> = {};
  for (const [context, schemaMap] of counter.entries()) {
    snapshot[context] = Object.fromEntries(schemaMap.entries());
  }
  return snapshot;
}

/** 重置失败计数器（仅测试用） */
export function resetSchemaValidationFailures(): void {
  const counter = getFailureCounter();
  counter?.clear();
}

// ── Sentry 上报接入点（V2 预埋） ──
//
// 设计目的：
//  - V2 阶段接入 Sentry SDK 后，将 schema 验证失败上报到 Sentry
//  - 采样率 10%，避免高频契约漂移淹没 Sentry
//  - 通过 setSentryReporter 注入实际的上报函数，避免在 V1 阶段引入 Sentry SDK 依赖
//
// 使用方式（V2 阶段）：
//   import * as Sentry from "@sentry/nextjs";
//   setSentryReporter((event) => Sentry.captureMessage(event.message, "warning"));
//
// V1 阶段：默认 reporter 为 noop，仅记录本地计数器

/** Sentry 上报事件结构 */
export interface SentryReportEvent {
  /** 事件类型 */
  type: "schema_validation_failure";
  /** 调用上下文 */
  context: string;
  /** schema 名称 */
  schemaName: string;
  /** 错误详情（zod issues） */
  issues: ReadonlyArray<{ path: string; message: string }>;
  /** 验证模式（soft/strict） */
  mode: "soft" | "strict";
}

/** Sentry 上报函数类型 */
type SentryReporter = (event: SentryReportEvent) => void;

/** 当前注入的 Sentry 上报函数（默认 noop） */
let sentryReporter: SentryReporter | null = null;

/**
 * 注入 Sentry 上报函数（V2 阶段使用）
 *
 * V1 阶段不需要调用此函数，schema 验证失败仅记录本地计数器。
 * V2 阶段接入 Sentry SDK 后，调用此函数注入实际上报函数。
 *
 * @param reporter Sentry 上报函数，传入 null 可禁用上报
 */
export function setSentryReporter(reporter: SentryReporter | null): void {
  sentryReporter = reporter;
}

/**
 * 上报 schema 验证失败到 Sentry（V2 阶段生效）
 *
 * 采样率：10%（避免高频契约漂移淹没 Sentry）
 * V1 阶段：sentryReporter 为 null，此函数为 noop
 */
function reportToSentry(
  context: string,
  schemaName: string,
  issues: ReadonlyArray<{ path: string; message: string }>,
  mode: "soft" | "strict",
): void {
  if (!sentryReporter) return;
  // 采样率 10%：Math.random() < 0.1 时上报
  if (Math.random() >= 0.1) return;
  try {
    sentryReporter({
      type: "schema_validation_failure",
      context,
      schemaName,
      issues,
      mode,
    });
  } catch {
    // 上报失败不影响主流程，仅记录 console.warn
    // eslint-disable-next-line no-console
    console.warn(`[SentryReporter] 上报失败：context=${context}`);
  }
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

  // 递增本地失败计数器（V1 可观测性）
  incrementFailureCounter(options.context, schema.constructor.name);

  // 上报到 Sentry（V2 预埋，V1 阶段为 noop）
  reportToSentry(
    options.context,
    schema.constructor.name,
    error.issues,
    "soft",
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

  const error = new ResponseValidationError(options.context, result.error);

  // 严格模式同样递增计数器，便于事后排查
  incrementFailureCounter(options.context, schema.constructor.name);

  // 上报到 Sentry（V2 预埋，V1 阶段为 noop）
  reportToSentry(
    options.context,
    schema.constructor.name,
    error.issues,
    "strict",
  );

  throw error;
}
