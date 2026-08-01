package com.platform.core.common.spi;

import java.util.UUID;

/**
 * Step-up Token 校验端口（共享 SPI）
 *
 * <p> inversion of control：业务域（change / operations）定义此接口作为端口，
 * 由 auth 域适配器（JwtTokenProvider）实现。业务域不直接依赖 auth 域的具体实现。
 *
 * <p>用途：在 ChangeRequestService / OperationsActionService 中校验
 * HIGH/IRREVERSIBLE 风险动作的 stepUpToken 二次认证。
 *
 * <p>实现示例：见 com.platform.core.auth.jwt.JwtTokenProvider
 *
 * @design D40-信息-物理安全.md §Step-up 认证
 * @design security.md §12 AI 安全红线
 */
public interface StepUpTokenValidator {

    /**
     * 校验 step-up token 有效性（签名 + 有效期 + 类型）
     *
     * <p>校验失败抛 BusinessException(STEP_UP_TOKEN_INVALID, 4015)，
     * 统一错误码避免暴露具体原因（防枚举）。
     *
     * @param token step-up token 字符串
     * @throws com.platform.core.common.response.BusinessException token 无效或已过期
     */
    void validateStepUpToken(String token);

    /**
     * 从 step-up token 提取主体 ID（sub claim）
     *
     * @param token step-up token 字符串
     * @return 主体 ID
     * @throws com.platform.core.common.response.BusinessException token 无效
     */
    UUID getPrincipalIdFromToken(String token);

    /**
     * 从 step-up token 提取申请用途（purpose claim）
     *
     * @param token step-up token 字符串
     * @return 用途说明，无 purpose claim 时返回 null
     * @throws com.platform.core.common.response.BusinessException token 无效
     */
    String getPurposeFromToken(String token);
}

