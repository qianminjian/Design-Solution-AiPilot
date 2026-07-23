package com.platform.core.iam.support;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 租户解析器
 * V1 阶段未集成认证，从请求头 x-tenant-id 解析租户 ID
 * 后续接入认证后切换为从 JWT / SecurityContext 读取（D39）
 */
@Component
public class TenantResolver {

    public static final String TENANT_HEADER = "x-tenant-id";

    /**
     * 从请求头解析租户 ID，缺失或格式错误抛业务异常
     */
    public UUID resolveTenantId(HttpServletRequest request) {
        String headerValue = request.getHeader(TENANT_HEADER);
        if (headerValue == null || headerValue.isBlank()) {
            throw new BusinessException(
                    ErrorCode.PARAM_MISSING,
                    HttpStatus.BAD_REQUEST,
                    "缺少请求头 " + TENANT_HEADER);
        }
        try {
            return UUID.fromString(headerValue);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    HttpStatus.BAD_REQUEST,
                    "请求头 " + TENANT_HEADER + " 不是有效的 UUID");
        }
    }
}
