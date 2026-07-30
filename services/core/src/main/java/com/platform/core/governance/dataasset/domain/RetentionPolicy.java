package com.platform.core.governance.dataasset.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.time.Instant;

/**
 * 数据资产保留策略嵌入对象
 *
 * 与 BFF zod governanceRetentionPolicySchema 对齐。
 */
@Embeddable
public class RetentionPolicy {

    /** 保留年限（必须为正） */
    @Column(name = "retention_years", nullable = false)
    private int years;

    /** 是否处于法律保留 */
    @Column(name = "retention_legal_hold", nullable = false)
    private boolean legalHold;

    /** 处置日期（到期后可删除） */
    @Column(name = "retention_disposal_date", nullable = false)
    private Instant disposalDate;

    public RetentionPolicy() {
    }

    public RetentionPolicy(int years, boolean legalHold, Instant disposalDate) {
        this.years = years;
        this.legalHold = legalHold;
        this.disposalDate = disposalDate;
    }

    public int getYears() {
        return years;
    }

    public void setYears(int years) {
        this.years = years;
    }

    public boolean isLegalHold() {
        return legalHold;
    }

    public void setLegalHold(boolean legalHold) {
        this.legalHold = legalHold;
    }

    public Instant getDisposalDate() {
        return disposalDate;
    }

    public void setDisposalDate(Instant disposalDate) {
        this.disposalDate = disposalDate;
    }
}
