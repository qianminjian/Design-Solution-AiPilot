package com.platform.core.portfolio.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.iam.domain.DataClassification;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.Where;
import org.hibernate.id.uuid.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 项目实体（portfolio 聚合根）
 * 对应表 portfolio.project，见 V2__init_portfolio_requirement.sql §1.1
 *
 * <p>核心不变量：
 * <ul>
 *   <li>租户内 code 唯一（仅未软删）</li>
 *   <li>软删除：deleted_at IS NULL 过滤</li>
 * </ul>
 */
@Entity
@Table(name = "project", schema = "portfolio")
@Where(clause = "deleted_at IS NULL")
@GenericGenerator(name = "uuid_v7", type = UuidGenerator.class)
public class Project extends TenantBaseEntity {

    @Id
    @GeneratedValue(generator = "uuid_v7")
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属组织 ID（可空） */
    @Column(name = "organization_id")
    private UUID organizationId;

    /** 项目编码，租户内唯一 */
    @Column(name = "code", nullable = false)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    /** 项目状态：ACTIVE / ON_HOLD / COMPLETED / CANCELLED / ARCHIVED */
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    /** 建筑类型：OFFICE / RESIDENTIAL / COMMERCIAL / MIXED（OD-02 默认 OFFICE） */
    @Column(name = "building_type", nullable = false)
    private String buildingType = "OFFICE";

    /** 最小层数（OD-02：5 层下限） */
    @Column(name = "floors_min", nullable = false)
    private Integer floorsMin = 5;

    /** 最大层数（OD-02：15 层上限） */
    @Column(name = "floors_max", nullable = false)
    private Integer floorsMax = 15;

    /** 总建筑面积 GFA（m²，NUMERIC(20,4) 精度） */
    @Column(name = "gfa", precision = 20, scale = 4)
    private BigDecimal gfa;

    /** 占地面积（m²，NUMERIC(20,4) 精度） */
    @Column(name = "site_area", precision = 20, scale = 4)
    private BigDecimal siteArea;

    /** 数据驻留 Region（OD-01） */
    @Column(name = "region", nullable = false)
    private String region = "us-east-1";

    /** 项目语言（OD-01 默认 en） */
    @Column(name = "language", nullable = false)
    private String language = "en";

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    /** 设置 JSONB（以字符串存储，默认 {}） */
    @Column(name = "settings", nullable = false, columnDefinition = "jsonb")
    private String settings = "{}";

    /** 元数据 JSONB（以字符串存储，默认 {}） */
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata = "{}";

    /** 项目启动时间 */
    @Column(name = "started_at")
    private Instant startedAt;

    /** 目标完成时间 */
    @Column(name = "target_completion_at")
    private Instant targetCompletionAt;

    /** 软删除时间戳 */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** 软删除执行人 */
    @Column(name = "deleted_by")
    private UUID deletedBy;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getBuildingType() {
        return buildingType;
    }

    public void setBuildingType(String buildingType) {
        this.buildingType = buildingType;
    }

    public Integer getFloorsMin() {
        return floorsMin;
    }

    public void setFloorsMin(Integer floorsMin) {
        this.floorsMin = floorsMin;
    }

    public Integer getFloorsMax() {
        return floorsMax;
    }

    public void setFloorsMax(Integer floorsMax) {
        this.floorsMax = floorsMax;
    }

    public BigDecimal getGfa() {
        return gfa;
    }

    public void setGfa(BigDecimal gfa) {
        this.gfa = gfa;
    }

    public BigDecimal getSiteArea() {
        return siteArea;
    }

    public void setSiteArea(BigDecimal siteArea) {
        this.siteArea = siteArea;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public DataClassification getClassification() {
        return classification;
    }

    public void setClassification(DataClassification classification) {
        this.classification = classification;
    }

    public String getSettings() {
        return settings;
    }

    public void setSettings(String settings) {
        this.settings = settings;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getTargetCompletionAt() {
        return targetCompletionAt;
    }

    public void setTargetCompletionAt(Instant targetCompletionAt) {
        this.targetCompletionAt = targetCompletionAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public UUID getDeletedBy() {
        return deletedBy;
    }

    public void setDeletedBy(UUID deletedBy) {
        this.deletedBy = deletedBy;
    }
}
