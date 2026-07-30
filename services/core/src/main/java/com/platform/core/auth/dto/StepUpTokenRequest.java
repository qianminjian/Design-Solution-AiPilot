package com.platform.core.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Step-up 认证请求
 *
 * <p>用于危险动作（HIGH/IRREVERSIBLE）执行前的二次认证（见 security.md §12 / D40 §Step-up 认证）。
 *
 * <p>业务流程：
 * <ul>
 *   <li>用户已登录（携带 access token），但执行危险动作前需重新输入密码</li>
 *   <li>服务端校验密码正确后签发短期 step-up token（5 分钟有效期）</li>
 *   <li>前端将 step-up token 放入 OperationsActionRequest.stepUpToken 字段</li>
 *   <li>OperationsActionService 验证 step-up token 有效性后执行危险动作</li>
 * </ul>
 *
 * <p>安全约束：
 * <ul>
 *   <li>密码不打印到日志</li>
 *   <li>校验失败统一返回"密码错误"（防枚举）</li>
 *   <li>step-up token 短期有效（≤ 5 分钟），不存储在 RefreshTokenStore（无状态 JWT）</li>
 * </ul>
 *
 * @design D40-信息-物理安全.md §Step-up 认证
 * @design D37-关键界面-交互状态.md §D37.17 危险动作
 */
public record StepUpTokenRequest(

        /** 当前密码（用于二次认证校验） */
        @NotBlank(message = "密码不能为空")
        @Size(min = 1, max = 128, message = "密码长度不能超过 128")
        String currentPassword,

        /** 申请 step-up token 的用途说明（如"执行 ISOLATE 动作"），进入审计日志 */
        @NotBlank(message = "用途不能为空")
        @Size(max = 200, message = "用途长度不能超过 200")
        String purpose
) {
}
