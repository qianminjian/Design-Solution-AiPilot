package com.platform.core.cde.domain;

/**
 * 文档状态常量（对齐 cde.contract.ts §DocumentStatus）
 *
 * <p>状态机：
 * <pre>
 *   DRAFT ──checkout──→ CHECKED_OUT ──checkin──→ PUBLISHED
 *                                                  │
 *                                                  ↓
 *                                              SUPERSEDED
 *                                                  │
 *                                                  ↓
 *                                              ARCHIVED
 * </pre>
 *
 * <p>禁止使用魔术字符串，所有状态引用须通过本常量类
 */
public final class DocumentStatus {

    private DocumentStatus() {
    }

    /** 草稿（新建或已检入） */
    public static final String DRAFT = "DRAFT";
    /** 已检出（编辑中，独占锁） */
    public static final String CHECKED_OUT = "CHECKED_OUT";
    /** 已发布（最终版本） */
    public static final String PUBLISHED = "PUBLISHED";
    /** 已被新版本替代 */
    public static final String SUPERSEDED = "SUPERSEDED";
    /** 已归档（不可再编辑） */
    public static final String ARCHIVED = "ARCHIVED";
}
