package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/**
 * 合规发现创建请求（D45.25 Finding API：POST /findings）
 *
 * 字段对齐 SIT P0-13.1 路线图：
 *  severity/category/repro/affected requirement/artifact/root state/owner/SLA/fix/verification
 */
public record CreateFindingRequest(

        /** 严重等级：CRITICAL/HIGH/MEDIUM/LOW */
        @NotBlank(message = "severity is required")
        @Pattern(regexp = "CRITICAL|HIGH|MEDIUM|LOW", message = "severity must be CRITICAL/HIGH/MEDIUM/LOW")
        String severity,

        /** 缺陷类别（D45.22 category） */
        @NotBlank(message = "category is required")
        @Size(max = 100)
        String category,

        /** 缺陷描述（note 别名，必填） */
        @NotBlank(message = "note is required")
        @Size(max = 2000)
        String note,

        /** 关联检查结果 ID（可选） */
        UUID resultId,

        /** 复现步骤 */
        @Size(max = 4000)
        String repro,

        /** 影响的需求/规范 */
        @Size(max = 500)
        String affectedRequirement,

        /** 关联工件 */
        @Size(max = 500)
        String artifact,

        /** 责任人 */
        UUID assignedTo,

        /** 根因状态：IDENTIFIED/ANALYZING */
        @Pattern(regexp = "IDENTIFIED|ANALYZING", message = "rootState must be IDENTIFIED/ANALYZING")
        String rootState,

        /** SLA 截止时间 */
        Instant slaDueAt
) {
}
