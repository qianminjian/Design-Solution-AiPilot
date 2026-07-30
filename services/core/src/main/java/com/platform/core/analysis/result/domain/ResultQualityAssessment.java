package com.platform.core.analysis.result.domain;

import com.platform.core.analysis.domain.enums.QualityDecision;
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
 * 结果质量评估实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 安全红线：
 *  - 决策 ACCEPT_AS_REVISION / EXCEPTION 需注册师签章
 *  - 完成运行 ≠ 接受结果：评估人须具备资质
 *  - 例外批准须记录 exceptionApprover
 *
 * 表：analysis.result_quality_assessment
 * 字段对齐 V20__init_analysis.sql
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "ResultQualityAssessment")
@Table(name = "result_quality_assessment", schema = "analysis")
public class ResultQualityAssessment extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联结果 ID */
    @Column(name = "result_id", nullable = false)
    private UUID resultId;

    /** 评估决策 */
    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 32)
    private QualityDecision decision;

    /** 检查清单（JSON 数组：[{item, passed, comment?}]） */
    @Column(name = "checklist", columnDefinition = "jsonb")
    private String checklist = "[]";

    /** 评估意见 */
    @Column(name = "comment", nullable = false, length = 4000)
    private String comment;

    /** 评估人 ID */
    @Column(name = "assessor_id", nullable = false, length = 200)
    private String assessorId;

    /** 评估人角色 */
    @Column(name = "assessor_role", nullable = false, length = 100)
    private String assessorRole;

    /** 评估人资质 */
    @Column(name = "assessor_qualification", length = 200)
    private String assessorQualification;

    /** Step-up Token 哈希（高风险决策二次认证） */
    @Column(name = "step_up_token_hash", length = 128)
    private String stepUpTokenHash;

    /** 是否需要注册师签章（ACCEPT_AS_REVISION/EXCEPTION 强制 true） */
    @Column(name = "requires_seal", nullable = false)
    private boolean requiresSeal;

    /** 签章 ID（关联电子签章系统） */
    @Column(name = "seal_id", length = 128)
    private String sealId;

    /** 签章时间 */
    @Column(name = "sealed_at")
    private Instant sealedAt;

    /** 评估时间 */
    @Column(name = "assessed_at", nullable = false)
    private Instant assessedAt;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getResultId() {
        return resultId;
    }

    public void setResultId(UUID resultId) {
        this.resultId = resultId;
    }

    public QualityDecision getDecision() {
        return decision;
    }

    public void setDecision(QualityDecision decision) {
        this.decision = decision;
    }

    public String getChecklist() {
        return checklist;
    }

    public void setChecklist(String checklist) {
        this.checklist = checklist;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getAssessorId() {
        return assessorId;
    }

    public void setAssessorId(String assessorId) {
        this.assessorId = assessorId;
    }

    public String getAssessorRole() {
        return assessorRole;
    }

    public void setAssessorRole(String assessorRole) {
        this.assessorRole = assessorRole;
    }

    public String getAssessorQualification() {
        return assessorQualification;
    }

    public void setAssessorQualification(String assessorQualification) {
        this.assessorQualification = assessorQualification;
    }

    public String getStepUpTokenHash() {
        return stepUpTokenHash;
    }

    public void setStepUpTokenHash(String stepUpTokenHash) {
        this.stepUpTokenHash = stepUpTokenHash;
    }

    public boolean isRequiresSeal() {
        return requiresSeal;
    }

    public void setRequiresSeal(boolean requiresSeal) {
        this.requiresSeal = requiresSeal;
    }

    public String getSealId() {
        return sealId;
    }

    public void setSealId(String sealId) {
        this.sealId = sealId;
    }

    public Instant getSealedAt() {
        return sealedAt;
    }

    public void setSealedAt(Instant sealedAt) {
        this.sealedAt = sealedAt;
    }

    public Instant getAssessedAt() {
        return assessedAt;
    }

    public void setAssessedAt(Instant assessedAt) {
        this.assessedAt = assessedAt;
    }
}
