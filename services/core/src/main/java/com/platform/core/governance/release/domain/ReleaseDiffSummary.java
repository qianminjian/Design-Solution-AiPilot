package com.platform.core.governance.release.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Release Diff Summary 嵌入对象
 *
 * 表示当前版本相对于前一版本的差异统计。
 * 与 BFF zod governanceReleaseDiffSummarySchema 对齐。
 */
@Embeddable
public class ReleaseDiffSummary {

    @Column(name = "diff_added", nullable = false)
    private int added;

    @Column(name = "diff_modified", nullable = false)
    private int modified;

    @Column(name = "diff_removed", nullable = false)
    private int removed;

    public ReleaseDiffSummary() {
    }

    public ReleaseDiffSummary(int added, int modified, int removed) {
        this.added = added;
        this.modified = modified;
        this.removed = removed;
    }

    public int getAdded() {
        return added;
    }

    public void setAdded(int added) {
        this.added = added;
    }

    public int getModified() {
        return modified;
    }

    public void setModified(int modified) {
        this.modified = modified;
    }

    public int getRemoved() {
        return removed;
    }

    public void setRemoved(int removed) {
        this.removed = removed;
    }
}
