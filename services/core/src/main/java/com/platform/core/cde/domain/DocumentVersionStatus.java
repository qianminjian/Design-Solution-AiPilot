package com.platform.core.cde.domain;

/**
 * 文档版本状态常量（对齐 cde.contract.ts §DocumentVersionStatus）
 *
 * <p>状态机：
 * <pre>
 *   DRAFT ──checkin/upload──→ PUBLISHED ──新版本上传──→ SUPERSEDED
 * </pre>
 */
public final class DocumentVersionStatus {

    private DocumentVersionStatus() {
    }

    /** 草稿版本 */
    public static final String DRAFT = "DRAFT";
    /** 已发布版本 */
    public static final String PUBLISHED = "PUBLISHED";
    /** 已被新版本替代 */
    public static final String SUPERSEDED = "SUPERSEDED";
}
