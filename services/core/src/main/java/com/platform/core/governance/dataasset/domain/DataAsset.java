package com.platform.core.governance.dataasset.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
import com.platform.core.governance.domain.enums.GovernanceDataAssetType;
import com.platform.core.governance.domain.enums.GovernanceDataClassification;
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
 * 治理域数据资产实体（D37.17 Data Governance）
 *
 * 表：governance.data_asset
 */
@Entity
@Table(name = "data_asset", schema = "governance")
public class DataAsset extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private GovernanceDataAssetType type;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** 业务域（如 portfolio/design/compliance/ai） */
    @Column(name = "domain", nullable = false, length = 100)
    private String domain;

    @Column(name = "owner", nullable = false, length = 200)
    private String owner;

    @Column(name = "owner_email", nullable = false, length = 320)
    private String ownerEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false, length = 8)
    private GovernanceDataClassification classification;

    @Embedded
    private RetentionPolicy retention;

    /** 质量评分 0-1 */
    @Column(name = "quality_score", nullable = false)
    private double qualityScore;

    /** 质量问题数量 */
    @Column(name = "quality_issues", nullable = false)
    private int qualityIssues;

    /** 血缘覆盖率 0-1 */
    @Column(name = "lineage_coverage", nullable = false)
    private double lineageCoverage;

    /** 存储位置（JSON 数组） */
    @Column(name = "storage_locations", nullable = false, columnDefinition = "jsonb")
    private String storageLocations = "[]";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private GovernanceDataAssetStatus status;

    /** 最近一次修改时间（业务字段，非 auditing 字段） */
    @Column(name = "last_modified", nullable = false)
    private Instant lastModified;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public GovernanceDataAssetType getType() {
        return type;
    }

    public void setType(GovernanceDataAssetType type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public GovernanceDataClassification getClassification() {
        return classification;
    }

    public void setClassification(GovernanceDataClassification classification) {
        this.classification = classification;
    }

    public RetentionPolicy getRetention() {
        return retention;
    }

    public void setRetention(RetentionPolicy retention) {
        this.retention = retention;
    }

    public double getQualityScore() {
        return qualityScore;
    }

    public void setQualityScore(double qualityScore) {
        this.qualityScore = qualityScore;
    }

    public int getQualityIssues() {
        return qualityIssues;
    }

    public void setQualityIssues(int qualityIssues) {
        this.qualityIssues = qualityIssues;
    }

    public double getLineageCoverage() {
        return lineageCoverage;
    }

    public void setLineageCoverage(double lineageCoverage) {
        this.lineageCoverage = lineageCoverage;
    }

    public String getStorageLocations() {
        return storageLocations;
    }

    public void setStorageLocations(String storageLocations) {
        this.storageLocations = storageLocations;
    }

    public GovernanceDataAssetStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceDataAssetStatus status) {
        this.status = status;
    }

    public Instant getLastModified() {
        return lastModified;
    }

    public void setLastModified(Instant lastModified) {
        this.lastModified = lastModified;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
