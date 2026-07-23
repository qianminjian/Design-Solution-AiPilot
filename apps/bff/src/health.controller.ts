import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import appConfig from "./config/app.config";

/**
 * 健康检查控制器
 * BFF 健康检查包含下游服务（core/ai）可达性
 */
@Controller("health")
export class HealthController {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly httpService: HttpService,
  ) {}

  @Get()
  async check() {
    const result = {
      status: "ok",
      service: "bff",
      version: this.config.version,
      timestamp: new Date().toISOString(),
      downstream: {
        coreService: "unknown" as string,
        aiService: "unknown" as string,
      },
    };

    // 检查核心服务
    try {
      await firstValueFrom(
        this.httpService.get(`${this.config.coreServiceUrl}/health/live`, {
          timeout: 3000,
        }),
      );
      result.downstream.coreService = "up";
    } catch {
      result.downstream.coreService = "down";
    }

    // 检查 AI 服务
    try {
      await firstValueFrom(
        this.httpService.get(`${this.config.aiServiceUrl}/health/live`, {
          timeout: 3000,
        }),
      );
      result.downstream.aiService = "up";
    } catch {
      result.downstream.aiService = "down";
    }

    return result;
  }

  @Get("live")
  liveness() {
    return { status: "up", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async readiness() {
    const coreReady = await this.checkService(
      `${this.config.coreServiceUrl}/health/ready`,
    );
    const aiReady = await this.checkService(
      `${this.config.aiServiceUrl}/health/ready`,
    );

    if (coreReady && aiReady) {
      return { status: "ready" };
    }
    return {
      status: "not_ready",
      details: {
        coreService: coreReady ? "ready" : "not_ready",
        aiService: aiReady ? "ready" : "not_ready",
      },
    };
  }

  private async checkService(url: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 3000 }),
      );
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }
}
