package com.platform.core.governance.qualitygate.domain;

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
 * 质量门禁实体（D45.23 质量门禁与验收签署，SIT P0-13.4）
 *
 * 验收：
 *  - 每 Gate 签署角色落实（signerRole 必填）
 *  - AI 不代签（aiSigned 恒为 false，签署角色拒绝 AI/AGENT/SYSTEM）
 *  - 任何签署均是责任人的决定，平台/AI 只聚合证据、检查完整性和记录签名
 */
@Entity
@Table(name = "quality_gate", schema = "governance")
public class QualityGate extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 门禁等级（6 级 Gate） */
    @Enumerated(EnumType.STRING)
    @Column(name = "gate_level", nullable = false, length = 32)
    private QualityGateLevel gateLevel;

    /** 状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private QualityGateStatus status = QualityGateStatus.NOT_STARTED;

    /** 绑定版本/Release */
    @Column(name = "version_target", length = 200)
    private String versionTarget;

    /** 检查项（JSON 数组：{name, requiredEvidence, result}[]，D45.23 必要证据） */
    @Column(name = "checks", nullable = false, columnDefinition = "jsonb")
    private String checks;

    /** 签署角色（D45.23 每 Gate 签署角色，如 Developer+Reviewer / Release Authority） */
    @Column(name = "signer_role", length = 100)
    private String signerRole;

    /** 签署人（Principal ID） */
    @Column(name = "signed_by")
    private UUID signedBy;

    /** 签署时间 */
    @Column(name = "signed_at")
    private Instant signedAt;

    /** 签署决定：PASS/FAIL/Go/No-Go */
    @Column(name = "decision", length = 16)
    private String decision;

    /** AI 是否代签（恒 false：AI 不代签红线） */
    @Column(name = "ai_signed", nullable = false)
    private boolean aiSigned = false;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public QualityGateLevel getGateLevel() {
        return gateLevel;
    }

    public void setGateLevel(QualityGateLevel gateLevel) {
        this.gateLevel = gateLevel;
    }

    public QualityGateStatus getStatus() {
        return status;
    }

    public void setStatus(QualityGateStatus status) {
        this.status = status;
    }

    public String getVersionTarget() {
        return versionTarget;
    }

    public void setVersionTarget(String versionTarget) {
        this.versionTarget = versionTarget;
    }

    public String getChecks() {
        return checks;
    }

    public void setChecks(String checks) {
        this.checks = checks;
    }

    public String getSignerRole() {
        return signerRole;
    }

    public void setSignerRole(String signerRole) {
        this.signerRole = signerRole;
    }

    public UUID getSignedBy() {
        return signedBy;
    }

    public void setSignedBy(UUID signedBy) {
        this.signedBy = signedBy;
    }

    public Instant getSignedAt() {
        return signedAt;
    }

    public void setSignedAt(Instant signedAt) {
        this.signedAt = signedAt;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public boolean isAiSigned() {
        return aiSigned;
    }

    public void setAiSigned(boolean aiSigned) {
        this.aiSigned = aiSigned;
    }
}
