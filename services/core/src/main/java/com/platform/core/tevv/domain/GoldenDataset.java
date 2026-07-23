package com.platform.core.tevv.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * 金样数据集实体 — 存储 TEVV 验证数据集的元数据
 */
@Entity
@Table(name = "golden_dataset")
public class GoldenDataset extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private DatasetCategory category;

    @Column(nullable = false, length = 50)
    private String buildingType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DatasetStatus status = DatasetStatus.DRAFT;

    @Column(nullable = false, length = 20)
    private String version = "1.0.0";

    @Column(nullable = false, length = 500)
    private String storageKey;

    @Column(nullable = false)
    private Integer fileCount = 0;

    @Column(nullable = false)
    private Long totalSizeBytes = 0L;

    @Column
    private Instant frozenAt;

    @Column
    private UUID frozenBy;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public DatasetCategory getCategory() { return category; }
    public void setCategory(DatasetCategory category) { this.category = category; }
    public String getBuildingType() { return buildingType; }
    public void setBuildingType(String buildingType) { this.buildingType = buildingType; }
    public DatasetStatus getStatus() { return status; }
    public void setStatus(DatasetStatus status) { this.status = status; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public Integer getFileCount() { return fileCount; }
    public void setFileCount(Integer fileCount) { this.fileCount = fileCount; }
    public Long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(Long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }
    public Instant getFrozenAt() { return frozenAt; }
    public void setFrozenAt(Instant frozenAt) { this.frozenAt = frozenAt; }
    public UUID getFrozenBy() { return frozenBy; }
    public void setFrozenBy(UUID frozenBy) { this.frozenBy = frozenBy; }
}
