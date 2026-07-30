package com.platform.core.change.affecteditem.domain;

import com.platform.core.change.domain.enums.AffectedAction;
import com.platform.core.change.domain.enums.AffectedObjectType;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;
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
 * 受影响项实体（D37.16 P12 变更影响与闭环工作台）
 *
 * 关键约束：
 *  - UNKNOWN 影响项阻断关闭（必须先解决）
 *  - 需复查项必须进入复查流程
 *  - 责任人不可空（用于职责分离）
 *  - 影响依据须可追溯（算法/人工）
 *
 * 表：change.affected_item
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Entity(name = "ChangeAffectedItem")
@Table(
        name = "affected_item",
        schema = "change",
        indexes = {
                @Index(name = "idx_affected_item_tenant_change", columnList = "tenant_id,change_id"),
                @Index(name = "idx_affected_item_change", columnList = "change_id"),
                @Index(name = "idx_affected_item_tenant_impact", columnList = "tenant_id,impact")
        }
)
public class AffectedItem extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联变更请求 ID */
    @Column(name = "change_id", nullable = false, updatable = false)
    private UUID changeId;

    /** 受影响对象类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private AffectedObjectType type;

    /** 对象编号（如 REQ-001、WALL-1234） */
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    /** 对象名称 */
    @Column(name = "name", nullable = false, length = 500)
    private String name;

    /** 所属专业 */
    @Column(name = "discipline", nullable = false, length = 64)
    private String discipline;

    /** 变更动作 */
    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 16)
    private AffectedAction action;

    /** 影响判定 */
    @Enumerated(EnumType.STRING)
    @Column(name = "impact", nullable = false, length = 16)
    private ImpactLevel impact;

    /** 是否需要复查 */
    @Column(name = "recheck_required", nullable = false)
    private boolean recheckRequired;

    /** 复查状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "recheck_status", nullable = false, length = 16)
    private RecheckStatus recheckStatus;

    /** 责任人 ID */
    @Column(name = "owner", nullable = false, length = 200)
    private String owner;

    /** 影响依据（算法/人工） */
    @Column(name = "evidence", length = 2000)
    private String evidence;

    /** 来源 Baseline ID（变更触发时的基线） */
    @Column(name = "source_baseline_id", length = 64)
    private String sourceBaselineId;

    /** 水位（变更水位标记，用于版本追溯） */
    @Column(name = "watermark", length = 64)
    private String watermark;

    /** 关联对象 ID（可选，用于跨域追溯） */
    @Column(name = "object_ref_id", length = 64)
    private String objectRefId;

    /** 复查完成时间 */
    @Column(name = "rechecked_at")
    private Instant recheckedAt;

    /** 复查人 */
    @Column(name = "rechecked_by", length = 200)
    private String recheckedBy;

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

    public AffectedObjectType getType() {
        return type;
    }

    public void setType(AffectedObjectType type) {
        this.type = type;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDiscipline() {
        return discipline;
    }

    public void setDiscipline(String discipline) {
        this.discipline = discipline;
    }

    public AffectedAction getAction() {
        return action;
    }

    public void setAction(AffectedAction action) {
        this.action = action;
    }

    public ImpactLevel getImpact() {
        return impact;
    }

    public void setImpact(ImpactLevel impact) {
        this.impact = impact;
    }

    public boolean isRecheckRequired() {
        return recheckRequired;
    }

    public void setRecheckRequired(boolean recheckRequired) {
        this.recheckRequired = recheckRequired;
    }

    public RecheckStatus getRecheckStatus() {
        return recheckStatus;
    }

    public void setRecheckStatus(RecheckStatus recheckStatus) {
        this.recheckStatus = recheckStatus;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getSourceBaselineId() {
        return sourceBaselineId;
    }

    public void setSourceBaselineId(String sourceBaselineId) {
        this.sourceBaselineId = sourceBaselineId;
    }

    public String getWatermark() {
        return watermark;
    }

    public void setWatermark(String watermark) {
        this.watermark = watermark;
    }

    public String getObjectRefId() {
        return objectRefId;
    }

    public void setObjectRefId(String objectRefId) {
        this.objectRefId = objectRefId;
    }

    public Instant getRecheckedAt() {
        return recheckedAt;
    }

    public void setRecheckedAt(Instant recheckedAt) {
        this.recheckedAt = recheckedAt;
    }

    public String getRecheckedBy() {
        return recheckedBy;
    }

    public void setRecheckedBy(String recheckedBy) {
        this.recheckedBy = recheckedBy;
    }
}
