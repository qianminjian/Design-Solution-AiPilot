import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { AuthProxyController } from "./auth/auth-proxy.controller";
import { CookieService } from "./auth/cookie.service";
import { AiCapabilityProxyController } from "./ai/ai-capability-proxy.controller";
import { AiPromptProxyController } from "./ai/ai-prompt-proxy.controller";
import { AiProxyService } from "./ai/ai-proxy.service";
import { GoldenDatasetProxyController } from "./tevv/tevv-proxy.controller";
import { VerificationItemProxyController } from "./tevv/verification-item-proxy.controller";

/**
 * 代理模块
 * - 汇聚 ProxyController（通用代理）、AuthProxyController（认证域专用）与 AI 域代理
 * - 内部 HttpModule 为 ProxyService / AiProxyService 提供 HttpService
 * - 测试时通过 overrideProvider(ProxyService) / overrideProvider(AiProxyService) 替换
 * - controllers 数组顺序确保路由优先匹配：
 *   AuthProxyController → AiCapabilityProxyController → AiPromptProxyController →
 *   GoldenDatasetProxyController → VerificationItemProxyController → ProxyController
 *   （NestJS 基于 Express，按声明顺序匹配路由）
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [
    AuthProxyController,
    AiCapabilityProxyController,
    AiPromptProxyController,
    GoldenDatasetProxyController,
    VerificationItemProxyController,
    ProxyController,
  ],
  providers: [ProxyService, CookieService, AiProxyService],
})
export class ProxyModule {}
