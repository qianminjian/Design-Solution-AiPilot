package com.platform.core.change.closureevidence.dto;

import com.platform.core.change.domain.enums.ClosureEvidenceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建关闭证据请求（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record CreateClosureEvidenceRequest(
        @NotNull(message = "type 不能为空")
        ClosureEvidenceType type,

        @NotBlank(message = "title 不能为空")
        @Size(max = 500)
        String title,

        @NotBlank(message = "sourceId 不能为空")
        @Size(max = 64)
        String sourceId,

        @Size(max = 1000)
        String sourceDescription,

        @NotBlank(message = "summary 不能为空")
        @Size(max = 2000)
        String summary,

        @Size(max = 500)
        String evidenceUrl,

        boolean blocksClosure
) {
}
