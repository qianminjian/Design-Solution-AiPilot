package com.platform.core.operations.action.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
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
 * Operations 主动作实体（D37.17 §危险动作）
 *
 * <p>字段对齐前端 OperationsActionResponseDto 契约：
 * <ul>
 *   <li>operationId: 业务编号（与 id 不同，对外暴露）
 *   <li>actionType/targetType/targetId: 动作三元组
 *   <li>riskLevel: 风险等级（LOW/MEDIUM/HIGH/IRREVERSIBLE）
 *   <li>status: 执行状态（QUEUED/RUNNING/COMPLETED/FAILED）
 *   <li>reason: 操作原因（必填，进入审计日志）
 *   <li>stepUpTokenHash: Step-up Token 哈希（不存储明文，HIGH/IRREVERSIBLE 必填）
 *   <li>impactPreviewAcknowledged: 影响预览已确认（MEDIUM/HIGH/IRREVERSIBLE 必填 true）
 *   <li>initiatedBy/initiatedAt/completedAt: 执行人/时间
 *   <li>affectedCount: 影响对象数量
 *   <li>auditTraceId: 审计追踪 ID（关联 audit_logs.trace_id）
 *   <li>reviewer1/reviewer2: 双人审批（IRREVERSIBLE 动作）
 * </ul>
 *
 * <p>表：operations.operations_action
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D35-API-事件契约.md（危险动作审计）
 * @design D40-信息-物理安全.md（Step-up 认证）
 */
@Entity(name = "OperationsAction")
@Table(name = "operations_action", schema = "operations")
public class OperationsAction extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 操作业务编号（如 "OPS-ACT-20260729-001"） */
    @Column(name = "operation_id", nullable = false, length = 64)
    private String operationId;

    /** 动作类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 16)
    private OperationsActionType actionType;

    /** 目标对象类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 16)
    private OperationsActionTargetType targetType;

    /** 目标对象 ID（UUID 字符串或业务编号） */
    @Column(name = "target_id", nullable = false, length = 128)
    private String targetId;

    /** 风险等级 */
    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 16)
    private OperationsRiskLevel riskLevel;

    /** 执行状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private OperationsActionStatus status;

    /** 操作原因（必填，进入审计日志，PII: L2） */
    @Column(name = "reason", nullable = false, length = 2000)
    private String reason;

    /** Step-up Token 哈希（不存储明文，HIGH/IRREVERSIBLE 必填） */
    @Column(name = "step_up_token_hash", length = 128)
    private String stepUpTokenHash;

    /** 影响预览已确认（MEDIUM/HIGH/IRREVERSIBLE 必填 true） */
    @Column(name = "impact_preview_acknowledged", nullable = false)
    private boolean impactPreviewAcknowledged;

    /** 执行人（用户标识，PII: L2） */
    @Column(name = "initiated_by", nullable = false, length = 200)
    private String initiatedBy;

    /** 触发时间 */
    @Column(name = "initiated_at", nullable = false)
    private Instant initiatedAt;

    /** 完成时间 */
    @Column(name = "completed_at")
    private Instant completedAt;

    /** 影响对象数量 */
    @Column(name = "affected_count", nullable = false)
    private int affectedCount;

    /** 审计追踪 ID（关联 audit_logs.trace_id） */
    @Column(name = "audit_trace_id", nullable = false, length = 128)
    private String auditTraceId;

    /** 错误信息（FAILED 状态时填写） */
    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    /** 审批人 1（IRREVERSIBLE 动作双人审批，V0 占位通过） */
    @Column(name = "reviewer1", length = 200)
    private String reviewer1;

    /** 审批人 2（IRREVERSIBLE 动作双人审批，V0 占位通过） */
    @Column(name = "reviewer2", length = 200)
    private String reviewer2;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getOperationId() {
        return operationId;
    }

    public void setOperationId(String operationId) {
        this.operationId = operationId;
    }

    public OperationsActionType getActionType() {
        return actionType;
    }

    public void setActionType(OperationsActionType actionType) {
        this.actionType = actionType;
    }

    public OperationsActionTargetType getTargetType() {
        return targetType;
    }

    public void setTargetType(OperationsActionTargetType targetType) {
        this.targetType = targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public OperationsRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(OperationsRiskLevel riskLevel) {
        this.riskLevel = riskLevel;
    }

    public OperationsActionStatus getStatus() {
        return status;
    }

    public void setStatus(OperationsActionStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStepUpTokenHash() {
        return stepUpTokenHash;
    }

    public void setStepUpTokenHash(String stepUpTokenHash) {
        this.stepUpTokenHash = stepUpTokenHash;
    }

    public boolean isImpactPreviewAcknowledged() {
        return impactPreviewAcknowledged;
    }

    public void setImpactPreviewAcknowledged(boolean impactPreviewAcknowledged) {
        this.impactPreviewAcknowledged = impactPreviewAcknowledged;
    }

    public String getInitiatedBy() {
        return initiatedBy;
    }

    public void setInitiatedBy(String initiatedBy) {
        this.initiatedBy = initiatedBy;
    }

    public Instant getInitiatedAt() {
        return initiatedAt;
    }

    public void setInitiatedAt(Instant initiatedAt) {
        this.initiatedAt = initiatedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public int getAffectedCount() {
        return affectedCount;
    }

    public void setAffectedCount(int affectedCount) {
        this.affectedCount = affectedCount;
    }

    public String getAuditTraceId() {
        return auditTraceId;
    }

    public void setAuditTraceId(String auditTraceId) {
        this.auditTraceId = auditTraceId;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
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
