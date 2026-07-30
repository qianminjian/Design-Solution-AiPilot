package com.platform.core.governance.evidence.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;
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
 * 治理域证据包实体（D37.17 Audit/Evidence 证据包）
 *
 * 表：governance.evidence_package
 * 证据项通过 EvidenceItem.packageId 关联（独立表存储）。
 */
@Entity
@Table(name = "evidence_package", schema = "governance")
public class EvidencePackage extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private GovernanceEvidencePackageStatus status;

    /** 关联对象 ID（如项目/版本/发布物 ID） */
    @Column(name = "object_id", nullable = false, length = 200)
    private String objectId;

    /** 关联对象类型（如 project / release / data_asset） */
    @Column(name = "object_type", nullable = false, length = 100)
    private String objectType;

    /** 封存人（签章人） */
    @Column(name = "sealed_by", length = 200)
    private String sealedBy;

    /** 封存时间 */
    @Column(name = "sealed_at")
    private Instant sealedAt;

    /** 验证人 */
    @Column(name = "verified_by", length = 200)
    private String verifiedBy;

    /** 验证时间 */
    @Column(name = "verified_at")
    private Instant verifiedAt;

    /** 整体哈希（所有 items 哈希的聚合） */
    @Column(name = "hash", nullable = false, length = 128)
    private String hash;

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

    public GovernanceEvidencePackageStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceEvidencePackageStatus status) {
        this.status = status;
    }

    public String getObjectId() {
        return objectId;
    }

    public void setObjectId(String objectId) {
        this.objectId = objectId;
    }

    public String getObjectType() {
        return objectType;
    }

    public void setObjectType(String objectType) {
        this.objectType = objectType;
    }

    public String getSealedBy() {
        return sealedBy;
    }

    public void setSealedBy(String sealedBy) {
        this.sealedBy = sealedBy;
    }

    public Instant getSealedAt() {
        return sealedAt;
    }

    public void setSealedAt(Instant sealedAt) {
        this.sealedAt = sealedAt;
    }

    public String getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(String verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }
}
