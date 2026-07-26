import { Injectable, Logger, BadGatewayException } from "@nestjs/common";
import { ZodType } from "zod";
import { ProxyResult } from "../interceptors/proxy.interceptor";

/**
 * Schema 验证上下文（用于日志关联）
 */
export interface ValidationContext {
  /** 业务域（如 auth/portfolio/ai） */
  domain: string;
  /** 操作名（如 login/createProject） */
  operation: string;
  /** 链路追踪 ID */
  traceId?: string;
  /** 下游服务名（如 core-service / ai-service） */
  downstreamService?: string;
}

/**
 * Schema 验证结果
 */
export interface ValidationResult<T> {
  /** 是否通过验证 */
  success: boolean;
  /** 验证通过后的数据（严格模式下抛异常，不会返回 false） */
  data?: T;
  /** 验证失败时的错误详情（仅软验证模式返回） */
  errors?: string[];
}

/**
 * 验证模式
 */
export type ValidationMode = "soft" | "strict";

/**
 * 失败计数器条目
 */
export interface FailureCounterEntry {
  /** 累计失败次数 */
  count: number;
  /** 最近一次失败的 traceId（便于关联日志） */
  lastTraceId?: string;
  /** 最近一次失败时间（ISO 时间戳） */
  lastFailedAt?: string;
}

/**
 * 失败计数器快照结构
 *
 * 数据结构：Map<`domain.operation`, Map<schemaName, entry>>
 */
export interface FailureCounterSnapshot {
  [contextKey: string]: {
    [schemaName: string]: FailureCounterEntry;
  };
}

/**
 * 判断值是否为 Java Core Service 返回的 ApiResponse 包装格式
 * ApiResponse<T> = { code, data, message, traceId }
 */
function isApiResponse(value: unknown): value is {
  code: number;
  data: unknown;
  message?: string | null;
  traceId?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "number" &&
    "data" in value
  );
}

/**
 * Schema 验证服务
 *
 * 设计原则：
 *  - 软验证（validateSoft）：验证失败仅记录告警日志，原数据透传
 *    适用：非安全关键 DTO（如项目列表、阶段实例查询），用于检测契约漂移
 *  - 严格验证（validateStrict）：验证失败抛 BadGatewayException（502）
 *    适用：AI 安全红线（security.md §12）— isAiAssisted / requiresHumanReview 必须存在
 *    适用：认证响应（含 token 字段，结构错误将导致前端无法登录）
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线 + §2.2 认证 Token
 *         .trae/rules/coding-standards.md 显式优于隐式
 *
 * 可观测性 V1（与前端 schema-validator 对齐）：
 *  - 内存计数器按 context + schemaName 聚合，便于 health 端点暴露
 *  - V2 接入 Prometheus 后改为 Counter 指标，标签：(domain, operation, schema, mode)
 */
@Injectable()
export class SchemaValidator {
  private readonly logger = new Logger(SchemaValidator.name);

  /**
   * 内存失败计数器
   *
   * 结构：Map<contextKey, Map<schemaName, entry>>
   *  - contextKey：`${domain}.${operation}`
   *  - schemaName：schema 构造函数名
   *  - entry：{ count, lastTraceId, lastFailedAt }
   *
   * 不存历史明细，仅累计计数与最近一次失败信息，避免内存膨胀
   */
  private readonly softFailures = new Map<
    string,
    Map<string, FailureCounterEntry>
  >();
  private readonly strictFailures = new Map<
    string,
    Map<string, FailureCounterEntry>
  >();

  /**
   * 软验证：验证失败记录告警日志，原数据透传
   *
   * 适用场景：
   *  - 检测 BFF 与 Core Service 的契约漂移
   *  - 非安全关键 DTO 的运行时校验
   *  - 渐进式接入：先观察契约漂移频率，再决定是否升级为严格模式
   *
   * @returns 验证通过返回解析后的数据；失败返回原数据（不抛异常）
   */
  validateSoft<T>(
    data: unknown,
    schema: ZodType<T>,
    context: ValidationContext,
  ): ValidationResult<T> {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }

    const errors = result.error.errors.map(
      (e: { path: (string | number)[]; message: string }) =>
        `${e.path.join(".")}: ${e.message}`,
    );

    this.logger.warn(
      `契约验证失败（软模式，已透传）domain=${context.domain} ` +
        `operation=${context.operation} ` +
        `traceId=${context.traceId ?? "unknown"} ` +
        `downstream=${context.downstreamService ?? "unknown"} ` +
        `errors=${JSON.stringify(errors)}`,
    );

    this.incrementFailure(this.softFailures, schema, context, "soft");

    return { success: false, errors };
  }

  /**
   * 严格验证：验证失败抛 BadGatewayException（502）
   *
   * 适用场景：
   *  - AI 安全红线（security.md §12）：
   *    AI 响应必须包含 isAiAssisted=true 与 requiresHumanReview 字段
   *  - 认证响应：登录/刷新响应结构错误将导致前端无法登录
   *  - AI 审计记录：审计追溯记录结构错误将导致合规问题
   *
   * @throws BadGatewayException 当 schema 验证失败时
   * @returns 验证通过后的数据
   */
  validateStrict<T>(
    data: unknown,
    schema: ZodType<T>,
    context: ValidationContext,
  ): T {
    const result = schema.safeParse(data);
    if (result.success) {
      return result.data;
    }

    const errors = result.error.errors.map(
      (e: { path: (string | number)[]; message: string }) =>
        `${e.path.join(".")}: ${e.message}`,
    );

    this.logger.error(
      `契约验证失败（严格模式，已阻断）domain=${context.domain} ` +
        `operation=${context.operation} ` +
        `traceId=${context.traceId ?? "unknown"} ` +
        `downstream=${context.downstreamService ?? "unknown"} ` +
        `errors=${JSON.stringify(errors)}`,
    );

    this.incrementFailure(this.strictFailures, schema, context, "strict");

    throw new BadGatewayException({
      code: 502,
      errorCode: "CONTRACT_VALIDATION_FAILED",
      status: 502,
      title: "Bad Gateway",
      detail: `下游服务响应不符合契约：${context.domain}.${context.operation}`,
      correlationId: context.traceId ?? "unknown",
      errors,
      retryable: false,
    });
  }

  /**
   * 从 ProxyResult.data 中提取业务数据
   *
   * - Java Core Service 返回 ApiResponse<T> 包装格式（{ code, data, message, traceId }）
   *   提取 data 字段返回业务对象
   * - Python AI Service 直接返回业务对象（无 ApiResponse 包装）
   *   直接返回 result.data
   *
   * 用途：在 schema 验证前从 ApiResponse 包装中提取业务数据
   */
  extractBusinessData(result: ProxyResult): unknown {
    if (isApiResponse(result.data)) {
      return result.data.data;
    }
    return result.data;
  }

  /**
   * 将验证后的业务数据写回 ProxyResult
   *
   * - 如果 result.data 是 ApiResponse 包装格式，写回 data 字段（保留 code/message/traceId）
   * - 否则直接替换 result.data（Python 风格）
   */
  writeBackBusinessData(result: ProxyResult, validatedData: unknown): void {
    if (isApiResponse(result.data)) {
      result.data.data = validatedData;
    } else {
      result.data = validatedData;
    }
  }

  /**
   * 读取软验证失败计数器快照（health 端点暴露用）
   *
   * 返回浅拷贝，避免外部直接修改内部状态
   */
  readSoftFailureSnapshot(): FailureCounterSnapshot {
    return this.snapshotFailures(this.softFailures);
  }

  /**
   * 读取严格验证失败计数器快照（health 端点暴露用）
   */
  readStrictFailureSnapshot(): FailureCounterSnapshot {
    return this.snapshotFailures(this.strictFailures);
  }

  /**
   * 读取软+严聚合失败计数（用于 health 端点简要指标）
   *
   * @returns { softTotal, strictTotal } 总失败次数
   */
  readFailureTotals(): { softTotal: number; strictTotal: number } {
    let softTotal = 0;
    let strictTotal = 0;
    for (const schemaMap of this.softFailures.values()) {
      for (const entry of schemaMap.values()) {
        softTotal += entry.count;
      }
    }
    for (const schemaMap of this.strictFailures.values()) {
      for (const entry of schemaMap.values()) {
        strictTotal += entry.count;
      }
    }
    return { softTotal, strictTotal };
  }

  /**
   * 重置失败计数器（仅测试用）
   */
  resetFailures(): void {
    this.softFailures.clear();
    this.strictFailures.clear();
  }

  /**
   * 递增失败计数器
   */
  private incrementFailure(
    counter: Map<string, Map<string, FailureCounterEntry>>,
    schema: ZodType<unknown>,
    context: ValidationContext,
    _mode: ValidationMode,
  ): void {
    const contextKey = `${context.domain}.${context.operation}`;
    const schemaName = schema.constructor.name ?? "anonymous";
    const schemaMap =
      counter.get(contextKey) ?? new Map<string, FailureCounterEntry>();
    const previous = schemaMap.get(schemaName);
    schemaMap.set(schemaName, {
      count: (previous?.count ?? 0) + 1,
      lastTraceId: context.traceId,
      lastFailedAt: new Date().toISOString(),
    });
    counter.set(contextKey, schemaMap);
  }

  /**
   * 将内部 Map 结构快照为可序列化的对象
   */
  private snapshotFailures(
    counter: Map<string, Map<string, FailureCounterEntry>>,
  ): FailureCounterSnapshot {
    const snapshot: FailureCounterSnapshot = {};
    for (const [contextKey, schemaMap] of counter.entries()) {
      snapshot[contextKey] = Object.fromEntries(schemaMap.entries());
    }
    return snapshot;
  }
}
