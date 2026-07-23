package com.platform.core.design.dto;

import com.platform.core.design.domain.DesignDiscipline;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * 创建设计选项请求
 */
public record CreateDesignOptionRequest(
    @NotNull UUID projectId,
    @NotBlank @Size(max = 256) String title,
    @Size(max = 4096) String description,
    DesignDiscipline discipline,
    String metadata,
    UUID thumbnailDocumentId
) {}
