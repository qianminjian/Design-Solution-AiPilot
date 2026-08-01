package com.platform.core.operations.action.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 双人审批请求 DTO（V1.9 IRREVERSIBLE 动作）
 *
 * <p>用于审批人 1/2 批准或拒绝 IRREVERSIBLE 动作。
 *
 * <p>字段约束：
 * <ul>
 *   <li>comment：审批意见，必填，进入审计日志（1-1000 字符）</li>
 *   <li>stepUpToken：审批人必须提供 step-up token 二次认证（与发起人的 stepUpToken 不同）</li>
 *   <li>approved：true=批准，false=拒绝</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.23（不可逆/合规：二人审批）
 */
public record DualApprovalRequest(
        @NotBlank @Size(min = 1, max = 1000) String comment,
        @Size(max = 2048) String stepUpToken,
        boolean approved
) {
}
