package com.platform.core.governance.testevidence.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 测试证据实体（D45.10 TestEvidence）
 *
 * 表：governance.test_evidence
 * 证据 Manifest 字段（对齐 P0-1.4 路线图）：
 *  type/objectUri/hash/tool/version/raw-summary/retention/classification/signature
 *
 * 验收：证据 hash 可校验，签名可验证（D45.10 + D41 WORM/签名/TSA）
 */
@Entity
@Table(name = "test_evidence", schema = "governance")
public class TestEvidence extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 证据类型（unit/integration/e2e/perf/security/acceptance/contract） */
    @Enumerated(EnumType.STRING)
    @Column(name = "evidence_type", nullable = false, length = 32)
    private TestEvidenceType evidenceType;

    /** 对象存储 URI（S3/MinIO） */
    @Column(name = "object_uri", nullable = false, length = 512)
    private String objectUri;

    /** 内容哈希（SHA-256 hex，证据可校验） */
    @Column(name = "hash", nullable = false, length = 64)
    private String hash;

    /** 生成工具（如 "bff-upload" / "mvn-surefire"） */
    @Column(name = "tool", nullable = false, length = 100)
    private String tool;

    /** 工具版本（语义化 1.0.0） */
    @Column(name = "version", nullable = false, length = 32)
    private String version;

    /** 原始摘要（脱敏，不含敏感内容） */
    @Column(name = "raw_summary", nullable = false, length = 512)
    private String rawSummary;

    /** 保留策略 */
    @Enumerated(EnumType.STRING)
    @Column(name = "retention", nullable = false, length = 32)
    private TestEvidenceRetention retention;

    /** 数据分类（对齐 security.md §8 PII 分级 L1-L5） */
    @Column(name = "classification", nullable = false, length = 8)
    private String classification;

    /** 签名算法（HMAC-SHA256 / RSA-SHA256 / RFC3161-TSA） */
    @Column(name = "signature_algorithm", length = 32)
    private String signatureAlgorithm;

    /** 签名值（Base64） */
    @Column(name = "signature_value", length = 1024)
    private String signatureValue;

    /** 关联对象 ID（如 testRunId / releaseId） */
    @Column(name = "object_id", length = 200)
    private String objectId;

    /** 关联对象类型（如 test_run / release / project） */
    @Column(name = "object_type", length = 100)
    private String objectType;

    /** 关联测试运行 ID（对齐 P0-1.2 testRunId 标记机制） */
    @Column(name = "test_run_id", length = 64)
    private String testRunId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public TestEvidenceType getEvidenceType() {
        return evidenceType;
    }

    public void setEvidenceType(TestEvidenceType evidenceType) {
        this.evidenceType = evidenceType;
    }

    public String getObjectUri() {
        return objectUri;
    }

    public void setObjectUri(String objectUri) {
        this.objectUri = objectUri;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getTool() {
        return tool;
    }

    public void setTool(String tool) {
        this.tool = tool;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getRawSummary() {
        return rawSummary;
    }

    public void setRawSummary(String rawSummary) {
        this.rawSummary = rawSummary;
    }

    public TestEvidenceRetention getRetention() {
        return retention;
    }

    public void setRetention(TestEvidenceRetention retention) {
        this.retention = retention;
    }

    public String getClassification() {
        return classification;
    }

    public void setClassification(String classification) {
        this.classification = classification;
    }

    public String getSignatureAlgorithm() {
        return signatureAlgorithm;
    }

    public void setSignatureAlgorithm(String signatureAlgorithm) {
        this.signatureAlgorithm = signatureAlgorithm;
    }

    public String getSignatureValue() {
        return signatureValue;
    }

    public void setSignatureValue(String signatureValue) {
        this.signatureValue = signatureValue;
    }

    public String getObjectId() {
        return objectId;
    }

    public void setObjectId(String objectId) {
        this.objectId = objectId;
    }

    public String getObjectType() {
        return objectType;
    }

    public void setObjectType(String objectType) {
        this.objectType = objectType;
    }

    public String getTestRunId() {
        return testRunId;
    }

    public void setTestRunId(String testRunId) {
        this.testRunId = testRunId;
    }
}
