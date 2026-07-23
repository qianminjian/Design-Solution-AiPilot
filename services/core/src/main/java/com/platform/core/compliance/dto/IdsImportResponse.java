package com.platform.core.compliance.dto;

import java.util.List;
import java.util.UUID;

public record IdsImportResponse(
        String specificationTitle,
        String specificationVersion,
        int totalRules,
        int importedRules,
        int skippedRules,
        List<ImportedRule> importedRulesDetail
) {
    public record ImportedRule(
            UUID ruleId,
            String ruleCode,
            String ruleName,
            UUID revisionId,
            Long revisionNo,
            String status
    ) {
    }

    public record SkippedRule(
            String ruleCode,
            String reason
    ) {
    }
}