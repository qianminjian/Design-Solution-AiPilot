package com.platform.core.tevv.domain;

/**
 * 金样数据集状态
 */
public enum DatasetStatus {
    /** 草稿：可编辑 */
    DRAFT,
    /** 冻结：不可修改，可用于验证 */
    FROZEN,
    /** 废弃：已过时 */
    DEPRECATED
}
