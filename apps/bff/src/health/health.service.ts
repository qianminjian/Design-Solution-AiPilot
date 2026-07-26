import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import appConfig from "../config/app.config";
import {
  SchemaValidator,
  type FailureCounterSnapshot,
} from "../proxy/schema-validator.service";

/** 单个服务健康状态 */
export interface ServiceHealth {
  status: "UP" | "DOWN";
  /** 可选：服务额外元信息（版本、URL、响应耗时等） */
  details?: Record<string, unknown>;
  /** 下游错误信息（仅 DOWN 时存在） */
  error?: string;
}

/** Schema 验证失败统计（可观测性 V1，便于 health 端点暴露） */
export interface SchemaValidationStats {
  /** 软验证失败累计次数 */
  softTotal: number;
  /** 严格验证失败累计次数（每次都伴随 502 阻断） */
  strictTotal: number;
  /** 软验证失败快照（按 context + schema 聚合） */
  softFailures: FailureCounterSnapshot;
  /** 严格验证失败快照 */
  strictFailures: FailureCounterSnapshot;
}

/** 健康检查整体响应 */
export interface HealthCheckResult {
  status: "UP" | "DOWN";
  services: {
    bff: ServiceHealth;
    core: ServiceHealth;
    ai: ServiceHealth;
    postgresql: ServiceHealth;
    minio: ServiceHealth;
  };
  /** Schema 验证失败统计（V1 可观测性，V2 接入 Prometheus 后可移除） */
  schemaValidation: SchemaValidationStats;
  timestamp: string;
}

/** 单次下游探测超时（毫秒） */
const PROBE_TIMEOUT_MS = 3_000;

/**
 * 健康检查服务
 * - 检查 BFF 自身（必为 UP，仅用于提供结构化字段）
 * - 检查 Core Service / AI Service / PostgreSQL / MinIO 的可达性
 * - PostgreSQL 与 MinIO 状态由 Core Service 的细粒度健康端点透出（BFF 不直连 DB/S3）
 * - 整体状态：所有依赖 UP 则为 UP，否则为 DOWN
 * - 附带 schema 验证失败统计（V1 可观测性），便于运维监控契约漂移
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly httpService: HttpService,
    private readonly schemaValidator: SchemaValidator,
  ) {}

  /**
   * 汇总所有依赖健康状态
   */
  async checkAll(): Promise<HealthCheckResult> {
    const [bff, core, ai, postgresql, minio] = await Promise.all([
      Promise.resolve(this.checkBff()),
      this.probeCore(),
      this.probeAi(),
      this.probePostgres(),
      this.probeMinio(),
    ]);

    const allUp =
      bff.status === "UP" &&
      core.status === "UP" &&
      ai.status === "UP" &&
      postgresql.status === "UP" &&
      minio.status === "UP";

    return {
      status: allUp ? "UP" : "DOWN",
      services: { bff, core, ai, postgresql, minio },
      schemaValidation: this.collectSchemaValidationStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /** BFF 自身：能响应则视为 UP */
  private checkBff(): ServiceHealth {
    return {
      status: "UP",
      details: {
        version: this.config.version,
        environment: this.config.environment,
      },
    };
  }

  /** Core Service：通过 /health/live 探测 */
  private async probeCore(): Promise<ServiceHealth> {
    return this.probeHttp(`${this.config.coreServiceUrl}/health/live`, "core");
  }

  /** AI Service：通过 /health/live 探测 */
  private async probeAi(): Promise<ServiceHealth> {
    return this.probeHttp(`${this.config.aiServiceUrl}/health/live`, "ai");
  }

  /**
   * PostgreSQL：通过 Core Service 透出的 /health/db 探测
   * - BFF 不直连数据库（避免跨服务数据访问）
   * - 依赖 Core Service 暴露的细粒度健康端点
   */
  private async probePostgres(): Promise<ServiceHealth> {
    return this.probeHttp(
      `${this.config.coreServiceUrl}/health/db`,
      "postgresql",
    );
  }

  /**
   * MinIO：通过 Core Service 透出的 /health/storage 探测
   * - BFF 不直连对象存储
   * - 依赖 Core Service 暴露的对象存储健康端点
   */
  private async probeMinio(): Promise<ServiceHealth> {
    return this.probeHttp(
      `${this.config.coreServiceUrl}/health/storage`,
      "minio",
    );
  }

  /**
   * 收集 schema 验证失败统计
   *
   * V2 接入 Prometheus 后改为 Counter 指标，此处可移除
   */
  private collectSchemaValidationStats(): SchemaValidationStats {
    const totals = this.schemaValidator.readFailureTotals();
    return {
      softTotal: totals.softTotal,
      strictTotal: totals.strictTotal,
      softFailures: this.schemaValidator.readSoftFailureSnapshot(),
      strictFailures: this.schemaValidator.readStrictFailureSnapshot(),
    };
  }

  /**
   * 通用 HTTP 探测：2xx 视为 UP，其他视为 DOWN
   * - 网络异常/超时返回 DOWN 并附错误信息
   */
  private async probeHttp(url: string, label: string): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: PROBE_TIMEOUT_MS }),
      );
      const durationMs = Date.now() - start;
      if (response.status >= 200 && response.status < 300) {
        return {
          status: "UP",
          details: {
            url,
            statusCode: response.status,
            durationMs,
            label,
          },
        };
      }
      return {
        status: "DOWN",
        details: { url, statusCode: response.status, durationMs, label },
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "DOWN",
        details: { url, durationMs, label },
        error: message,
      };
    }
  }
}
