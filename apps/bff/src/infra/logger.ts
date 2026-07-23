import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";
import pino, { Level, Logger, LoggerOptions } from "pino";
import { getCurrentTraceId } from "./request-context";

/**
 * BFF 服务名（与 application.yml / config/app.config.ts 对齐）
 */
const SERVICE_NAME = "bff";

/**
 * 是否为开发环境
 * - dev：使用 pino-pretty 美化输出
 * - 其他：JSON 结构化输出，便于日志聚合
 */
function isDev(): boolean {
  return (process.env.NODE_ENV ?? "development") === "development";
}

/**
 * 是否为测试环境
 * - 测试环境禁用 pino transport（避免 worker thread 干扰 vitest）
 * - 输出为 JSON 但不绑定 worker
 */
function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * 构建 pino 配置
 * - 字段对齐任务规范：timestamp/level/service/traceId/method/path/status/duration/message
 * - 通过 mixin 自动注入 traceId（从 AsyncLocalStorage 读取）
 * - redact 路径列出敏感字段，避免密码/token 进入日志
 * - messageKey=message，使输出消息字段名为 message（默认 msg）
 */
function buildPinoOptions(): LoggerOptions {
  const base: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (isDev() ? "debug" : "info"),
    // 消息字段名统一为 message
    messageKey: "message",
    // 自动注入字段：每条日志都会合并 mixin 返回的对象
    mixin: () => ({
      service: SERVICE_NAME,
      traceId: getCurrentTraceId(),
    }),
    // 时间戳为 ISO8601 含毫秒
    timestamp: pino.stdTimeFunctions.isoTime,
    // 敏感字段脱敏（observability.md §2.1）
    redact: {
      paths: [
        // 请求体中的密码字段
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.newPassword",
        "req.body.token",
        "req.body.refreshToken",
        // 错误对象中的密钥
        "err.config.headers.authorization",
        "err.config.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
    // 统一字段命名
    formatters: {
      // level 用字符串标签（info/warn/error），不用数字
      level(label: string): Record<string, unknown> {
        return { level: label };
      },
    },
  };

  // 开发环境：pretty print，便于本地调试（测试环境跳过 transport 避免 worker thread 干扰）
  if (isDev() && !isTest()) {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname",
          messageFormat: "{message} traceId={traceId}",
          singleLine: false,
        },
      },
    };
  }

  return base;
}

/**
 * pino Logger 单例
 * - 模块内导出供非 Nest 上下文使用（如 main.ts 启动日志）
 * - 通过 PinoLoggerService 包装为 NestJS LoggerService
 */
export const logger: Logger = pino(buildPinoOptions());

/**
 * NestJS LoggerService 适配器
 * - 让 NestJS 内部日志（Logger 类）走 pino，统一格式
 * - 通过 useLogger 全局注册
 *
 * 实现要点：
 * - fatal → pino.fatal（NestJS 的 fatal 在 pino 中对应 level=60）
 * - error → pino.error
 * - warn  → pino.warn
 * - log   → pino.info
 * - debug → pino.debug
 * - verbose → pino.trace
 */
@Injectable()
export class PinoLoggerService implements NestLoggerService {
  private readonly pino: Logger = logger;

  log(message: unknown, context?: string): void {
    this.write("info", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("trace", message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write("fatal", message, context);
  }

  /**
   * 统一写入入口
   * - 字符串消息：直接写
   * - 对象消息：作为 structured field 写
   * - context 作为 logger_name 字段输出，便于按模块过滤
   */
  private write(
    level: Level,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const payload: Record<string, unknown> = {
      logger_name: context ?? "Application",
    };
    if (trace !== undefined && trace !== null && trace !== "") {
      payload.stack = trace;
    }
    if (typeof message === "string") {
      this.pino[level](payload, message);
    } else if (message instanceof Error) {
      // 错误对象：pino 的 err 序列化器会自动处理 stack
      this.pino[level]({ ...payload, err: message }, message.message);
    } else if (message !== null && typeof message === "object") {
      this.pino[level]({ ...payload, ...(message as Record<string, unknown>) });
    } else {
      this.pino[level](payload, String(message));
    }
  }
}
