"use client";

import type { ApiResponse, ApiErrorResponse } from "@design-platform/shared";
import { HttpHeader } from "@design-platform/shared";

/**
 * API 调用错误
 * 携带业务错误码与 HTTP 状态，便于上层按风险等级进入人工复核流程
 */
export class ApiError extends Error {
  /** 业务错误码字符串（机器可读，如 AUTHENTICATION_REQUIRED） */
  readonly errorCode: string;
  /** HTTP 状态码 */
  readonly status: number;
  /** 全链路追踪 ID */
  readonly traceId?: string;
  /** 是否可重试 */
  readonly retryable: boolean;
  /** 字段级错误明细 */
  readonly fieldErrors?: ApiErrorResponse["errors"];

  constructor(response: ApiErrorResponse) {
    super(response.title || response.detail || response.errorCode);
    this.name = "ApiError";
    this.errorCode = response.errorCode;
    this.status = response.status;
    this.traceId = response.correlationId;
    this.retryable = response.retryable;
    this.fieldErrors = response.errors;
  }
}

/** API 基础路径：优先使用 NEXT_PUBLIC_BFF_URL，未配置则走同源 /api（由 Next.js rewrites 代理到 BFF） */
const API_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "";

/** 浏览器端 cookie 读取：BFF 模式下 access token 由 httpOnly Cookie 携带，此处仅作兼容预留 */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)",
    ),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** 生成 UUIDv7 风格的请求 ID（简化版，满足 traceId 传播需求） */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 请求选项 */
export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** 请求体（自动 JSON 序列化） */
  body?: unknown;
  /** 自定义 traceId，未提供时自动生成 */
  traceId?: string;
  /** 是否跳过 JSON 内容类型（如文件上传） */
  skipJsonContentType?: boolean;
}

/**
 * 统一 fetch 封装
 * - 自动添加 x-trace-id Header（D35 traceId 全链路传播约定）
 * - 自动添加 Authorization Header（从 cookie 读取 access token）
 * - 双层状态码校验：HTTP 状态 + 业务 code
 * - 错误时抛出 ApiError，携带 errorCode 供上层处理
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    traceId,
    skipJsonContentType = false,
    headers: customHeaders,
    ...restInit
  } = options;

  // 组装 Headers
  const headers = new Headers(customHeaders);

  // 注入 x-trace-id（D35 traceId 全链路传播约定）：
  // 1. 优先保留 customHeaders 中已设置的值（支持父调用透传 traceId，形成全链路）
  // 2. 其次使用 options.traceId
  // 3. 兜底自动生成 UUID
  if (!headers.has(HttpHeader.X_TRACE_ID)) {
    headers.set(HttpHeader.X_TRACE_ID, traceId ?? generateRequestId());
  }

  // access token 从 cookie 读取（BFF 模式下通常由 httpOnly Cookie 自动携带，此处为显式透传场景预留）
  const accessToken = readCookie("access_token");
  if (accessToken) {
    headers.set(HttpHeader.AUTHORIZATION, `Bearer ${accessToken}`);
  }

  // 序列化请求体
  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob) {
      requestBody = body as BodyInit;
    } else {
      requestBody = JSON.stringify(body);
      if (!skipJsonContentType) {
        headers.set("Content-Type", "application/json");
      }
    }
  }

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...restInit,
    headers,
    body: requestBody,
  });

  // 解析响应：成功为 ApiResponse<T>，错误为 ApiErrorResponse（Problem Details）
  const payload: unknown = await response.json().catch(() => null);

  // HTTP 非 2xx 一律视为错误
  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;
    if (errorPayload && typeof errorPayload.errorCode === "string") {
      throw new ApiError(errorPayload);
    }
    // 响应体不符合 Problem Details 规范，构造兜底错误
    throw new ApiError({
      code: response.status,
      errorCode: "INTERNAL_ERROR",
      status: response.status,
      title: response.statusText || "HTTP Error",
      detail: `请求失败：${response.status}`,
      correlationId: headers.get(HttpHeader.X_TRACE_ID) ?? "",
      retryable: response.status >= 500 || response.status === 429,
    });
  }

  // 双层状态码校验：HTTP 200 且 code === 0 才算成功
  const successPayload = payload as ApiResponse<T> | null;
  if (!successPayload || successPayload.code !== 0) {
    throw new ApiError({
      code: successPayload?.code ?? -1,
      errorCode: "INTERNAL_ERROR",
      status: response.status,
      title: "业务错误",
      detail: successPayload?.message ?? "响应格式异常",
      correlationId:
        successPayload?.traceId ?? headers.get(HttpHeader.X_TRACE_ID) ?? "",
      retryable: false,
    });
  }

  return successPayload.data;
}

/** GET 便捷方法 */
export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}

/** POST 便捷方法 */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "POST", body });
}

/** PUT 便捷方法 */
export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PUT", body });
}

/** PATCH 便捷方法 */
export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PATCH", body });
}

/** DELETE 便捷方法 */
export function apiDelete<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "DELETE" });
}
