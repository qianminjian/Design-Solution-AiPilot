package com.platform.core.operations.connector.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
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
 * 连接器状态实体（D37.17 运营中心）
 *
 * <p>字段对齐前端 ConnectorStatusDto 契约：
 * <ul>
 *   <li>type/status: 连接器类型与健康状态
 *   <li>callCount1h/errorCount1h/avgLatencyMs: 1h 滚动指标
 *   <li>licenseRemaining: 许可证剩余描述
 *   <li>isManualHandoff: 是否为 ManualHandoff（OD-05 外部 AI V1 约束，建筑 AI Provider 强制 true）
 *   <li>region: 连接器所在 Region（Hybrid-Site 部署）
 *   <li>lastHealthCheckAt: 最近健康检查时间
 * </ul>
 *
 * <p>表：operations.connector_status
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D29-可观测性-合规性-指标.md（RED / USE 指标）
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@Entity(name = "ConnectorStatus")
@Table(name = "connector_status", schema = "operations")
public class ConnectorStatus extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 连接器业务编号（如 "deepseek-llm-001"） */
    @Column(name = "connector_code", nullable = false, length = 128)
    private String connectorCode;

    /** 连接器名称 */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** 连接器类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private ConnectorType type;

    /** 健康状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ConnectorHealthStatus status;

    /** 最近 1h 调用数 */
    @Column(name = "call_count_1h", nullable = false)
    private long callCount1h;

    /** 最近 1h 错误数 */
    @Column(name = "error_count_1h", nullable = false)
    private long errorCount1h;

    /** 最近 1h 平均延迟 ms */
    @Column(name = "avg_latency_ms", nullable = false)
    private int avgLatencyMs;

    /** 许可证剩余描述（如 "30 days" / "5000 calls"） */
    @Column(name = "license_remaining", length = 200)
    private String licenseRemaining;

    /** 最近使用时间 */
    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt;

    /** 最近健康检查时间 */
    @Column(name = "last_health_check_at")
    private Instant lastHealthCheckAt;

    /** 是否为 ManualHandoff（OD-05 外部 AI V1 约束，建筑 AI Provider 强制 true） */
    @Column(name = "is_manual_handoff", nullable = false)
    private boolean manualHandoff;

    /** 端点 URL（PII: L3 业务敏感数据） */
    @Column(name = "endpoint_url", length = 500)
    private String endpointUrl;

    /** 连接器所在 Region（Hybrid-Site 部署） */
    @Column(name = "region", length = 64)
    private String region;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getConnectorCode() {
        return connectorCode;
    }

    public void setConnectorCode(String connectorCode) {
        this.connectorCode = connectorCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ConnectorType getType() {
        return type;
    }

    public void setType(ConnectorType type) {
        this.type = type;
    }

    public ConnectorHealthStatus getStatus() {
        return status;
    }

    public void setStatus(ConnectorHealthStatus status) {
        this.status = status;
    }

    public long getCallCount1h() {
        return callCount1h;
    }

    public void setCallCount1h(long callCount1h) {
        this.callCount1h = callCount1h;
    }

    public long getErrorCount1h() {
        return errorCount1h;
    }

    public void setErrorCount1h(long errorCount1h) {
        this.errorCount1h = errorCount1h;
    }

    public int getAvgLatencyMs() {
        return avgLatencyMs;
    }

    public void setAvgLatencyMs(int avgLatencyMs) {
        this.avgLatencyMs = avgLatencyMs;
    }

    public String getLicenseRemaining() {
        return licenseRemaining;
    }

    public void setLicenseRemaining(String licenseRemaining) {
        this.licenseRemaining = licenseRemaining;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Instant lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public Instant getLastHealthCheckAt() {
        return lastHealthCheckAt;
    }

    public void setLastHealthCheckAt(Instant lastHealthCheckAt) {
        this.lastHealthCheckAt = lastHealthCheckAt;
    }

    public boolean isManualHandoff() {
        return manualHandoff;
    }

    public void setManualHandoff(boolean manualHandoff) {
        this.manualHandoff = manualHandoff;
    }

    public String getEndpointUrl() {
        return endpointUrl;
    }

    public void setEndpointUrl(String endpointUrl) {
        this.endpointUrl = endpointUrl;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }
}
