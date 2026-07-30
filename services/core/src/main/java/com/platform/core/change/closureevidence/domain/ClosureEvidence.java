package com.platform.core.change.closureevidence.domain;

import com.platform.core.change.domain.enums.ClosureEvidenceStatus;
import com.platform.core.change.domain.enums.ClosureEvidenceType;
import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 关闭证据实体（D37.16 P12 变更影响与闭环工作台）
 *
 * 关键约束：
 *  - 关闭前所有证据必须 VERIFIED
 *  - 证据来源（sourceId）不可空（用于追溯）
 *  - 高风险证据（AI_REVIEW/SIGNATURE）须双人复核
 *
 * 表：change.closure_evidence
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Entity(name = "ChangeClosureEvidence")
@Table(
        name = "closure_evidence",
        schema = "change",
        indexes = {
                @Index(name = "idx_closure_evidence_tenant_change", columnList = "tenant_id,change_id"),
                @Index(name = "idx_closure_evidence_change", columnList = "change_id"),
                @Index(name = "idx_closure_evidence_tenant_status", columnList = "tenant_id,status")
        }
)
public class ClosureEvidence extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联变更请求 ID */
    @Column(name = "change_id", nullable = false, updatable = false)
    private UUID changeId;

    /** 证据类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private ClosureEvidenceType type;

    /** 证据标题 */
    @Column(name = "title", nullable = false, length = 500)
    private String title;

    /** 证据来源 ID（关联实体 ID，如 reviewId/runId/signatureId） */
    @Column(name = "source_id", nullable = false, length = 64)
    private String sourceId;

    /** 证据来源描述 */
    @Column(name = "source_description", length = 1000)
    private String sourceDescription;

    /** 验证状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ClosureEvidenceStatus status;

    /** 验证人 */
    @Column(name = "verified_by", length = 200)
    private String verifiedBy;

    /** 验证时间 */
    @Column(name = "verified_at")
    private Instant verifiedAt;

    /** 验证说明 */
    @Column(name = "verification_note", length = 2000)
    private String verificationNote;

    /** 证据摘要 */
    @Column(name = "summary", nullable = false, length = 2000)
    private String summary;

    /** 证据链接（如适用） */
    @Column(name = "evidence_url", length = 500)
    private String evidenceUrl;

    /** 是否阻断关闭（true 表示必须 VERIFIED 才能关闭变更） */
    @Column(name = "blocks_closure", nullable = false)
    private boolean blocksClosure;

    /** 提交人 */
    @Column(name = "submitted_by", nullable = false, length = 200)
    private String submittedBy;

    /** 提交时间 */
    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    /** 复核人 1（高风险证据双人复核） */
    @Column(name = "reviewer1", length = 200)
    private String reviewer1;

    /** 复核人 2（高风险证据双人复核） */
    @Column(name = "reviewer2", length = 200)
    private String reviewer2;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getChangeId() {
        return changeId;
    }

    public void setChangeId(UUID changeId) {
        this.changeId = changeId;
    }

    public ClosureEvidenceType getType() {
        return type;
    }

    public void setType(ClosureEvidenceType type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getSourceDescription() {
        return sourceDescription;
    }

    public void setSourceDescription(String sourceDescription) {
        this.sourceDescription = sourceDescription;
    }

    public ClosureEvidenceStatus getStatus() {
        return status;
    }

    public void setStatus(ClosureEvidenceStatus status) {
        this.status = status;
    }

    public String getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(String verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getVerificationNote() {
        return verificationNote;
    }

    public void setVerificationNote(String verificationNote) {
        this.verificationNote = verificationNote;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getEvidenceUrl() {
        return evidenceUrl;
    }

    public void setEvidenceUrl(String evidenceUrl) {
        this.evidenceUrl = evidenceUrl;
    }

    public boolean isBlocksClosure() {
        return blocksClosure;
    }

    public void setBlocksClosure(boolean blocksClosure) {
        this.blocksClosure = blocksClosure;
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getReviewer1() {
        return reviewer1;
    }

    public void setReviewer1(String reviewer1) {
        this.reviewer1 = reviewer1;
    }

    public String getReviewer2() {
        return reviewer2;
    }

    public void setReviewer2(String reviewer2) {
        this.reviewer2 = reviewer2;
    }
}
