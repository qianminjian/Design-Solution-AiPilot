import { All, Controller, Inject, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";
import {
  proxyWithSoftValidation,
  type GovernanceSchemaMatchRule,
} from "./governance-proxy.helpers";
import {
  governanceAccessGrantSchema,
  governanceAccessGrantListResponseSchema,
  governanceReleaseSchema,
  governanceReleaseListResponseSchema,
  governanceDataAssetSchema,
  governanceDataAssetListResponseSchema,
  governanceAuditLogSchema,
  governanceAuditLogListResponseSchema,
  governanceEvidencePackageSchema,
  governanceEvidencePackageListResponseSchema,
  governanceTestEvidenceSchema,
  governanceTestEvidenceListResponseSchema,
  governanceTestEvidenceVerifyResultSchema,
  governanceBackupPointSchema,
  governanceBackupListResponseSchema,
  governanceRestoreDrillSchema,
  governanceRestoreDrillListResponseSchema,
} from "@design-platform/shared";

/**
 * 治理中心代理控制器（D37.17）
 *
 * 端点 → Core Service（Java）：
 *  - /v1/access-grants/**          Access Review
 *  - /v1/releases/**                AI/Rule Release
 *  - /v1/data-assets/**             Data Governance
 *  - /v1/audit-logs/**             Audit/Evidence（日志）
 *  - /v1/evidence-packages/**      Audit/Evidence（证据包）
 *  - /v1/backups/**                Backup/Restore
 *  - /v1/restore-drills/**          Backup/Restore（演练）
 *
 * V1 策略：软验证
 *  - Core Service 返回 2xx 时按 schema 规则匹配，软验证失败计数但不阻断
 *  - 治理域 schema 首次落地，需观察契约漂移频率再决定是否升级严格模式
 *  - 非 2xx 响应直接透传（如 403 STEP_UP_REQUIRED）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.17 + @design/D40-安全-隐私-合规.md
 */
@Controller("v1")
@UseInterceptors(ProxyInterceptor)
export class GovernanceProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  // ── Access Review：/v1/access-grants/** ──

  @All("access-grants")
  @All("access-grants/*")
  proxyAccessGrants(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      ACCESS_GRANT_RULES,
    );
  }

  // ── AI/Rule Release：/v1/releases/** ──

  @All("releases")
  @All("releases/*")
  proxyReleases(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      RELEASE_RULES,
    );
  }

  // ── Data Governance：/v1/data-assets/** ──

  @All("data-assets")
  @All("data-assets/*")
  proxyDataAssets(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      DATA_ASSET_RULES,
    );
  }

  // ── Audit/Evidence：/v1/audit-logs/** + /v1/evidence-packages/** ──

  @All("audit-logs")
  @All("audit-logs/*")
  proxyAuditLogs(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      AUDIT_LOG_RULES,
    );
  }

  @All("evidence-packages")
  @All("evidence-packages/*")
  proxyEvidencePackages(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      EVIDENCE_PACKAGE_RULES,
    );
  }

  // ── TestEvidence：/v1/test-evidence/**（P0-1.4 测试报告与证据存储） ──

  @All("test-evidence")
  @All("test-evidence/*")
  proxyTestEvidence(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      TEST_EVIDENCE_RULES,
    );
  }

  // ── TestException：/v1/test-exceptions/**（P0-13.3 例外治理） ──

  @All("test-exceptions")
  @All("test-exceptions/*")
  proxyTestExceptions(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      EMPTY_RULES,
    );
  }

  // ── FlakyCase：/v1/flaky-cases/**（P0-13.2 Flaky 治理） ──

  @All("flaky-cases")
  @All("flaky-cases/*")
  proxyFlakyCases(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      EMPTY_RULES,
    );
  }

  // ── QualityGate：/v1/quality-gates/**（P0-13.4 质量门禁签署） ──

  @All("quality-gates")
  @All("quality-gates/*")
  proxyQualityGates(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      EMPTY_RULES,
    );
  }

  // ── Backup/Restore：/v1/backups/** + /v1/restore-drills/** ──

  @All("backups")
  @All("backups/*")
  proxyBackups(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      BACKUP_RULES,
    );
  }

  @All("restore-drills")
  @All("restore-drills/*")
  proxyRestoreDrills(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithSoftValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      RESTORE_DRILL_RULES,
    );
  }
}

// ── Schema 匹配规则 ──
//
// 路径正则使用 ^ 与 $ 精确匹配，避免误匹配子路径。
// 列表响应 schema 验证整个 { items, total } 结构。
// 详情响应 schema 验证单个 DTO。

/** 空规则：纯透传不验证（P0-13.2/13.3/13.4 域 V1 zod schema 待补齐） */
const EMPTY_RULES: readonly GovernanceSchemaMatchRule[] = [];

const ACCESS_GRANT_RULES: readonly GovernanceSchemaMatchRule[] = [
  // GET /v1/access-grants（列表）
  {
    method: "GET",
    pathRegex: /^\/v1\/access-grants$/,
    schema: governanceAccessGrantListResponseSchema,
    operation: "listAccessGrants",
  },
  // GET /v1/access-grants/:id（详情）
  {
    method: "GET",
    pathRegex: /^\/v1\/access-grants\/[^/]+$/,
    schema: governanceAccessGrantSchema,
    operation: "getAccessGrant",
  },
];

const RELEASE_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/releases$/,
    schema: governanceReleaseListResponseSchema,
    operation: "listReleases",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/releases\/[^/]+$/,
    schema: governanceReleaseSchema,
    operation: "getRelease",
  },
];

const DATA_ASSET_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/data-assets$/,
    schema: governanceDataAssetListResponseSchema,
    operation: "listDataAssets",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/data-assets\/[^/]+$/,
    schema: governanceDataAssetSchema,
    operation: "getDataAsset",
  },
];

const AUDIT_LOG_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/audit-logs$/,
    schema: governanceAuditLogListResponseSchema,
    operation: "listAuditLogs",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/audit-logs\/[^/]+$/,
    schema: governanceAuditLogSchema,
    operation: "getAuditLog",
  },
];

const EVIDENCE_PACKAGE_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/evidence-packages$/,
    schema: governanceEvidencePackageListResponseSchema,
    operation: "listEvidencePackages",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/evidence-packages\/[^/]+$/,
    schema: governanceEvidencePackageSchema,
    operation: "getEvidencePackage",
  },
];

const TEST_EVIDENCE_RULES: readonly GovernanceSchemaMatchRule[] = [
  // GET /v1/test-evidence（列表）
  {
    method: "GET",
    pathRegex: /^\/v1\/test-evidence$/,
    schema: governanceTestEvidenceListResponseSchema,
    operation: "listTestEvidence",
  },
  // GET /v1/test-evidence/:id（详情）
  {
    method: "GET",
    pathRegex: /^\/v1\/test-evidence\/[^/]+$/,
    schema: governanceTestEvidenceSchema,
    operation: "getTestEvidence",
  },
  // POST /v1/test-evidence（创建）
  {
    method: "POST",
    pathRegex: /^\/v1\/test-evidence$/,
    schema: governanceTestEvidenceSchema,
    operation: "createTestEvidence",
  },
  // POST /v1/test-evidence/verify（hash 校验）
  {
    method: "POST",
    pathRegex: /^\/v1\/test-evidence\/verify$/,
    schema: governanceTestEvidenceVerifyResultSchema,
    operation: "verifyTestEvidence",
  },
];

const BACKUP_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/backups$/,
    schema: governanceBackupListResponseSchema,
    operation: "listBackups",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/backups\/[^/]+$/,
    schema: governanceBackupPointSchema,
    operation: "getBackup",
  },
];

const RESTORE_DRILL_RULES: readonly GovernanceSchemaMatchRule[] = [
  {
    method: "GET",
    pathRegex: /^\/v1\/restore-drills$/,
    schema: governanceRestoreDrillListResponseSchema,
    operation: "listRestoreDrills",
  },
  {
    method: "GET",
    pathRegex: /^\/v1\/restore-drills\/[^/]+$/,
    schema: governanceRestoreDrillSchema,
    operation: "getRestoreDrill",
  },
];
