package com.platform.core.governance.release.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceMetricsDrift;
import com.platform.core.governance.domain.enums.GovernanceRedteamStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseType;
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
 * 治理域 Release 实体（D37.17 AI/Rule Release）
 *
 * 用于管理 LLM/规则集/AI Provider 的发布生命周期。
 * 表：governance.release
 */
@Entity
@Table(name = "releases", schema = "governance")
public class Release extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private GovernanceReleaseType type;

    @Column(name = "version", nullable = false, length = 64)
    private String version;

    /** 前一版本号（用于 diff 对比） */
    @Column(name = "previous_version", length = 64)
    private String previousVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private GovernanceReleaseStatus status;

    /** Release Manager（负责人） */
    @Column(name = "release_manager", nullable = false, length = 200)
    private String releaseManager;

    /** 全量发布时间（promote 后写入） */
    @Column(name = "promoted_at")
    private Instant promotedAt;

    /** 评估得分 0-1 */
    @Column(name = "eval_score", nullable = false)
    private double evalScore;

    /** 评估切片数 */
    @Column(name = "eval_slices", nullable = false)
    private int evalSlices;

    @Enumerated(EnumType.STRING)
    @Column(name = "redteam_status", nullable = false, length = 16)
    private GovernanceRedteamStatus redteamStatus;

    /** 当前消费者数量 */
    @Column(name = "consumer_count", nullable = false)
    private int consumerCount;

    /** 灰度流量百分比 0-100 */
    @Column(name = "canary_percent", nullable = false)
    private int canaryPercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "metrics_drift", nullable = false, length = 16)
    private GovernanceMetricsDrift metricsDrift;

    /** 是否存在评估覆盖缺口（hasEvalGap=true 禁止 promote） */
    @Column(name = "has_eval_gap", nullable = false)
    private boolean hasEvalGap;

    /** 是否存在旧版本消费者未迁移 */
    @Column(name = "has_old_consumer", nullable = false)
    private boolean hasOldConsumer;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    @Embedded
    private ReleaseDiffSummary diffSummary;

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

    public GovernanceReleaseType getType() {
        return type;
    }

    public void setType(GovernanceReleaseType type) {
        this.type = type;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getPreviousVersion() {
        return previousVersion;
    }

    public void setPreviousVersion(String previousVersion) {
        this.previousVersion = previousVersion;
    }

    public GovernanceReleaseStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceReleaseStatus status) {
        this.status = status;
    }

    public String getReleaseManager() {
        return releaseManager;
    }

    public void setReleaseManager(String releaseManager) {
        this.releaseManager = releaseManager;
    }

    public Instant getPromotedAt() {
        return promotedAt;
    }

    public void setPromotedAt(Instant promotedAt) {
        this.promotedAt = promotedAt;
    }

    public double getEvalScore() {
        return evalScore;
    }

    public void setEvalScore(double evalScore) {
        this.evalScore = evalScore;
    }

    public int getEvalSlices() {
        return evalSlices;
    }

    public void setEvalSlices(int evalSlices) {
        this.evalSlices = evalSlices;
    }

    public GovernanceRedteamStatus getRedteamStatus() {
        return redteamStatus;
    }

    public void setRedteamStatus(GovernanceRedteamStatus redteamStatus) {
        this.redteamStatus = redteamStatus;
    }

    public int getConsumerCount() {
        return consumerCount;
    }

    public void setConsumerCount(int consumerCount) {
        this.consumerCount = consumerCount;
    }

    public int getCanaryPercent() {
        return canaryPercent;
    }

    public void setCanaryPercent(int canaryPercent) {
        this.canaryPercent = canaryPercent;
    }

    public GovernanceMetricsDrift getMetricsDrift() {
        return metricsDrift;
    }

    public void setMetricsDrift(GovernanceMetricsDrift metricsDrift) {
        this.metricsDrift = metricsDrift;
    }

    public boolean isHasEvalGap() {
        return hasEvalGap;
    }

    public void setHasEvalGap(boolean hasEvalGap) {
        this.hasEvalGap = hasEvalGap;
    }

    public boolean isHasOldConsumer() {
        return hasOldConsumer;
    }

    public void setHasOldConsumer(boolean hasOldConsumer) {
        this.hasOldConsumer = hasOldConsumer;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ReleaseDiffSummary getDiffSummary() {
        return diffSummary;
    }

    public void setDiffSummary(ReleaseDiffSummary diffSummary) {
        this.diffSummary = diffSummary;
    }
}
