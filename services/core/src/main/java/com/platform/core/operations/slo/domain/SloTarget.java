package com.platform.core.operations.slo.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.operations.domain.enums.SloStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * SLO 目标实体（D37.17 运营中心）
 *
 * 字段对齐前端 SloTargetDto 契约：
 *  - availabilityTarget/availabilityCurrent: 0-1 之间（如 0.999 表示 99.9%）
 *  - errorBudgetRemaining: 错误预算剩余（百分比，可为负）
 *  - requestCount24h/errorCount24h: 最近 24h 统计
 *  - p95LatencyMs/p99LatencyMs: 延迟分位
 *  - status: HEALTHY/WARNING/CRITICAL
 *
 * 表：operations.slo_target
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D42-SLO-容量.md
 */
@Entity(name = "SloTarget")
@Table(name = "slo_target", schema = "operations")
public class SloTarget extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** SLO 名称（如 "API 可用率"、"AI 生成延迟"） */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** 目标可用率（0-1，如 0.999 表示 99.9%） */
    @Column(name = "availability_target", nullable = false, precision = 5, scale = 4)
    private BigDecimal availabilityTarget;

    /** 当前可用率（0-1，滚动窗口计算） */
    @Column(name = "availability_current", nullable = false, precision = 5, scale = 4)
    private BigDecimal availabilityCurrent;

    /** 错误预算剩余（百分比，可为负表示已突破） */
    @Column(name = "error_budget_remaining", nullable = false, precision = 8, scale = 4)
    private BigDecimal errorBudgetRemaining;

    /** 最近 24h 请求数 */
    @Column(name = "request_count_24h", nullable = false)
    private long requestCount24h;

    /** 最近 24h 错误数 */
    @Column(name = "error_count_24h", nullable = false)
    private long errorCount24h;

    /** p95 延迟 ms */
    @Column(name = "p95_latency_ms", nullable = false)
    private int p95LatencyMs;

    /** p99 延迟 ms */
    @Column(name = "p99_latency_ms", nullable = false)
    private int p99LatencyMs;

    /** 健康状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private SloStatus status;

    /** 服务名称（关联的后端服务） */
    @Column(name = "service_name", length = 200)
    private String serviceName;

    /** SLO 计算窗口（默认 28 天） */
    @Column(name = "window_days", nullable = false)
    private int windowDays = 28;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getAvailabilityTarget() {
        return availabilityTarget;
    }

    public void setAvailabilityTarget(BigDecimal availabilityTarget) {
        this.availabilityTarget = availabilityTarget;
    }

    public BigDecimal getAvailabilityCurrent() {
        return availabilityCurrent;
    }

    public void setAvailabilityCurrent(BigDecimal availabilityCurrent) {
        this.availabilityCurrent = availabilityCurrent;
    }

    public BigDecimal getErrorBudgetRemaining() {
        return errorBudgetRemaining;
    }

    public void setErrorBudgetRemaining(BigDecimal errorBudgetRemaining) {
        this.errorBudgetRemaining = errorBudgetRemaining;
    }

    public long getRequestCount24h() {
        return requestCount24h;
    }

    public void setRequestCount24h(long requestCount24h) {
        this.requestCount24h = requestCount24h;
    }

    public long getErrorCount24h() {
        return errorCount24h;
    }

    public void setErrorCount24h(long errorCount24h) {
        this.errorCount24h = errorCount24h;
    }

    public int getP95LatencyMs() {
        return p95LatencyMs;
    }

    public void setP95LatencyMs(int p95LatencyMs) {
        this.p95LatencyMs = p95LatencyMs;
    }

    public int getP99LatencyMs() {
        return p99LatencyMs;
    }

    public void setP99LatencyMs(int p99LatencyMs) {
        this.p99LatencyMs = p99LatencyMs;
    }

    public SloStatus getStatus() {
        return status;
    }

    public void setStatus(SloStatus status) {
        this.status = status;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public int getWindowDays() {
        return windowDays;
    }

    public void setWindowDays(int windowDays) {
        this.windowDays = windowDays;
    }
}
