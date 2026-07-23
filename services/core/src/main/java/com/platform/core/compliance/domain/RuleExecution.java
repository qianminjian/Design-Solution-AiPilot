package com.platform.core.compliance.domain;

import com.platform.core.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;



import java.util.UUID;

@Entity
@Table(name = "rule_executions", schema = "compliance")
public class RuleExecution extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "revision_id", nullable = false)
    private UUID revisionId;

    @Column(name = "applicability_count", nullable = false)
    private Long applicabilityCount = 0L;

    @Column(name = "pass_count", nullable = false)
    private Long passCount = 0L;

    @Column(name = "fail_count", nullable = false)
    private Long failCount = 0L;

    @Column(name = "not_applicable_count", nullable = false)
    private Long notApplicableCount = 0L;

    @Column(name = "indeterminate_count", nullable = false)
    private Long indeterminateCount = 0L;

    @Column(name = "error_count", nullable = false)
    private Long errorCount = 0L;

    @Column(name = "manual_review_count", nullable = false)
    private Long manualReviewCount = 0L;

    @Column(name = "status", nullable = false)
    private String status = "PENDING";

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "logs", columnDefinition = "text")
    private String logs;

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

    public UUID getRunId() {
        return runId;
    }

    public void setRunId(UUID runId) {
        this.runId = runId;
    }

    public UUID getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(UUID revisionId) {
        this.revisionId = revisionId;
    }

    public Long getApplicabilityCount() {
        return applicabilityCount;
    }

    public void setApplicabilityCount(Long applicabilityCount) {
        this.applicabilityCount = applicabilityCount;
    }

    public Long getPassCount() {
        return passCount;
    }

    public void setPassCount(Long passCount) {
        this.passCount = passCount;
    }

    public Long getFailCount() {
        return failCount;
    }

    public void setFailCount(Long failCount) {
        this.failCount = failCount;
    }

    public Long getNotApplicableCount() {
        return notApplicableCount;
    }

    public void setNotApplicableCount(Long notApplicableCount) {
        this.notApplicableCount = notApplicableCount;
    }

    public Long getIndeterminateCount() {
        return indeterminateCount;
    }

    public void setIndeterminateCount(Long indeterminateCount) {
        this.indeterminateCount = indeterminateCount;
    }

    public Long getErrorCount() {
        return errorCount;
    }

    public void setErrorCount(Long errorCount) {
        this.errorCount = errorCount;
    }

    public Long getManualReviewCount() {
        return manualReviewCount;
    }

    public void setManualReviewCount(Long manualReviewCount) {
        this.manualReviewCount = manualReviewCount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public String getLogs() {
        return logs;
    }

    public void setLogs(String logs) {
        this.logs = logs;
    }
}