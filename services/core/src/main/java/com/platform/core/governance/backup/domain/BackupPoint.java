package com.platform.core.governance.backup.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.governance.domain.enums.GovernanceBackupType;
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
 * 治理域备份点实体（D37.17 Backup/Restore）
 *
 * 表：governance.backup_point
 */
@Entity
@Table(name = "backup_point", schema = "governance")
public class BackupPoint extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private GovernanceBackupType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 32)
    private GovernanceBackupScope scope;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** 耗时（秒） */
    @Column(name = "duration_sec")
    private Integer durationSec;

    /** 备份大小（字节） */
    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /** 备份对象数量 */
    @Column(name = "object_count", nullable = false)
    private int objectCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private GovernanceBackupStatus status;

    /** 实际 RPO（分钟） */
    @Column(name = "actual_rpo_min", nullable = false)
    private int actualRpoMin;

    @Column(name = "storage_location", nullable = false, length = 500)
    private String storageLocation;

    /** 备份内容哈希 */
    @Column(name = "hash", nullable = false, length = 128)
    private String hash;

    /** 触发人 */
    @Column(name = "triggered_by", nullable = false, length = 200)
    private String triggeredBy;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public GovernanceBackupType getType() {
        return type;
    }

    public void setType(GovernanceBackupType type) {
        this.type = type;
    }

    public GovernanceBackupScope getScope() {
        return scope;
    }

    public void setScope(GovernanceBackupScope scope) {
        this.scope = scope;
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

    public Integer getDurationSec() {
        return durationSec;
    }

    public void setDurationSec(Integer durationSec) {
        this.durationSec = durationSec;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public int getObjectCount() {
        return objectCount;
    }

    public void setObjectCount(int objectCount) {
        this.objectCount = objectCount;
    }

    public GovernanceBackupStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceBackupStatus status) {
        this.status = status;
    }

    public int getActualRpoMin() {
        return actualRpoMin;
    }

    public void setActualRpoMin(int actualRpoMin) {
        this.actualRpoMin = actualRpoMin;
    }

    public String getStorageLocation() {
        return storageLocation;
    }

    public void setStorageLocation(String storageLocation) {
        this.storageLocation = storageLocation;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getTriggeredBy() {
        return triggeredBy;
    }

    public void setTriggeredBy(String triggeredBy) {
        this.triggeredBy = triggeredBy;
    }
}
