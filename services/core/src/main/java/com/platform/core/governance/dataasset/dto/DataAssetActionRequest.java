package com.platform.core.governance.dataasset.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 数据资产操作请求（对齐 BFF zod governanceDataAssetActionRequestSchema）
 *
 * 五种操作：
 *  - HOLD：设置为法律保留
 *  - RELEASE_HOLD：解除法律保留
 *  - ARCHIVE：归档
 *  - DELETE：彻底删除（不可恢复，需 stepUpToken）
 *  - REPAIR：修复质量问题
 */
public record DataAssetActionRequest(
        @NotNull Action action,

        @NotBlank
        @Size(min = 1, max = 500)
        String reason,

        /** DELETE 操作必须提供 stepUpToken */
        String stepUpToken
) {

    public enum Action {
        HOLD,
        RELEASE_HOLD,
        ARCHIVE,
        DELETE,
        REPAIR
    }
}
