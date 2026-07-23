package com.platform.core.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

/**
 * 创建组织请求
 */
public record CreateOrganizationRequest(
        UUID parentId,

        @NotBlank(message = "组织名不能为空")
        @Size(max = 255, message = "组织名长度不能超过 255")
        String name,

        /** 类型：COMPANY / DEPARTMENT / TEAM / EXTERNAL */
        String type,

        Map<String, Object> metadata
) {
}
