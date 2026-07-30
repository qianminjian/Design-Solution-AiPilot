package com.platform.core.governance.evidence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域证据项实体
 *
 * 证据包中的单个证据项，对应一个具体的源文件或记录快照。
 * 与 BFF zod governanceEvidenceItemSchema 对齐。
 */
@Entity
@Table(name = "evidence_item", schema = "governance")
public class EvidenceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属证据包 ID */
    @Column(name = "package_id", nullable = false)
    private UUID packageId;

    /** 来源（如 S3 key / 数据库表 / URL） */
    @Column(name = "source", nullable = false, length = 500)
    private String source;

    /** 版本号（可选） */
    @Column(name = "revision", length = 64)
    private String revision;

    /** 工具链（生成该证据的工具，如 Revit 2024） */
    @Column(name = "toolchain", length = 200)
    private String toolchain;

    /** 哈希（SHA-256，用于完整性校验） */
    @Column(name = "hash", nullable = false, length = 128)
    private String hash;

    /** 采集时间 */
    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPackageId() {
        return packageId;
    }

    public void setPackageId(UUID packageId) {
        this.packageId = packageId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getRevision() {
        return revision;
    }

    public void setRevision(String revision) {
        this.revision = revision;
    }

    public String getToolchain() {
        return toolchain;
    }

    public void setToolchain(String toolchain) {
        this.toolchain = toolchain;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public Instant getCapturedAt() {
        return capturedAt;
    }

    public void setCapturedAt(Instant capturedAt) {
        this.capturedAt = capturedAt;
    }
}
