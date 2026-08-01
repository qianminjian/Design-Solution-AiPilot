package com.platform.core.compliance.dto;

import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/**
 * 合规发现命令请求（D45.25 Finding API）
 *
 * command 支持：ASSIGN / VERIFY / CLOSE / REOPEN / ESCALATE / FIXED / REGRESS / RETEST
 * 其余字段为可选的属性更新（按 D45.22 字段集）。
 */
public record FindingCommandRequest(
        /** 命令：ASSIGN/VERIFY/CLOSE/REOPEN/ESCALATE/FIXED/REGRESS/RETEST */
        String command,

        UUID assignedTo,

        @Size(max = 2000)
        String note,

        /** 严重等级：CRITICAL/HIGH/MEDIUM/LOW */
        @Size(max = 16)
        String severity,

        /** 缺陷类别（D45.22 category） */
        @Size(max = 100)
        String category,

        /** 复现步骤（D45.22 repro） */
        @Size(max = 4000)
        String repro,

        /** 影响的需求/规范 */
        @Size(max = 500)
        String affectedRequirement,

        /** 关联工件 */
        @Size(max = 500)
        String artifact,

        /** 根因状态：IDENTIFIED/ANALYZING/FIXED/REGRESSED */
        @Size(max = 32)
        String rootState,

        /** 责任人 */
        UUID owner,

        /** SLA 截止时间 */
        Instant slaDueAt,

        /** 修复方案（FIXED 命令必填） */
        @Size(max = 4000)
        String fix,

        /** 复测结果（RETEST 命令必填） */
        @Size(max = 4000)
        String verification,

        /** 复测人（RETEST 命令必填，CRITICAL 必须与 owner 不同） */
        UUID verifiedBy
) {
}
