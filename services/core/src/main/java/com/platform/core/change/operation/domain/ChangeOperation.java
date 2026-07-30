package com.platform.core.change.operation.domain;

import com.platform.core.change.domain.enums.ChangeOperationPhase;
import com.platform.core.change.domain.enums.ChangeOperationPhaseStatus;
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
 * 变更操作阶段实体（D37.16 P12 变更影响与闭环工作台）
 *
 * <p>记录变更请求的关键阶段时间线，用于操作时间线展示。
 *
 * 表：change.change_operation
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Entity(name = "ChangeOperation")
@Table(
        name = "change_operation",
        schema = "change",
        indexes = {
                @Index(name = "idx_change_operation_tenant_change", columnList = "tenant_id,change_id"),
                @Index(name = "idx_change_operation_change", columnList = "change_id"),
                @Index(name = "idx_change_operation_tenant_phase", columnList = "tenant_id,phase")
        }
)
public class ChangeOperation extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联变更请求 ID */
    @Column(name = "change_id", nullable = false, updatable = false)
    private UUID changeId;

    /** 阶段 */
    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 32)
    private ChangeOperationPhase phase;

    /** 状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ChangeOperationPhaseStatus status;

    /** 操作人 */
    @Column(name = "operator_id", length = 200)
    private String operatorId;

    /** 操作时间 */
    @Column(name = "operated_at")
    private Instant operatedAt;

    /** 备注 */
    @Column(name = "comment", length = 2000)
    private String comment;

    /** 操作前状态 */
    @Column(name = "from_status", length = 32)
    private String fromStatus;

    /** 操作后状态 */
    @Column(name = "to_status", length = 32)
    private String toStatus;

    /** 操作序号（用于排序） */
    @Column(name = "sequence", nullable = false)
    private Integer sequence;

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

    public ChangeOperationPhase getPhase() {
        return phase;
    }

    public void setPhase(ChangeOperationPhase phase) {
        this.phase = phase;
    }

    public ChangeOperationPhaseStatus getStatus() {
        return status;
    }

    public void setStatus(ChangeOperationPhaseStatus status) {
        this.status = status;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public Instant getOperatedAt() {
        return operatedAt;
    }

    public void setOperatedAt(Instant operatedAt) {
        this.operatedAt = operatedAt;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(String fromStatus) {
        this.fromStatus = fromStatus;
    }

    public String getToStatus() {
        return toStatus;
    }

    public void setToStatus(String toStatus) {
        this.toStatus = toStatus;
    }

    public Integer getSequence() {
        return sequence;
    }

    public void setSequence(Integer sequence) {
        this.sequence = sequence;
    }
}
