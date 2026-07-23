package com.platform.core.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

/**
 * 创建成员关系请求
 */
public record CreateMembershipRequest(
        @NotNull(message = "主体 ID 不能为空")
        UUID principalId,

        @NotNull(message = "组织 ID 不能为空")
        UUID organizationId,

        @NotBlank(message = "角色不能为空")
        String role,

        Instant effectiveFrom,

        Instant effectiveTo
) {
}
