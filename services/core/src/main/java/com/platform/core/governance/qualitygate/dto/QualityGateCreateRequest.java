package com.platform.core.governance.qualitygate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 质量门禁创建请求（D45.23，SIT P0-13.4）
 */
public record QualityGateCreateRequest(

        /** 门禁等级（6 级 Gate） */
        @NotBlank(message = "gateLevel is required")
        @Size(max = 32)
        String gateLevel,

        /** 绑定版本/Release */
        @Size(max = 200)
        String versionTarget
) {
}
