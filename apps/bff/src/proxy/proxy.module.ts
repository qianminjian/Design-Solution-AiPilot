import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { AuthProxyController } from "./auth/auth-proxy.controller";
import { CookieService } from "./auth/cookie.service";

/**
 * 代理模块
 * - 汇聚 ProxyController（通用代理）与 AuthProxyController（认证域专用）
 * - 注册 HttpModule 用于下游调用
 * - controllers 数组顺序确保 auth 域路由优先匹配
 *   （NestJS 基于 Express，按声明顺序匹配路由）
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [AuthProxyController, ProxyController],
  providers: [ProxyService, CookieService],
})
export class ProxyModule {}
