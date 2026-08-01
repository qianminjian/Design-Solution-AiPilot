package com.platform.core.governance.testevidence.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 测试证据创建请求（D45.10 TestEvidence Manifest）
 *
 * 字段对齐 P0-1.4 路线图：
 *  type/objectUri/hash/tool/version/raw-summary/retention/classification/signature
 */
public record TestEvidenceCreateRequest(

        /** 证据类型：UNIT/INTEGRATION/E2E/PERFORMANCE/SECURITY/ACCEPTANCE/CONTRACT */
        @NotBlank(message = "evidenceType is required")
        @Size(max = 32)
        String evidenceType,

        /** 对象存储 URI（S3/MinIO） */
        @NotBlank(message = "objectUri is required")
        @Size(max = 512)
        String objectUri,

        /** 内容哈希（SHA-256 hex，证据可校验） */
        @NotBlank(message = "hash is required")
        @Pattern(regexp = "^[a-f0-9]{64}$", message = "hash must be SHA-256 hex (64 chars)")
        String hash,

        /** 生成工具 */
        @NotBlank(message = "tool is required")
        @Size(max = 100)
        String tool,

        /** 工具版本（语义化 1.0.0） */
        @NotBlank(message = "version is required")
        @Size(max = 32)
        String version,

        /** 原始摘要（脱敏，不含敏感内容） */
        @NotBlank(message = "rawSummary is required")
        @Size(max = 512)
        String rawSummary,

        /** 保留策略：PROJECT_LIFETIME/LEGAL_HOLD/DAYS_30/DAYS_90/YEAR_1 */
        @NotBlank(message = "retention is required")
        @Size(max = 32)
        String retention,

        /** 数据分类（对齐 security.md §8 PII 分级 L1-L5） */
        @NotBlank(message = "classification is required")
        @Pattern(regexp = "^[L1-5]$", message = "classification must be L1-L5")
        String classification,

        /** 签名算法（HMAC-SHA256/RSA-SHA256/RFC3161-TSA） */
        @Size(max = 32)
        String signatureAlgorithm,

        /** 签名值（Base64） */
        @Size(max = 1024)
        String signatureValue,

        /** 关联对象 ID（如 releaseId） */
        @Size(max = 200)
        String objectId,

        /** 关联对象类型（如 release/project/test_run） */
        @Size(max = 100)
        String objectType,

        /** 关联测试运行 ID（对齐 P0-1.2 testRunId 标记机制） */
        @Size(max = 64)
        String testRunId
) {
}
