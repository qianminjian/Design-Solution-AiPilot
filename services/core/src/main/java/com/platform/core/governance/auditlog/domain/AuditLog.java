package com.platform.core.governance.auditlog.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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
 * 治理域审计日志实体（D37.17 Audit/Evidence）
 *
 * 表：governance.audit_log
 *
 * 注意：审计日志不更新（只追加），row_version 仅用于乐观锁（实际不会变化）。
 */
@Entity
@Table(name = "audit_log", schema = "governance")
public class AuditLog extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 事件发生时间（业务字段，非 createdAt） */
    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    @Embedded
    private AuditActor actor;

    /** 操作名称（如 project.create / release.promote） */
    @Column(name = "action", nullable = false, length = 200)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 32)
    private GovernanceAuditCategory category;

    @Embedded
    private AuditObject object;

    /** 链路追踪 ID（用于关联跨服务调用） */
    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", nullable = false, length = 16)
    private GovernanceResult result;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 16)
    private GovernanceRiskLevel riskLevel;

    /** 是否脱敏（敏感字段已 mask 处理） */
    @Column(name = "masked", nullable = false)
    private boolean masked;

    @Column(name = "ip_address", nullable = false, length = 64)
    private String ipAddress;

    @Column(name = "user_agent", nullable = false, length = 500)
    private String userAgent;

    /** 详细信息（JSON 或结构化文本） */
    @Column(name = "details", nullable = false, length = 4000)
    private String details;

    /**
     * 测试运行 ID（P0-1.2 测试数据隔离）
     *
     * 用途：CI 流水线注入标识，标记测试产生的审计日志
     *  - null：未标记（生产或本地开发，SLO 报表包含）
     *  - "untracked"：未标记的本地开发数据（SLO 报表包含）
     *  - UUID 或 github-run_id-attempt 格式：真实测试运行（SLO 报表排除）
     *
     * 权威源：@design/D43-SLO-运营报表.md §测试数据排除规则
     */
    @Column(name = "test_run_id", length = 64)
    private String testRunId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public AuditActor getActor() {
        return actor;
    }

    public void setActor(AuditActor actor) {
        this.actor = actor;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public GovernanceAuditCategory getCategory() {
        return category;
    }

    public void setCategory(GovernanceAuditCategory category) {
        this.category = category;
    }

    public AuditObject getObject() {
        return object;
    }

    public void setObject(AuditObject object) {
        this.object = object;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public GovernanceResult getResult() {
        return result;
    }

    public void setResult(GovernanceResult result) {
        this.result = result;
    }

    public GovernanceRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(GovernanceRiskLevel riskLevel) {
        this.riskLevel = riskLevel;
    }

    public boolean isMasked() {
        return masked;
    }

    public void setMasked(boolean masked) {
        this.masked = masked;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getTestRunId() {
        return testRunId;
    }

    public void setTestRunId(String testRunId) {
        this.testRunId = testRunId;
    }
}
