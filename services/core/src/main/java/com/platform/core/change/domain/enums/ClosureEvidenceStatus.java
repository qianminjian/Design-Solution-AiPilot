package com.platform.core.change.domain.enums;

/**
 * 关闭证据状态
 *
 * 与前端 ClosureEvidenceStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 * 关闭前所有证据必须已验证。
 */
public enum ClosureEvidenceStatus {
    /** 待提交 */
    PENDING,
    /** 已提交，待验证 */
    SUBMITTED,
    /** 验证中 */
    VERIFYING,
    /** 已验证通过 */
    VERIFIED,
    /** 验证未通过 */
    REJECTED,
    /** 已失效 */
    INVALID
}
