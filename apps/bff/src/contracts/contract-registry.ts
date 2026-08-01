/**
 * Consumer 契约注册表（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 聚合 12 个业务域的 ConsumerExpectation，提供查询与统计接口。
 * 数据源：registry/ 目录下按域分组的注册表文件。
 *
 * 用途：
 *  - BFF 代理层根据 contractId 查询契约期望，执行 validateResponse 软验证
 *  - BFF 启动时输出 ContractRegistryStats 到日志，监控契约覆盖率
 *  - V2 演进：基于注册表自动生成 Pact V3 契约文件并 push 到 Broker
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 HTTP/OpenAPI 契约
 */
import type {
  ConsumerExpectation,
  ContractRegistryStats,
  PactValidationStrictness,
} from "@design-platform/shared";
import { AI_TEVV_REGISTRY } from "./registry/ai-tevv.registry";
import { CORE_REGISTRY } from "./registry/core.registry";
import { OPS_REGISTRY } from "./registry/ops.registry";

/** 12 个已覆盖业务域（对齐 P0-2.1 路线图） */
export const CONTRACT_DOMAINS = [
  "auth",
  "iam",
  "portfolio",
  "workflow",
  "cde",
  "ai",
  "tevv",
  "design",
  "compliance",
  "coordination",
  "change",
  "operations",
] as const;
export type ContractDomain = (typeof CONTRACT_DOMAINS)[number];

/** 全量契约注册表（12 域） */
export const CONTRACT_REGISTRY: ConsumerExpectation[] = [
  ...CORE_REGISTRY,
  ...AI_TEVV_REGISTRY,
  ...OPS_REGISTRY,
];

/**
 * 查询契约期望
 *
 * @param contractId 契约稳定 ID（如 "auth-login-v1"）
 * @returns 匹配的契约期望；未找到返回 undefined
 */
export function getExpectation(
  contractId: string,
): ConsumerExpectation | undefined {
  return CONTRACT_REGISTRY.find((e) => e.contractId === contractId);
}

/**
 * 按业务域查询契约期望
 *
 * @param domain 业务域（如 "auth"）
 * @returns 该域的全部契约期望
 */
export function getExpectationsByDomain(domain: string): ConsumerExpectation[] {
  return CONTRACT_REGISTRY.filter((e) => e.domain === domain);
}

/**
 * 计算契约注册表统计信息
 *
 * 用于 BFF 启动日志与 health 端点，监控 12 域契约覆盖率
 */
export function getRegistryStats(): ContractRegistryStats {
  const byProvider = new Map<string, number>();
  const byDomain = new Map<string, number>();
  const byStrictness = new Map<PactValidationStrictness, number>();

  for (const expectation of CONTRACT_REGISTRY) {
    byProvider.set(
      expectation.provider,
      (byProvider.get(expectation.provider) ?? 0) + 1,
    );
    byDomain.set(
      expectation.domain,
      (byDomain.get(expectation.domain) ?? 0) + 1,
    );
    byStrictness.set(
      expectation.strictness,
      (byStrictness.get(expectation.strictness) ?? 0) + 1,
    );
  }

  return {
    totalContracts: CONTRACT_REGISTRY.length,
    byProvider: Object.fromEntries(byProvider),
    byDomain: Object.fromEntries(byDomain),
    byStrictness: {
      passthrough: byStrictness.get("passthrough") ?? 0,
      soft: byStrictness.get("soft") ?? 0,
      strict: byStrictness.get("strict") ?? 0,
    },
  };
}

/**
 * 校验注册表完整性（BFF 启动时调用）
 *
 * 检查：contractId 唯一性、domain 合法性、path/method 非空。
 * 返回错误列表，启动日志输出告警（不阻断启动，V1 软验证策略）。
 */
export function validateRegistry(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const expectation of CONTRACT_REGISTRY) {
    if (seen.has(expectation.contractId)) {
      errors.push(`重复 contractId: ${expectation.contractId}`);
    }
    seen.add(expectation.contractId);

    if (!expectation.path.startsWith("/api/v1/")) {
      errors.push(
        `非法 path（应为 /api/v1/ 前缀）: ${expectation.contractId} -> ${expectation.path}`,
      );
    }
    if (!CONTRACT_DOMAINS.includes(expectation.domain as ContractDomain)) {
      errors.push(
        `未知 domain: ${expectation.contractId} -> ${expectation.domain}`,
      );
    }
  }
  return errors;
}
