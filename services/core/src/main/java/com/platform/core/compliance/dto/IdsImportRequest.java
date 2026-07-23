package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;

public record IdsImportRequest(
        @NotBlank(message = "IDS XML 内容不能为空")
        String xmlContent,
        
        String owner
) {
}