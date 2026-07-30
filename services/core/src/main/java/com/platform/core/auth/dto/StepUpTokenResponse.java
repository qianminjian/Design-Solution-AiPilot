package com.platform.core.auth.dto;

/**
 * Step-up 认证响应
 *
 * <p>返回短期有效的 step-up token，用于危险动作（HIGH/IRREVERSIBLE）执行。
 *
 * <p>有效期：5 分钟（300 秒），超过后需重新申请。
 *
 * <p>安全约束：
 * <ul>
 *   <li>step-up token 仅可用于 OperationsActionRequest.stepUpToken 字段</li>
 *   <li>不可用于普通 API 认证（JwtAuthenticationFilter 不接受 step-up token 类型）</li>
 *   <li>token 不存储在客户端 localStorage，仅保存在内存中直到使用</li>
 * </ul>
 *
 * @design D40-信息-物理安全.md §Step-up 认证
 */
public record StepUpTokenResponse(
        String stepUpToken,
        long expiresInSeconds,
        String purpose
) {
}
