import { Request } from "express";
import { Method } from "axios";
import type { ZodType } from "zod";
import { HttpHeader } from "@design-platform/shared";
import { ProxyResult } from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * Governance 代理通用辅助函数
 *
 * 与 iam-proxy.helpers.ts 的差异：
 *  - 使用软验证（validateSoft）而非严格验证（validateStrict）
 *  - 原因：治理域 V1 阶段 schema 首次落地，需观察契约漂移频率
 *    再决定是否升级为严格模式；同时避免阻断用户访问历史数据
 *  - 列表响应同样软验证（iam 跳过数组，governance 不跳过）
 */

/** Schema 匹配规则 */
export interface GovernanceSchemaMatchRule {
  /** HTTP 方法大写 */
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** path 正则（不含 query string） */
  pathRegex: RegExp;
  /** 对应 schema */
  schema: ZodType<unknown>;
  /** 操作名（用于日志关联） */
  operation: string;
}

/** 提取请求体：GET/HEAD/DELETE 无请求体，其他方法透传 request.body */
export function extractBody(request: Request): unknown {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "DELETE") {
    return undefined;
  }
  return request.body;
}

/** 提取需要转发到下游 Core Service 的请求头 */
export function extractForwardHeaders(
  request: Request,
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  const forwardHeaderNames = [
    HttpHeader.AUTHORIZATION,
    HttpHeader.X_TENANT_ID,
    "x-user-id",
    HttpHeader.X_TRACE_ID,
    HttpHeader.IDEMPOTENCY_KEY,
    "content-type",
    HttpHeader.ACCEPT_LANGUAGE,
    HttpHeader.X_TEST_RUN_ID,
  ];

  for (const name of forwardHeaderNames) {
    const value = request.header(name);
    if (value !== undefined && value.length > 0) {
      headers[name] = value;
    }
  }

  if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
    headers[HttpHeader.X_TRACE_ID] = request.traceId;
  }

  return headers;
}

/** 归一化 query 参数 */
export function normalizeQuery(
  query: Request["query"],
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (typeof value === "string") {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.filter(
        (item): item is string => typeof item === "string",
      );
    }
  }
  return result;
}

/** 按规则列表匹配 path，返回首个匹配项；未匹配返回 null */
function matchSchema(
  rules: readonly GovernanceSchemaMatchRule[],
  request: Request,
): GovernanceSchemaMatchRule | null {
  const upperMethod = request.method.toUpperCase();
  const pathOnly = (request.originalUrl.split("?")[0] ?? "").trim();
  return (
    rules.find(
      (rule) => rule.method === upperMethod && rule.pathRegex.test(pathOnly),
    ) ?? null
  );
}

/**
 * 软验证：按规则匹配 schema，对响应业务数据校验
 *
 * 与 iam-proxy.helpers.ts 的差异：
 *  - 使用 validateSoft（不抛异常，原数据透传）
 *  - 列表响应（数组）同样验证（governance 列表 schema 已定义）
 */
function validateByRulesSoft(
  result: ProxyResult,
  request: Request,
  rules: readonly GovernanceSchemaMatchRule[],
  schemaValidator: SchemaValidator,
): void {
  const match = matchSchema(rules, request);
  if (!match) {
    return;
  }

  const businessData = schemaValidator.extractBusinessData(result);
  // 软验证不阻断，即使列表响应也尝试校验
  const validated = schemaValidator.validateSoft(businessData, match.schema, {
    domain: "governance",
    operation: match.operation,
    traceId: request.traceId,
    downstreamService: "core-service",
  });

  if (validated.success && validated.data !== undefined) {
    schemaValidator.writeBackBusinessData(result, validated.data);
  }
}

/**
 * 通用代理转发：forward + 2xx 时软验证
 *
 * V1 策略：软验证失败仅记录告警日志与计数（health 端点暴露），
 * 不阻断用户访问；V2 可基于失败频率决定是否升级为严格模式。
 */
export async function proxyWithSoftValidation(
  request: Request,
  proxyService: ProxyService,
  schemaValidator: SchemaValidator,
  rules: readonly GovernanceSchemaMatchRule[],
): Promise<ProxyResult> {
  const result = await proxyService.forward({
    method: request.method as Method,
    path: request.originalUrl,
    body: extractBody(request),
    headers: extractForwardHeaders(request),
    query: normalizeQuery(request.query),
  });

  if (result.status >= 200 && result.status < 300) {
    validateByRulesSoft(result, request, rules, schemaValidator);
  }

  return result;
}
