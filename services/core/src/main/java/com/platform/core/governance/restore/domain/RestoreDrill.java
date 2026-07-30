package com.platform.core.governance.restore.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;
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
 * 治理域灾备演练实体（D37.17 灾备演练）
 *
 * 表：governance.restore_drill
 */
@Entity
@Table(name = "restore_drill", schema = "governance")
public class RestoreDrill extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "backup_id", nullable = false)
    private UUID backupId;

    /** 恢复目标：ISOLATED_ENV / PRODUCTION */
    @Column(name = "target", nullable = false, length = 32)
    private String target;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private GovernanceRestoreDrillStatus status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** 实际 RTO（分钟） */
    @Column(name = "actual_rto_min")
    private Integer actualRtoMin;

    /** 实际 RPO（分钟） */
    @Column(name = "actual_rpo_min")
    private Integer actualRpoMin;

    /** 验证人 */
    @Column(name = "verifier", nullable = false, length = 200)
    private String verifier;

    /** 报告 URL（完成后写入） */
    @Column(name = "report_url", length = 500)
    private String reportUrl;

    /** 是否通过 */
    @Column(name = "passed")
    private Boolean passed;

    /** 备注 */
    @Column(name = "notes", length = 2000)
    private String notes;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getBackupId() {
        return backupId;
    }

    public void setBackupId(UUID backupId) {
        this.backupId = backupId;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public GovernanceRestoreDrillStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceRestoreDrillStatus status) {
        this.status = status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Integer getActualRtoMin() {
        return actualRtoMin;
    }

    public void setActualRtoMin(Integer actualRtoMin) {
        this.actualRtoMin = actualRtoMin;
    }

    public Integer getActualRpoMin() {
        return actualRpoMin;
    }

    public void setActualRpoMin(Integer actualRpoMin) {
        this.actualRpoMin = actualRpoMin;
    }

    public String getVerifier() {
        return verifier;
    }

    public void setVerifier(String verifier) {
        this.verifier = verifier;
    }

    public String getReportUrl() {
        return reportUrl;
    }

    public void setReportUrl(String reportUrl) {
        this.reportUrl = reportUrl;
    }

    public Boolean getPassed() {
        return passed;
    }

    public void setPassed(Boolean passed) {
        this.passed = passed;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
