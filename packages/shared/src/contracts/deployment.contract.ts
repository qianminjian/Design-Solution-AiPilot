/**
 * Deployment Profile 契约（测试环境分级 P0-1.1）
 *
 * 对齐：
 * - @design/D44-部署网络-环境拓扑.md §D44.5 测试环境分级
 * - @design/D44-部署网络-环境拓扑.md §D44.6 Region→Cell 总体拓扑
 * - security.md §1 密钥管理（独立账号/订阅/Cluster/KMS Root/数据库/Bucket/Topic/域名/身份信任域）
 * - .trae/rules/remote-verification.md 远程验证环境执行规则
 *
 * 用途：
 * - 前端/BFF/后端通过此契约共享测试环境元数据
 * - CI 流水线根据 DeploymentProfile 选择对应 docker compose override 文件
 * - D45 验收报告按 DeploymentProfile 分组记录
 * - Support Matrix 差异（D44 §D44.2）按 DeploymentProfile 记录版本与资格
 *
 * 6 级环境（D44.5）：
 * 1. local-dev   - Local/Dev：合成/脱敏小样，开发分支，Mock/沙箱
 * 2. integration - Integration：版本化合成与连接器金样，合并候选，沙箱 Provider
 * 3. test        - Test：固定 TestDataRelease，Release Candidate，Mock+受控测试账号
 * 4. staging     - Staging：生产等价拓扑，匿名/合成规模数据，已签名候选
 * 5. preprod     - Preprod：与 Staging 类似，但可使用合成生成器产生"生产规模"数据
 * 6. production  - Production：授权生产数据，受批准 Git Tag/digest，生产 Adapter
 *
 * V1 实现：4 级可执行环境（dev/ci/staging/preprod），production 由运维单独管理
 * V2 演进：test 环境作为独立 Profile，dr 环境作为 Production 的 DR 副本
 */

/**
 * Deployment Profile 标识符
 *
 * 用于在 docker compose override 文件、CI 流水线、D45 验收报告中区分环境
 */
export const DeploymentProfile = {
  /** Local/Dev：本地开发与单元测试（compose.yml） */
  LOCAL_DEV: "local-dev",
  /** CI/Integration：合并候选验证（compose.ci.yml） */
  INTEGRATION: "integration",
  /** Staging：生产等价拓扑 + 匿名合成数据（compose.staging.yml） */
  STAGING: "staging",
  /** Preprod：生产规模合成数据 + 严格门禁（compose.preprod.yml） */
  PREPROD: "preprod",
  /** Production：生产环境（运维单独管理，不在本契约覆盖范围） */
  PRODUCTION: "production",
} as const;

export type DeploymentProfile =
  (typeof DeploymentProfile)[keyof typeof DeploymentProfile];

/**
 * 可执行的 DeploymentProfile 列表（V1：4 级）
 *
 * Production 不在此列表中，由运维通过 production compose 单独管理
 */
export const EXECUTABLE_PROFILES: readonly DeploymentProfile[] = [
  DeploymentProfile.LOCAL_DEV,
  DeploymentProfile.INTEGRATION,
  DeploymentProfile.STAGING,
  DeploymentProfile.PREPROD,
] as const;

/**
 * DeploymentProfile 元数据（用于 Support Matrix 差异记录与 CI 流水线决策）
 */
export interface DeploymentProfileMeta {
  /** Profile 标识符 */
  readonly profile: DeploymentProfile;
  /** 人类可读名称 */
  readonly label: string;
  /** D44.5 环境描述 */
  readonly description: string;
  /** 对应的 docker compose override 文件路径（相对于项目根目录） */
  readonly composeOverrideFile: string | null;
  /** 是否为生产环境（影响日志级别、健康检查间隔、调度任务启用等） */
  readonly isProductionEquivalent: boolean;
  /** 是否允许真实 LLM API 调用（CI 强制 Mock，Staging/Preprod 允许） */
  readonly allowRealLlmCall: boolean;
  /** 是否启用调度任务（A-64 Token 清理等） */
  readonly schedulerEnabled: boolean;
  /** 日志级别（dev=debug, ci=debug, staging=info, preprod=warn, production=warn） */
  readonly logLevel: "debug" | "info" | "warn" | "error";
  /** 数据来源（D44.5 数据来源列） */
  readonly dataSource:
    "synthetic" | "anonymized" | "production-equivalent" | "production";
  /** 测试范围（D44.5 测试范围列） */
  readonly testScope: string;
  /** 健康检查间隔（秒，生产等价环境间隔更长） */
  readonly healthCheckIntervalSeconds: number;
  /** 资源限制参考（Java Core Service 内存上限 MB） */
  readonly coreServiceMemoryLimitMb: number;
}

/**
 * DeploymentProfile 元数据表（对齐 D44.5）
 *
 * 前端/BFF 通过此表查询环境的运行时配置差异
 * CI 流水线通过此表选择对应 compose override 文件
 * D45 验收报告按 Profile 分组记录
 */
export const DEPLOYMENT_PROFILE_METADATA: Readonly<
  Record<DeploymentProfile, DeploymentProfileMeta>
> = {
  [DeploymentProfile.LOCAL_DEV]: {
    profile: DeploymentProfile.LOCAL_DEV,
    label: "Local/Dev",
    description: "合成/脱敏小样，开发分支，临时 Namespace，Mock/沙箱",
    composeOverrideFile: null, // 使用基础 compose.yml
    isProductionEquivalent: false,
    allowRealLlmCall: false,
    schedulerEnabled: false,
    logLevel: "debug",
    dataSource: "synthetic",
    testScope: "单元、静态、安全扫描",
    healthCheckIntervalSeconds: 10,
    coreServiceMemoryLimitMb: 384,
  },
  [DeploymentProfile.INTEGRATION]: {
    profile: DeploymentProfile.INTEGRATION,
    label: "CI/Integration",
    description: "版本化合成与连接器金样，合并候选，沙箱 Provider，虚拟 Worker",
    composeOverrideFile: "docker/compose.ci.yml",
    isProductionEquivalent: false,
    allowRealLlmCall: false, // CI 强制 Mock，对齐 testing.md §4.2 LLM Mock 红线
    schedulerEnabled: false,
    logLevel: "debug",
    dataSource: "synthetic",
    testScope: "契约/迁移/兼容测试",
    healthCheckIntervalSeconds: 5,
    coreServiceMemoryLimitMb: 256,
  },
  [DeploymentProfile.STAGING]: {
    profile: DeploymentProfile.STAGING,
    label: "Staging",
    description:
      "生产等价拓扑，匿名/合成规模数据，已签名候选，受控真实依赖或仿真",
    composeOverrideFile: "docker/compose.staging.yml",
    isProductionEquivalent: true,
    allowRealLlmCall: true, // Staging 允许真实 LLM 调用验证
    schedulerEnabled: true,
    logLevel: "info",
    dataSource: "anonymized",
    testScope: "D45 发布门禁、回滚演练",
    healthCheckIntervalSeconds: 10,
    coreServiceMemoryLimitMb: 768,
  },
  [DeploymentProfile.PREPROD]: {
    profile: DeploymentProfile.PREPROD,
    label: "Preprod",
    description: "生产规模合成数据，已签名候选，受控真实依赖，严格门禁",
    composeOverrideFile: "docker/compose.preprod.yml",
    isProductionEquivalent: true,
    allowRealLlmCall: true,
    schedulerEnabled: true,
    logLevel: "warn", // Preprod 接近生产日志级别
    dataSource: "production-equivalent", // 合成生成器产生的生产规模数据
    testScope: "D45 发布门禁、回滚演练、生产规模性能验证",
    healthCheckIntervalSeconds: 15,
    coreServiceMemoryLimitMb: 1024,
  },
  [DeploymentProfile.PRODUCTION]: {
    profile: DeploymentProfile.PRODUCTION,
    label: "Production",
    description: "授权生产数据，受批准 Git Tag/digest，生产 Adapter",
    composeOverrideFile: null, // Production 由运维单独管理
    isProductionEquivalent: true,
    allowRealLlmCall: true,
    schedulerEnabled: true,
    logLevel: "warn",
    dataSource: "production",
    testScope: "Canary/健康/SLO/证据",
    healthCheckIntervalSeconds: 15,
    coreServiceMemoryLimitMb: 1024,
  },
};

/**
 * 测试运行 ID 标识符（P0-1.2 数据隔离）
 *
 * - CI 环境：由 CI 流水线注入（如 GitHub Actions run_id）
 * - 本地环境：由开发者手动注入（如时间戳 + 随机数）
 * - Staging/Preprod：由部署脚本注入（如部署批次号）
 *
 * 所有测试产生的数据（DB 行、对象存储文件、日志条目）必须携带此标识，
 * 便于后续清理与 SLO 报表排除（D43 SLO 运营报表排除规则）。
 */
export const TEST_RUN_ID_HEADER = "x-test-run-id";

/**
 * 测试运行 ID 默认值（未注入时使用，便于排查未标记的测试数据）
 */
export const TEST_RUN_ID_DEFAULT = "untracked";

/**
 * 判断 Profile 是否为生产等价环境
 *
 * 生产等价环境启用更严格的健康检查、调度任务、审计日志详细输出
 */
export function isProductionEquivalent(profile: DeploymentProfile): boolean {
  return DEPLOYMENT_PROFILE_METADATA[profile].isProductionEquivalent;
}

/**
 * 判断 Profile 是否允许真实 LLM API 调用
 *
 * 不允许的环境必须使用 Mock LLM Client（对齐 testing.md §4.2 LLM Mock 红线）
 */
export function allowsRealLlmCall(profile: DeploymentProfile): boolean {
  return DEPLOYMENT_PROFILE_METADATA[profile].allowRealLlmCall;
}

/**
 * 根据 Profile 获取 docker compose override 命令片段
 *
 * 返回 null 表示使用基础 compose.yml（无 override）
 */
export function getComposeOverrideArgs(
  profile: DeploymentProfile,
): string[] | null {
  const meta = DEPLOYMENT_PROFILE_METADATA[profile];
  if (!meta.composeOverrideFile) {
    return null;
  }
  return ["-f", "docker/compose.yml", "-f", meta.composeOverrideFile];
}

/**
 * 根据 Profile 获取项目名（docker compose -p 参数）
 *
 * 不同 Profile 使用不同项目名，确保数据卷隔离
 */
export function getComposeProjectName(profile: DeploymentProfile): string {
  switch (profile) {
    case DeploymentProfile.LOCAL_DEV:
      return "platform-dev";
    case DeploymentProfile.INTEGRATION:
      return "platform-ci";
    case DeploymentProfile.STAGING:
      return "platform-staging";
    case DeploymentProfile.PREPROD:
      return "platform-preprod";
    case DeploymentProfile.PRODUCTION:
      return "platform-prod";
    default: {
      // 类型穷尽性检查：未来新增 Profile 时编译失败提示补齐
      const exhaustive: never = profile;
      throw new Error(`Unknown deployment profile: ${String(exhaustive)}`);
    }
  }
}
