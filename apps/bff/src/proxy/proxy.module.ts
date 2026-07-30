import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { SchemaValidator } from "./schema-validator.service";
import { AuthProxyController } from "./auth/auth-proxy.controller";
import { CookieService } from "./auth/cookie.service";
import { AiCapabilityProxyController } from "./ai/ai-capability-proxy.controller";
import { AiPromptProxyController } from "./ai/ai-prompt-proxy.controller";
import { AiProxyService } from "./ai/ai-proxy.service";
import { SolutionsProxyController } from "./ai/solutions-proxy.controller";
import { AiGenerationRecordProxyController } from "./ai/ai-generation-record-proxy.controller";
import { RagProxyController } from "./ai/rag-proxy.controller";
import { GoldenDatasetProxyController } from "./tevv/tevv-proxy.controller";
import { VerificationItemProxyController } from "./tevv/verification-item-proxy.controller";
import { WorkflowProxyController } from "./workflow/workflow-proxy.controller";
import { DesignOptionProxyController } from "./design/design-option-proxy.controller";
import { ComplianceRuleProxyController } from "./compliance/compliance-rule-proxy.controller";
import { ComplianceCheckProxyController } from "./compliance/compliance-check-proxy.controller";
import { RuleSetProxyController } from "./compliance/rule-set-proxy.controller";
import { FindingProxyController } from "./compliance/finding-proxy.controller";
import { CdeDocumentProxyController } from "./cde/document-proxy.controller";
import { CdeVersionProxyController } from "./cde/version-proxy.controller";
import { CdeUploadController } from "./cde/upload.controller";
import {
  IamProxyController,
  OrganizationProxyController,
  MembershipProxyController,
  RoleBindingProxyController,
  AccessGrantProxyController,
} from "./iam/iam-proxy.controller";
import { GovernanceProxyController } from "./governance/governance-proxy.controller";
import { ChangeProxyController } from "./change/change-proxy.controller";
import { OperationsProxyController } from "./operations/operations-proxy.controller";
import { AnalysisProxyController } from "./analysis/analysis-proxy.controller";
import { MetricsModule } from "../metrics/metrics.module";
import { StorageModule } from "../storage/storage.module";

/**
 * 代理模块
 * - 汇聚 ProxyController（通用代理）、AuthProxyController（认证域专用）与 AI 域代理
 * - 内部 HttpModule 为 ProxyService / AiProxyService 提供 HttpService
 * - 引入 MetricsModule 使 SchemaValidator 可注入 MetricsService（V2 Prometheus Counter）
 * - 测试时通过 overrideProvider(ProxyService) / overrideProvider(AiProxyService) 替换
 * - controllers 数组顺序确保路由优先匹配：
 *   AuthProxyController → AiCapabilityProxyController → AiPromptProxyController →
 *   SolutionsProxyController → AiGenerationRecordProxyController →
 *   RagProxyController（RAG 知识库：rag，AI Service 后端已就位）→
 *   GoldenDatasetProxyController → VerificationItemProxyController →
 *   DesignOptionProxyController → WorkflowProxyController →
 *   ComplianceRuleProxyController → ComplianceCheckProxyController →
 *   RuleSetProxyController → FindingProxyController →
 *   IamProxyController/OrganizationProxyController/MembershipProxyController/
 *   RoleBindingProxyController/AccessGrantProxyController →
 *   GovernanceProxyController（治理域：access-grants/releases/data-assets/
 *   audit-logs/evidence-packages/backups/restore-drills）→
 *   ChangeProxyController（变更域：changes，V0 透传，后端待 V1 实现）→
 *   OperationsProxyController（运营中心：operations，V0 透传，后端待 V1 实现）→
 *   AnalysisProxyController（工程分析：analysis，V0 透传，后端待 V1 实现）→
 *   ProxyController（NestJS 基于 Express，按声明顺序匹配路由）
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 0,
    }),
    MetricsModule,
    StorageModule,
  ],
  controllers: [
    AuthProxyController,
    AiCapabilityProxyController,
    AiPromptProxyController,
    SolutionsProxyController,
    AiGenerationRecordProxyController,
    RagProxyController,
    GoldenDatasetProxyController,
    VerificationItemProxyController,
    DesignOptionProxyController,
    WorkflowProxyController,
    ComplianceRuleProxyController,
    ComplianceCheckProxyController,
    RuleSetProxyController,
    FindingProxyController,
    CdeDocumentProxyController,
    CdeVersionProxyController,
    CdeUploadController,
    IamProxyController,
    OrganizationProxyController,
    MembershipProxyController,
    RoleBindingProxyController,
    AccessGrantProxyController,
    GovernanceProxyController,
    ChangeProxyController,
    OperationsProxyController,
    AnalysisProxyController,
    ProxyController,
  ],
  providers: [ProxyService, CookieService, AiProxyService, SchemaValidator],
  exports: [SchemaValidator],
})
export class ProxyModule {}
