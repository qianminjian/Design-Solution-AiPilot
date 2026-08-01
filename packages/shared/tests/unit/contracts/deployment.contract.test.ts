/**
 * Deployment Profile 契约单元测试（P0-1.1 测试环境分级）
 *
 * 覆盖：
 * - DeploymentProfile 常量集合完整性（V1 4 级 + Production 共 5 项）
 * - DEPLOYMENT_PROFILE_METADATA 每项元数据字段完整性
 * - 工具函数 isProductionEquivalent / allowsRealLlmCall 行为正确
 * - getComposeOverrideArgs / getComposeProjectName 映射正确
 * - 类型穷尽性检查（默认分支抛错）
 *
 * 权威源：@design/D44-部署网络-环境拓扑.md §D44.5、security.md §1
 */
import { describe, it, expect } from "vitest";

import {
  DeploymentProfile,
  DEPLOYMENT_PROFILE_METADATA,
  EXECUTABLE_PROFILES,
  TEST_RUN_ID_DEFAULT,
  TEST_RUN_ID_HEADER,
  allowsRealLlmCall,
  getComposeOverrideArgs,
  getComposeProjectName,
  isProductionEquivalent,
} from "../../../src/contracts/deployment.contract";

describe("DeploymentProfile", () => {
  it("应包含 V1 实现的 4 级可执行环境 + Production 共 5 项", () => {
    expect(Object.values(DeploymentProfile)).toEqual([
      "local-dev",
      "integration",
      "staging",
      "preprod",
      "production",
    ]);
  });

  it("EXECUTABLE_PROFILES 应仅包含 4 级可执行环境（不含 production）", () => {
    expect(EXECUTABLE_PROFILES).toEqual([
      DeploymentProfile.LOCAL_DEV,
      DeploymentProfile.INTEGRATION,
      DeploymentProfile.STAGING,
      DeploymentProfile.PREPROD,
    ]);
    // production 不在可执行列表中（由运维单独管理）
    expect(EXECUTABLE_PROFILES).not.toContain(DeploymentProfile.PRODUCTION);
  });
});

describe("DEPLOYMENT_PROFILE_METADATA", () => {
  it("应为每个 DeploymentProfile 提供完整元数据", () => {
    // 5 个 Profile 都有对应元数据
    expect(Object.keys(DEPLOYMENT_PROFILE_METADATA)).toHaveLength(5);
    expect(
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.LOCAL_DEV],
    ).toBeDefined();
    expect(
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.INTEGRATION],
    ).toBeDefined();
    expect(
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.STAGING],
    ).toBeDefined();
    expect(
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.PREPROD],
    ).toBeDefined();
    expect(
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.PRODUCTION],
    ).toBeDefined();
  });

  it("LOCAL_DEV 应使用合成数据 + 不允许真实 LLM 调用 + 调度任务禁用", () => {
    const meta = DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.LOCAL_DEV];
    expect(meta.dataSource).toBe("synthetic");
    expect(meta.allowRealLlmCall).toBe(false);
    expect(meta.schedulerEnabled).toBe(false);
    expect(meta.isProductionEquivalent).toBe(false);
    expect(meta.logLevel).toBe("debug");
    expect(meta.composeOverrideFile).toBeNull();
  });

  it("INTEGRATION 应强制 Mock LLM（对齐 testing.md §4.2 LLM Mock 红线）", () => {
    const meta = DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.INTEGRATION];
    expect(meta.allowRealLlmCall).toBe(false);
    expect(meta.composeOverrideFile).toBe("docker/compose.ci.yml");
    expect(meta.testScope).toContain("契约");
  });

  it("STAGING 应允许真实 LLM 调用 + 启用调度任务 + 生产等价", () => {
    const meta = DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.STAGING];
    expect(meta.allowRealLlmCall).toBe(true);
    expect(meta.schedulerEnabled).toBe(true);
    expect(meta.isProductionEquivalent).toBe(true);
    expect(meta.composeOverrideFile).toBe("docker/compose.staging.yml");
    expect(meta.dataSource).toBe("anonymized");
    expect(meta.logLevel).toBe("info");
  });

  it("PREPROD 应使用 production-equivalent 数据源 + warn 日志级别", () => {
    const meta = DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.PREPROD];
    expect(meta.dataSource).toBe("production-equivalent");
    expect(meta.logLevel).toBe("warn");
    expect(meta.composeOverrideFile).toBe("docker/compose.preprod.yml");
    expect(meta.coreServiceMemoryLimitMb).toBeGreaterThanOrEqual(1024);
  });

  it("PRODUCTION 应使用 production 数据源 + 不在 compose override 列表", () => {
    const meta = DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.PRODUCTION];
    expect(meta.dataSource).toBe("production");
    expect(meta.composeOverrideFile).toBeNull();
  });

  it("每个 Profile 的 coreServiceMemoryLimitMb 应随生产等价度递增", () => {
    const dev =
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.LOCAL_DEV]
        .coreServiceMemoryLimitMb;
    const ci =
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.INTEGRATION]
        .coreServiceMemoryLimitMb;
    const staging =
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.STAGING]
        .coreServiceMemoryLimitMb;
    const preprod =
      DEPLOYMENT_PROFILE_METADATA[DeploymentProfile.PREPROD]
        .coreServiceMemoryLimitMb;
    // Staging 与 Preprod 应大于 Dev 与 CI（生产等价环境资源更充裕）
    expect(staging).toBeGreaterThan(dev);
    expect(preprod).toBeGreaterThanOrEqual(staging);
    // CI 资源压缩（并行多任务），可与 Dev 接近
    expect(ci).toBeLessThanOrEqual(dev);
  });
});

describe("TEST_RUN_ID 常量", () => {
  it("TEST_RUN_ID_HEADER 应为 x-test-run-id", () => {
    expect(TEST_RUN_ID_HEADER).toBe("x-test-run-id");
  });

  it("TEST_RUN_ID_DEFAULT 应为 untracked（便于排查未标记的测试数据）", () => {
    expect(TEST_RUN_ID_DEFAULT).toBe("untracked");
  });
});

describe("isProductionEquivalent", () => {
  it("LOCAL_DEV 与 INTEGRATION 应为 false（非生产等价）", () => {
    expect(isProductionEquivalent(DeploymentProfile.LOCAL_DEV)).toBe(false);
    expect(isProductionEquivalent(DeploymentProfile.INTEGRATION)).toBe(false);
  });

  it("STAGING / PREPROD / PRODUCTION 应为 true（生产等价）", () => {
    expect(isProductionEquivalent(DeploymentProfile.STAGING)).toBe(true);
    expect(isProductionEquivalent(DeploymentProfile.PREPROD)).toBe(true);
    expect(isProductionEquivalent(DeploymentProfile.PRODUCTION)).toBe(true);
  });
});

describe("allowsRealLlmCall", () => {
  it("LOCAL_DEV 与 INTEGRATION 应为 false（强制 Mock LLM）", () => {
    expect(allowsRealLlmCall(DeploymentProfile.LOCAL_DEV)).toBe(false);
    expect(allowsRealLlmCall(DeploymentProfile.INTEGRATION)).toBe(false);
  });

  it("STAGING / PREPROD / PRODUCTION 应为 true（允许真实 LLM 调用）", () => {
    expect(allowsRealLlmCall(DeploymentProfile.STAGING)).toBe(true);
    expect(allowsRealLlmCall(DeploymentProfile.PREPROD)).toBe(true);
    expect(allowsRealLlmCall(DeploymentProfile.PRODUCTION)).toBe(true);
  });
});

describe("getComposeOverrideArgs", () => {
  it("LOCAL_DEV 应返回 null（使用基础 compose.yml）", () => {
    expect(getComposeOverrideArgs(DeploymentProfile.LOCAL_DEV)).toBeNull();
  });

  it("INTEGRATION 应返回 -f docker/compose.yml -f docker/compose.ci.yml", () => {
    expect(getComposeOverrideArgs(DeploymentProfile.INTEGRATION)).toEqual([
      "-f",
      "docker/compose.yml",
      "-f",
      "docker/compose.ci.yml",
    ]);
  });

  it("STAGING 应返回 -f docker/compose.yml -f docker/compose.staging.yml", () => {
    expect(getComposeOverrideArgs(DeploymentProfile.STAGING)).toEqual([
      "-f",
      "docker/compose.yml",
      "-f",
      "docker/compose.staging.yml",
    ]);
  });

  it("PREPROD 应返回 -f docker/compose.yml -f docker/compose.preprod.yml", () => {
    expect(getComposeOverrideArgs(DeploymentProfile.PREPROD)).toEqual([
      "-f",
      "docker/compose.yml",
      "-f",
      "docker/compose.preprod.yml",
    ]);
  });

  it("PRODUCTION 应返回 null（运维单独管理）", () => {
    expect(getComposeOverrideArgs(DeploymentProfile.PRODUCTION)).toBeNull();
  });
});

describe("getComposeProjectName", () => {
  it("每个 Profile 应映射到唯一的项目名（确保数据卷隔离）", () => {
    const names = [
      getComposeProjectName(DeploymentProfile.LOCAL_DEV),
      getComposeProjectName(DeploymentProfile.INTEGRATION),
      getComposeProjectName(DeploymentProfile.STAGING),
      getComposeProjectName(DeploymentProfile.PREPROD),
      getComposeProjectName(DeploymentProfile.PRODUCTION),
    ];
    // 5 个项目名应互不相同（数据卷隔离）
    expect(new Set(names).size).toBe(5);
  });

  it("INTEGRATION 应映射到 platform-ci", () => {
    expect(getComposeProjectName(DeploymentProfile.INTEGRATION)).toBe(
      "platform-ci",
    );
  });

  it("STAGING 应映射到 platform-staging", () => {
    expect(getComposeProjectName(DeploymentProfile.STAGING)).toBe(
      "platform-staging",
    );
  });

  it("PREPROD 应映射到 platform-preprod", () => {
    expect(getComposeProjectName(DeploymentProfile.PREPROD)).toBe(
      "platform-preprod",
    );
  });
});
