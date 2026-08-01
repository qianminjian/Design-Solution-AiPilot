package com.platform.core.governance.testevidence.dto;

import com.platform.core.governance.testevidence.domain.TestEvidenceRetention;
import com.platform.core.governance.testevidence.domain.TestEvidenceType;

import java.time.Instant;
import java.util.UUID;

/**
 * 测试证据响应 DTO（D45.10 TestEvidence）
 */
public record TestEvidenceDto(
        UUID id,
        TestEvidenceType evidenceType,
        String objectUri,
        String hash,
        String tool,
        String version,
        String rawSummary,
        TestEvidenceRetention retention,
        String classification,
        String signatureAlgorithm,
        String signatureValue,
        String objectId,
        String objectType,
        String testRunId,
        Instant createdAt,
        Instant updatedAt
) {
}
