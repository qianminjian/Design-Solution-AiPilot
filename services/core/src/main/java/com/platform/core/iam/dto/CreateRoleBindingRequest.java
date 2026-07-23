package com.platform.core.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

/**
 * 创建角色绑定请求
 */
public record CreateRoleBindingRequest(
        @NotNull(message = "主体 ID 不能为空")
        UUID principalId,

        @NotBlank(message = "角色代码不能为空")
        String roleCode,

        /** 作用域类型：TENANT / ORGANIZATION / PROJECT */
        String scopeType,

        UUID scopeId,

        Instant effectiveFrom,

        Instant effectiveTo
) {
}
