package com.platform.core.analysis.solver.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * 求解器配置实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 用于展示可用的求解器配置列表，供场景选择。
 * V0 阶段由 Flyway 种子数据初始化，前端只读。
 *
 * 表：analysis.solver_profile
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "SolverProfile")
@Table(name = "solver_profile", schema = "analysis")
public class SolverProfile extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 业务编号 */
    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    /** 求解器名称 */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** 求解器类型 */
    @Column(name = "solver_type", nullable = false, length = 32)
    private String solverType;

    /** 求解器版本 */
    @Column(name = "version", nullable = false, length = 64)
    private String version;

    /** 描述 */
    @Column(name = "description", length = 2000)
    private String description;

    /** 最大并发运行数（D42 容量约束） */
    @Column(name = "max_concurrent_runs", nullable = false)
    private int maxConcurrentRuns = 1;

    /** 最大运行时长（秒） */
    @Column(name = "max_duration_sec", nullable = false)
    private int maxDurationSec = 3600;

    /** 许可证池（描述剩余配额） */
    @Column(name = "license_pool", length = 500)
    private String licensePool;

    /** 是否内置求解器（外部 Provider 需 ManualHandoff） */
    @Column(name = "is_internal", nullable = false)
    private boolean internal = true;

    /** 运行 Region（Hybrid-Site 数据驻留约束） */
    @Column(name = "region", length = 64)
    private String region;

    /** 求解器配置（JSON：精度/迭代上限/并行度等） */
    @Column(name = "config", columnDefinition = "jsonb")
    private String config = "{}";

    /** 支持的问题类型（JSON 数组） */
    @Column(name = "supported_problem_types", columnDefinition = "jsonb")
    private String supportedProblemTypes = "[]";

    /** 是否激活 */
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public String getSolverType() {
        return solverType;
    }

    public void setSolverType(String solverType) {
        this.solverType = solverType;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getMaxConcurrentRuns() {
        return maxConcurrentRuns;
    }

    public void setMaxConcurrentRuns(int maxConcurrentRuns) {
        this.maxConcurrentRuns = maxConcurrentRuns;
    }

    public int getMaxDurationSec() {
        return maxDurationSec;
    }

    public void setMaxDurationSec(int maxDurationSec) {
        this.maxDurationSec = maxDurationSec;
    }

    public String getLicensePool() {
        return licensePool;
    }

    public void setLicensePool(String licensePool) {
        this.licensePool = licensePool;
    }

    public boolean isInternal() {
        return internal;
    }

    public void setInternal(boolean internal) {
        this.internal = internal;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getConfig() {
        return config;
    }

    public void setConfig(String config) {
        this.config = config;
    }

    public String getSupportedProblemTypes() {
        return supportedProblemTypes;
    }

    public void setSupportedProblemTypes(String supportedProblemTypes) {
        this.supportedProblemTypes = supportedProblemTypes;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
