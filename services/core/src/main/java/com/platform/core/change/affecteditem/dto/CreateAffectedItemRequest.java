package com.platform.core.change.affecteditem.dto;

import com.platform.core.change.domain.enums.AffectedAction;
import com.platform.core.change.domain.enums.AffectedObjectType;
import com.platform.core.change.domain.enums.ImpactLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建受影响项请求（D37.16 P12）
 *
 * <p>用于手动添加受影响项（非 AI 自动分析结果）。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record CreateAffectedItemRequest(
        @NotNull(message = "type 不能为空")
        AffectedObjectType type,

        @NotBlank(message = "code 不能为空")
        @Size(max = 128, message = "code 长度不能超过 128")
        String code,

        @NotBlank(message = "name 不能为空")
        @Size(max = 500, message = "name 长度不能超过 500")
        String name,

        @NotBlank(message = "discipline 不能为空")
        @Size(max = 64, message = "discipline 长度不能超过 64")
        String discipline,

        @NotNull(message = "action 不能为空")
        AffectedAction action,

        @NotNull(message = "impact 不能为空")
        ImpactLevel impact,

        boolean recheckRequired,

        @NotBlank(message = "owner 不能为空")
        @Size(max = 200, message = "owner 长度不能超过 200")
        String owner,

        @Size(max = 2000, message = "evidence 长度不能超过 2000")
        String evidence,

        @Size(max = 64)
        String sourceBaselineId,

        @Size(max = 64)
        String watermark,

        @Size(max = 64)
        String objectRefId
) {
}
