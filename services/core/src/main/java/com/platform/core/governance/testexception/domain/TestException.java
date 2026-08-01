package com.platform.core.governance.testexception.domain;

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
 * 测试例外实体（D45.22 例外治理 / D45.25 TestException API，SIT P0-13.3）
 *
 * 字段对齐路线图：
 *  scope/reason/risk/compensation/approvers/expiry/retest trigger/residual risk
 *
 * 验收：
 *  - 例外有签署（approvers 非空 + 状态流转需审批）
 *  - Conditional Pass 到期自动撤销（expiry < now 且 ACTIVE → EXPIRED）
 *  - 版本升级不自动继承（versionTarget 绑定，新版本需重新申请）
 */
@Entity
@Table(name = "test_exception", schema = "governance")
public class TestException extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 状态：PENDING_REVIEW/ACTIVE/EXPIRED/REVOKED/CLOSED */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private TestExceptionStatus status = TestExceptionStatus.PENDING_REVIEW;

    /** 适用范围（D45.22 scope，如 requirementId/testCaseId/releaseId） */
    @Column(name = "scope", nullable = false, length = 500)
    private String scope;

    /** 例外理由（D45.22 reason，脱敏不含敏感内容） */
    @Column(name = "reason", nullable = false, length = 2000)
    private String reason;

    /** 风险等级（D45.22 risk：LOW/MEDIUM/HIGH/CRITICAL） */
    @Column(name = "risk", nullable = false, length = 16)
    private String risk;

    /** 补偿控制（D45.22 compensation，缓解措施） */
    @Column(name = "compensation", nullable = false, length = 2000)
    private String compensation;

    /** 签署人列表（JSON 数组：{principalId, signedAt, comment}[]） */
    @Column(name = "approvers", nullable = false, columnDefinition = "jsonb")
    private String approvers;

    /** 到期时间（D45.22 expiry，到期自动撤销） */
    @Column(name = "expiry", nullable = false)
    private Instant expiry;

    /** 复测触发条件（D45.22 retest trigger） */
    @Column(name = "retest_trigger", length = 1000)
    private String retestTrigger;

    /** 残余风险（D45.22 residual risk） */
    @Column(name = "residual_risk", length = 2000)
    private String residualRisk;

    /** 绑定版本/Release（版本升级不自动继承，新版本需重新申请） */
    @Column(name = "version_target", length = 200)
    private String versionTarget;

    /** 关联测试运行 ID（对齐 P0-1.2 testRunId 标记机制） */
    @Column(name = "test_run_id", length = 64)
    private String testRunId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public TestExceptionStatus getStatus() {
        return status;
    }

    public void setStatus(TestExceptionStatus status) {
        this.status = status;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getRisk() {
        return risk;
    }

    public void setRisk(String risk) {
        this.risk = risk;
    }

    public String getCompensation() {
        return compensation;
    }

    public void setCompensation(String compensation) {
        this.compensation = compensation;
    }

    public String getApprovers() {
        return approvers;
    }

    public void setApprovers(String approvers) {
        this.approvers = approvers;
    }

    public Instant getExpiry() {
        return expiry;
    }

    public void setExpiry(Instant expiry) {
        this.expiry = expiry;
    }

    public String getRetestTrigger() {
        return retestTrigger;
    }

    public void setRetestTrigger(String retestTrigger) {
        this.retestTrigger = retestTrigger;
    }

    public String getResidualRisk() {
        return residualRisk;
    }

    public void setResidualRisk(String residualRisk) {
        this.residualRisk = residualRisk;
    }

    public String getVersionTarget() {
        return versionTarget;
    }

    public void setVersionTarget(String versionTarget) {
        this.versionTarget = versionTarget;
    }

    public String getTestRunId() {
        return testRunId;
    }

    public void setTestRunId(String testRunId) {
        this.testRunId = testRunId;
    }
}
