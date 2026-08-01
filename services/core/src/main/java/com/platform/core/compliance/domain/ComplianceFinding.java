package com.platform.core.compliance.domain;

import com.platform.core.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 合规发现（Finding）实体（D45.22 缺陷治理 / D45.25 Finding API）
 *
 * 字段对齐 SIT P0-13.1 路线图：
 *  severity/category/repro/affected requirement/artifact/root state/owner/SLA/fix/verification
 *
 * 4 等级发布规则（验收）：
 *  - CRITICAL 必须修复并独立复测（verifiedBy 与 owner 不同）
 *  - HIGH 默认阻断发布（OPEN/IN_PROGRESS 状态阻断）
 */
@Entity
@Table(name = "compliance_findings", schema = "compliance")
public class ComplianceFinding extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "result_id")
    private UUID resultId;

    /** 严重等级：CRITICAL/HIGH/MEDIUM/LOW */
    @Column(name = "severity", nullable = false)
    private String severity = "MEDIUM";

    /** 状态：OPEN/IN_PROGRESS/FIXED/VERIFIED/CLOSED/REGRESSED */
    @Column(name = "status", nullable = false)
    private String status = "OPEN";

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "note", columnDefinition = "text")
    private String note;

    /** 缺陷类别（D45.22 category，如 SAFETY/STRUCTURE/COMPLIANCE/QUALITY） */
    @Column(name = "category", length = 100)
    private String category;

    /** 复现步骤（D45.22 repro，脱敏不含敏感内容） */
    @Column(name = "repro", columnDefinition = "text")
    private String repro;

    /** 影响的需求/规范（D45.22 affected requirement，双向追踪） */
    @Column(name = "affected_requirement", length = 500)
    private String affectedRequirement;

    /** 关联工件（D45.22 artifact，如图纸/模型文件标识） */
    @Column(name = "artifact", length = 500)
    private String artifact;

    /** 根因状态：IDENTIFIED/ANALYZING/FIXED/REGRESSED */
    @Column(name = "root_state", length = 32)
    private String rootState = "IDENTIFIED";

    /** 责任人（D45.22 owner，与 assignedTo 可不同） */
    @Column(name = "owner")
    private UUID owner;

    /** SLA 截止时间（D45.22 SLA） */
    @Column(name = "sla_due_at")
    private Instant slaDueAt;

    /** 修复方案（D45.22 fix） */
    @Column(name = "fix", columnDefinition = "text")
    private String fix;

    /** 复测结果（D45.22 verification，独立复测证据） */
    @Column(name = "verification", columnDefinition = "text")
    private String verification;

    /** 复测人（独立复测，CRITICAL 必须与 owner 不同） */
    @Column(name = "verified_by")
    private UUID verifiedBy;

    /** 复测时间 */
    @Column(name = "verified_at")
    private Instant verifiedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getResultId() {
        return resultId;
    }

    public void setResultId(UUID resultId) {
        this.resultId = resultId;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(UUID assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getRepro() {
        return repro;
    }

    public void setRepro(String repro) {
        this.repro = repro;
    }

    public String getAffectedRequirement() {
        return affectedRequirement;
    }

    public void setAffectedRequirement(String affectedRequirement) {
        this.affectedRequirement = affectedRequirement;
    }

    public String getArtifact() {
        return artifact;
    }

    public void setArtifact(String artifact) {
        this.artifact = artifact;
    }

    public String getRootState() {
        return rootState;
    }

    public void setRootState(String rootState) {
        this.rootState = rootState;
    }

    public UUID getOwner() {
        return owner;
    }

    public void setOwner(UUID owner) {
        this.owner = owner;
    }

    public Instant getSlaDueAt() {
        return slaDueAt;
    }

    public void setSlaDueAt(Instant slaDueAt) {
        this.slaDueAt = slaDueAt;
    }

    public String getFix() {
        return fix;
    }

    public void setFix(String fix) {
        this.fix = fix;
    }

    public String getVerification() {
        return verification;
    }

    public void setVerification(String verification) {
        this.verification = verification;
    }

    public UUID getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(UUID verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }
}