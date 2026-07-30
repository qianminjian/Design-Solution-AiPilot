package com.platform.core.change.taskplan.domain;

import com.platform.core.change.domain.enums.TaskPlanStatus;
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
 * 处置任务实体（D37.16 P12 变更影响与闭环工作台）
 *
 * 关键约束：
 *  - 关闭前所有任务必须 COMPLETED 或 SKIPPED（SKIPPED 须带审批记录）
 *  - 责任人不可空（用于职责分离）
 *  - 计划完成时间不可空（用于监控逾期）
 *
 * 表：change.task_plan_item
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Entity(name = "ChangeTaskPlanItem")
@Table(
        name = "task_plan_item",
        schema = "change",
        indexes = {
                @Index(name = "idx_task_plan_tenant_change", columnList = "tenant_id,change_id"),
                @Index(name = "idx_task_plan_change", columnList = "change_id"),
                @Index(name = "idx_task_plan_tenant_status", columnList = "tenant_id,status"),
                @Index(name = "idx_task_plan_assignee", columnList = "assignee")
        }
)
public class TaskPlanItem extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联变更请求 ID */
    @Column(name = "change_id", nullable = false, updatable = false)
    private UUID changeId;

    /** 任务标题 */
    @Column(name = "title", nullable = false, length = 500)
    private String title;

    /** 任务描述 */
    @Column(name = "description", length = 2000)
    private String description;

    /** 责任人 ID */
    @Column(name = "assignee", nullable = false, length = 200)
    private String assignee;

    /** 所属专业 */
    @Column(name = "discipline", length = 64)
    private String discipline;

    /** 任务状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private TaskPlanStatus status;

    /** 计划完成时间 */
    @Column(name = "due_date", nullable = false)
    private Instant dueDate;

    /** 实际完成时间 */
    @Column(name = "completed_at")
    private Instant completedAt;

    /** 完成人 */
    @Column(name = "completed_by", length = 200)
    private String completedBy;

    /** 关联受影响项 ID 列表（JSON 数组） */
    @Column(name = "affected_item_ids", columnDefinition = "jsonb")
    private String affectedItemIds = "[]";

    /** 任务优先级（高/中/低） */
    @Column(name = "priority", length = 16)
    private String priority;

    /** 任务序号（用于排序） */
    @Column(name = "sequence_order")
    private Integer sequenceOrder;

    /** 是否阻断关闭（true 表示必须完成才能关闭变更） */
    @Column(name = "blocks_closure", nullable = false)
    private boolean blocksClosure;

    /** 跳过原因（SKIPPED 时必填） */
    @Column(name = "skip_reason", length = 1000)
    private String skipReason;

    /** 跳过审批人 */
    @Column(name = "skip_approved_by", length = 200)
    private String skipApprovedBy;

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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getAssignee() {
        return assignee;
    }

    public void setAssignee(String assignee) {
        this.assignee = assignee;
    }

    public String getDiscipline() {
        return discipline;
    }

    public void setDiscipline(String discipline) {
        this.discipline = discipline;
    }

    public TaskPlanStatus getStatus() {
        return status;
    }

    public void setStatus(TaskPlanStatus status) {
        this.status = status;
    }

    public Instant getDueDate() {
        return dueDate;
    }

    public void setDueDate(Instant dueDate) {
        this.dueDate = dueDate;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }

    public String getAffectedItemIds() {
        return affectedItemIds;
    }

    public void setAffectedItemIds(String affectedItemIds) {
        this.affectedItemIds = affectedItemIds;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public Integer getSequenceOrder() {
        return sequenceOrder;
    }

    public void setSequenceOrder(Integer sequenceOrder) {
        this.sequenceOrder = sequenceOrder;
    }

    public boolean isBlocksClosure() {
        return blocksClosure;
    }

    public void setBlocksClosure(boolean blocksClosure) {
        this.blocksClosure = blocksClosure;
    }

    public String getSkipReason() {
        return skipReason;
    }

    public void setSkipReason(String skipReason) {
        this.skipReason = skipReason;
    }

    public String getSkipApprovedBy() {
        return skipApprovedBy;
    }

    public void setSkipApprovedBy(String skipApprovedBy) {
        this.skipApprovedBy = skipApprovedBy;
    }
}
