package com.platform.core.compliance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.CheckResult;
import com.platform.core.compliance.domain.ComplianceCheckRun;
import com.platform.core.compliance.domain.ComplianceFinding;
import com.platform.core.compliance.domain.RuleExecution;
import com.platform.core.compliance.dto.CheckResultDto;
import com.platform.core.compliance.dto.ComplianceCheckRunDto;
import com.platform.core.compliance.dto.CreateCheckRunRequest;
import com.platform.core.compliance.dto.RuleExecutionDto;
import com.platform.core.compliance.repository.CheckResultRepository;
import com.platform.core.compliance.repository.ComplianceCheckRunRepository;
import com.platform.core.compliance.repository.ComplianceFindingRepository;
import com.platform.core.compliance.repository.RuleExecutionRepository;
import com.platform.core.compliance.repository.RuleRevisionRepository;
import com.platform.core.compliance.repository.RuleSetRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
public class ComplianceCheckService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceCheckService.class);

    private final ComplianceCheckRunRepository checkRunRepository;
    private final RuleExecutionRepository ruleExecutionRepository;
    private final CheckResultRepository checkResultRepository;
    private final ComplianceFindingRepository findingRepository;
    private final RuleSetRuleRepository ruleSetRuleRepository;
    private final RuleRevisionRepository ruleRevisionRepository;
    private final ObjectMapper objectMapper;

    public ComplianceCheckService(ComplianceCheckRunRepository checkRunRepository,
                                  RuleExecutionRepository ruleExecutionRepository,
                                  CheckResultRepository checkResultRepository,
                                  ComplianceFindingRepository findingRepository,
                                  RuleSetRuleRepository ruleSetRuleRepository,
                                  RuleRevisionRepository ruleRevisionRepository,
                                  ObjectMapper objectMapper) {
        this.checkRunRepository = checkRunRepository;
        this.ruleExecutionRepository = ruleExecutionRepository;
        this.checkResultRepository = checkResultRepository;
        this.findingRepository = findingRepository;
        this.ruleSetRuleRepository = ruleSetRuleRepository;
        this.ruleRevisionRepository = ruleRevisionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ComplianceCheckRunDto createCheckRun(UUID tenantId, CreateCheckRunRequest request) {
        ComplianceCheckRun checkRun = new ComplianceCheckRun();
        checkRun.setTenantId(tenantId);
        checkRun.setProjectId(request.projectId());
        checkRun.setRuleSetId(request.ruleSetId());
        checkRun.setStatus("PENDING");
        checkRun.setOutcomeSummary("{}");

        ComplianceCheckRun saved = checkRunRepository.save(checkRun);
        log.info("创建检查运行成功 tenantId={} runId={} ruleSetId={}", tenantId, saved.getId(), request.ruleSetId());
        return toDto(saved, new ArrayList<>());
    }

    @Transactional
    public ComplianceCheckRunDto executeCheckRun(UUID tenantId, UUID runId) {
        ComplianceCheckRun checkRun = checkRunRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHECK_RUN_NOT_FOUND, "检查运行不存在: " + runId));

        if (!"PENDING".equals(checkRun.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_RUN_STATUS, "检查运行状态不允许执行");
        }

        checkRun.setStatus("STARTED");
        checkRun.setStartedAt(Instant.now());
        checkRunRepository.save(checkRun);

        List<RuleExecution> executions = new ArrayList<>();
        List<CheckResult> allResults = new ArrayList<>();

        List<com.platform.core.compliance.domain.RuleSetRule> ruleSetRules = ruleSetRuleRepository
                .findByRuleSetIdOrderByPriorityAsc(checkRun.getRuleSetId());

        for (com.platform.core.compliance.domain.RuleSetRule rsr : ruleSetRules) {
            RuleExecution execution = executeRule(tenantId, runId, rsr.getRevisionId());
            executions.add(execution);
            allResults.addAll(execution.getPassCount() > 0 || execution.getFailCount() > 0
                    ? checkResultRepository.findByExecutionId(execution.getId())
                    : new ArrayList<>());
        }

        Map<String, Long> outcomeSummary = computeOutcomeSummary(executions);
        checkRun.setOutcomeSummary(serializeJson(outcomeSummary));
        checkRun.setStatus(computeRunStatus(outcomeSummary));
        checkRun.setCompletedAt(Instant.now());
        checkRunRepository.save(checkRun);

        generateFindings(tenantId, allResults);

        log.info("检查运行完成 tenantId={} runId={} status={}", tenantId, runId, checkRun.getStatus());
        return toDto(checkRun, executions);
    }

    @Transactional(readOnly = true)
    public ComplianceCheckRunDto getCheckRun(UUID tenantId, UUID runId) {
        ComplianceCheckRun checkRun = checkRunRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHECK_RUN_NOT_FOUND, "检查运行不存在: " + runId));
        List<RuleExecution> executions = ruleExecutionRepository.findByRunId(runId);
        return toDto(checkRun, executions);
    }

    @Transactional(readOnly = true)
    public Page<ComplianceCheckRunDto> listCheckRuns(UUID tenantId, UUID projectId, Pageable pageable) {
        Page<ComplianceCheckRun> page;
        if (projectId != null) {
            page = checkRunRepository.findByProjectId(projectId, pageable);
        } else {
            page = checkRunRepository.findByTenantId(tenantId, pageable);
        }
        return page.map(cr -> toDto(cr, ruleExecutionRepository.findByRunId(cr.getId())));
    }

    @Transactional(readOnly = true)
    public Page<CheckResultDto> listCheckResults(UUID tenantId, UUID executionId, String outcome, Pageable pageable) {
        Page<CheckResult> page;
        if (outcome != null && !outcome.isBlank()) {
            page = checkResultRepository.findByExecutionId(executionId, pageable);
            page = page.map(r -> r);
        } else {
            page = checkResultRepository.findByExecutionId(executionId, pageable);
        }
        return page.map(this::toResultDto);
    }

    private RuleExecution executeRule(UUID tenantId, UUID runId, UUID revisionId) {
        // 先保存 execution 以获取数据库生成的 ID
        RuleExecution execution = new RuleExecution();
        execution.setTenantId(tenantId);
        execution.setRunId(runId);
        execution.setRevisionId(revisionId);
        execution.setStatus("PENDING");
        execution = ruleExecutionRepository.save(execution);
        UUID executionId = execution.getId();

        execution.setStatus("RUNNING");
        long startTime = System.currentTimeMillis();

        try {
            List<CheckResult> results = executeRuleEngine(tenantId, revisionId, executionId);

            execution.setApplicabilityCount((long) results.size());
            execution.setPassCount(results.stream().filter(r -> "PASS".equals(r.getOutcome())).count());
            execution.setFailCount(results.stream().filter(r -> "FAIL".equals(r.getOutcome())).count());
            execution.setNotApplicableCount(results.stream().filter(r -> "NOT_APPLICABLE".equals(r.getOutcome())).count());
            execution.setIndeterminateCount(results.stream().filter(r -> "INDETERMINATE".equals(r.getOutcome())).count());
            execution.setErrorCount(results.stream().filter(r -> "ERROR".equals(r.getOutcome())).count());
            execution.setManualReviewCount(results.stream().filter(r -> "MANUAL_REVIEW".equals(r.getOutcome())).count());
            execution.setStatus(computeExecutionStatus(execution));

            checkResultRepository.saveAll(results);

        } catch (Exception e) {
            execution.setStatus("ERROR");
            execution.setErrorCount(1L);
            log.error("规则执行失败 revisionId={}", revisionId, e);
        }

        execution.setDurationMs(System.currentTimeMillis() - startTime);
        return ruleExecutionRepository.save(execution);
    }

    private List<CheckResult> executeRuleEngine(UUID tenantId, UUID revisionId, UUID executionId) {
        List<CheckResult> results = new ArrayList<>();

        ruleRevisionRepository.findById(revisionId).ifPresent(revision -> {
            try {
                JsonNode dslNode = objectMapper.readTree(revision.getDslJson());
                String ruleType = dslNode.has("ruleType") ? dslNode.get("ruleType").asText() : "DEFAULT";

                switch (ruleType) {
                    case "PROPERTY_CHECK" -> results.addAll(executePropertyCheck(tenantId, executionId, dslNode));
                    case "COUNT_CHECK" -> results.addAll(executeCountCheck(tenantId, executionId, dslNode));
                    case "RANGE_CHECK" -> results.addAll(executeRangeCheck(tenantId, executionId, dslNode));
                    case "EXISTENCE_CHECK" -> results.addAll(executeExistenceCheck(tenantId, executionId, dslNode));
                    default -> results.addAll(executeDefaultCheck(tenantId, executionId, dslNode));
                }
            } catch (JsonProcessingException e) {
                CheckResult errorResult = new CheckResult();
                errorResult.setTenantId(tenantId);
                errorResult.setExecutionId(executionId);
                errorResult.setOutcome("ERROR");
                errorResult.setExplanation("DSL JSON 解析失败: " + e.getMessage());
                results.add(errorResult);
            }
        });

        return results;
    }

    /**
 * 属性检查引擎：读取对象属性值与阈值比较
 *
 * DSL 字段（对应种子数据格式）：
 *   targetProperty: 目标属性名（area/clearHeight/…）
 *   operator: 比较操作符（GREATER_THAN_OR_EQUAL/LESS_THAN_OR_EQUAL/EQUAL）
 *   threshold: 阈值
 *   unit: 单位（m2/mm/…）
 *   objectType: 对象类型（Space/Level/…）
 *
 * 为每个测试对象生成随机属性值，根据操作符判定 PASS/FAIL。
 */
private List<CheckResult> executePropertyCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
    List<CheckResult> results = new ArrayList<>();
    String targetProperty = dslNode.has("targetProperty") ? dslNode.get("targetProperty").asText() : "area";
    String operator = dslNode.has("operator") ? dslNode.get("operator").asText() : "GREATER_THAN_OR_EQUAL";
    double threshold = dslNode.has("threshold") ? dslNode.get("threshold").asDouble() : 10.0;
    String unit = dslNode.has("unit") ? dslNode.get("unit").asText() : "m2";
    String objectType = dslNode.has("objectType") ? dslNode.get("objectType").asText() : "Space";

    // 为每个对象类型生成 4-8 个测试对象（模拟建筑楼层/空间）
    int objectCount = 4 + ThreadLocalRandom.current().nextInt(5);
    for (int i = 1; i <= objectCount; i++) {
        // 在阈值的 60%-140% 范围内随机生成值
        double measuredValue = threshold * (0.6 + ThreadLocalRandom.current().nextDouble() * 0.8);
        measuredValue = Math.round(measuredValue * 100.0) / 100.0;

        boolean pass = switch (operator) {
            case "GREATER_THAN_OR_EQUAL" -> measuredValue >= threshold;
            case "LESS_THAN_OR_EQUAL" -> measuredValue <= threshold;
            case "EQUAL" -> Math.abs(measuredValue - threshold) < 0.001;
            case "NOT_EQUAL" -> Math.abs(measuredValue - threshold) >= 0.001;
            default -> measuredValue >= threshold; // 默认不小于
        };

        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType(objectType);
        result.setMeasuredValue(measuredValue + " " + unit);
        result.setThreshold(operator + " " + threshold + " " + unit);
        result.setOutcome(pass ? "PASS" : "FAIL");
        result.setExplanation(String.format(
                "%s 检查: %s=%.2f%s 要求 %s %.0f%s -> %s",
                objectType, targetProperty, measuredValue, unit, operator, threshold, unit,
                pass ? "通过" : "不通过"));
        results.add(result);
    }
    return results;
}

/**
 * 数量检查引擎：统计符合条件的对象数量并与最小/最大数量比较
 *
 * DSL 字段：
 *   filterProperty: 筛选属性名（spaceType/stairType/…）
 *   filterValue: 筛选值（RESTROOM/EGRESS/…）
 *   minCount: 最小数量要求
 *   maxCount: 最大数量（可选）
 *   perLevel: 是否按层统计
 *   condition: 前置条件（如 aboveGroundFloors>=5）
 *   objectType: 对象类型
 *
 * 生成随机数量的对象，按筛选条件统计后判定。
 */
private List<CheckResult> executeCountCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
    List<CheckResult> results = new ArrayList<>();
    String filterProperty = dslNode.has("filterProperty") ? dslNode.get("filterProperty").asText() : "spaceType";
    String filterValue = dslNode.has("filterValue") ? dslNode.get("filterValue").asText() : "UNKNOWN";
    long minCount = dslNode.has("minCount") ? dslNode.get("minCount").asLong(1) : 1;
    Long maxCount = dslNode.has("maxCount") && !dslNode.get("maxCount").isNull() ? dslNode.get("maxCount").asLong() : null;
    boolean perLevel = dslNode.has("perLevel") && dslNode.get("perLevel").asBoolean(false);
    String objectType = dslNode.has("objectType") ? dslNode.get("objectType").asText() : "Space";

    // 检查前置条件（如 >5 层建筑）
    if (dslNode.has("condition")) {
        JsonNode cond = dslNode.get("condition");
        if (cond.has("threshold")) {
            double condThreshold = cond.get("threshold").asDouble();
            // 模拟项目实际值：80% 概率满足条件
            boolean condMet = ThreadLocalRandom.current().nextDouble() > 0.2;
            if (!condMet) {
                CheckResult na = new CheckResult();
                na.setTenantId(tenantId);
                na.setExecutionId(executionId);
                na.setObjectId(UUID.randomUUID());
                na.setObjectType(objectType);
                na.setOutcome("NOT_APPLICABLE");
                na.setExplanation("前置条件不满足: " + cond.get("targetProperty").asText()
                        + " " + cond.get("operator").asText() + " " + condThreshold);
                results.add(na);
                return results;
            }
        }
    }

    // 按层或整体统计
    int levelCount = perLevel ? 3 + ThreadLocalRandom.current().nextInt(10) : 1;
    for (int level = 0; level < levelCount; level++) {
        long actualCount = minCount + ThreadLocalRandom.current().nextLong(-2, 4);
        if (actualCount < 0) actualCount = 0;

        boolean pass = true;
        if (maxCount != null) {
            pass = actualCount >= minCount && actualCount <= maxCount;
        } else {
            pass = actualCount >= minCount;
        }

        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType(objectType);
        result.setMeasuredValue("数量=" + actualCount);
        result.setThreshold("要求 " + filterValue + " 最少 " + minCount + (maxCount != null ? " 最多 " + maxCount : ""));
        result.setOutcome(pass ? "PASS" : "FAIL");
        String levelLabel = perLevel ? " (第" + (level + 1) + "层)" : "";
        result.setExplanation(String.format(
                "数量检查%s: %s=%s 实际=%d 最少=%d%s -> %s",
                levelLabel, filterProperty, filterValue, actualCount, minCount,
                maxCount != null ? " 最多=" + maxCount : "",
                pass ? "通过" : "不通过"));
        results.add(result);
    }
    return results;
}

/**
 * 范围检查引擎：检查数值是否在允许范围内
 *
 * DSL 字段：
 *   targetProperty: 目标属性名（netWidth/grossArea/…）
 *   minValue: 最小值下限（null 表示无下限）
 *   maxValue: 最大值上限（null 表示无上限）
 *   unit: 单位
 *   objectType: 对象类型
 *
 * 生成多个测试对象，随机值在边界的 80%-120% 范围内，判定 PASS/FAIL。
 */
private List<CheckResult> executeRangeCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
    List<CheckResult> results = new ArrayList<>();
    String targetProperty = dslNode.has("targetProperty") ? dslNode.get("targetProperty").asText() : "value";
    Double minValue = dslNode.has("minValue") && !dslNode.get("minValue").isNull() ? dslNode.get("minValue").asDouble() : null;
    Double maxValue = dslNode.has("maxValue") && !dslNode.get("maxValue").isNull() ? dslNode.get("maxValue").asDouble() : null;
    String unit = dslNode.has("unit") ? dslNode.get("unit").asText() : "mm";
    String objectType = dslNode.has("objectType") ? dslNode.get("objectType").asText() : "Element";

    // 生成 5-8 个测试对象
    int objectCount = 5 + ThreadLocalRandom.current().nextInt(4);
    for (int i = 1; i <= objectCount; i++) {
        // 在边界附近生成值：70% 在范围内，30% 在范围外
        double measuredValue;
        boolean inRange = ThreadLocalRandom.current().nextDouble() < 0.7;
        if (inRange || (minValue == null && maxValue == null)) {
            double low = minValue != null ? minValue : 0;
            double high = maxValue != null ? maxValue : low * 2;
            measuredValue = low + ThreadLocalRandom.current().nextDouble() * (high - low);
        } else {
            // 故意生成边界外值
            if (minValue != null && ThreadLocalRandom.current().nextBoolean()) {
                measuredValue = minValue * (0.5 + ThreadLocalRandom.current().nextDouble() * 0.4);
            } else if (maxValue != null) {
                measuredValue = maxValue * (1.05 + ThreadLocalRandom.current().nextDouble() * 0.3);
            } else {
                measuredValue = 0;
            }
        }
        measuredValue = Math.round(measuredValue * 10.0) / 10.0;

        boolean pass = true;
        if (minValue != null && measuredValue < minValue) pass = false;
        if (maxValue != null && measuredValue > maxValue) pass = false;

        String rangeDesc = "[" + (minValue != null ? minValue.toString() : "无下限") + ", "
                + (maxValue != null ? maxValue.toString() : "无上限") + "]";

        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType(objectType);
        result.setMeasuredValue(measuredValue + " " + unit);
        result.setThreshold(rangeDesc + " " + unit);
        result.setOutcome(pass ? "PASS" : "FAIL");
        result.setExplanation(String.format(
                "范围检查: %s=%.1f%s 要求范围 %s%s -> %s",
                targetProperty, measuredValue, unit, rangeDesc, unit,
                pass ? "通过" : "不通过"));
        results.add(result);
    }
    return results;
}

    private List<CheckResult> executeDefaultCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
        List<CheckResult> results = new ArrayList<>();
        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType("Default");
        result.setOutcome("NOT_APPLICABLE");
        result.setExplanation("默认规则类型，未配置具体检查逻辑");
        results.add(result);
        return results;
    }

    /**
     * 存在性检查引擎：检查必需的空间/元素是否存在于建筑模型中
     *
     * DSL 字段：
     *   requiredItems: 必需项列表 [{type, name, minCount}]
     *   objectType: 对象类型（Space/Element/Facility）
     *
     * 模拟检查每个必需项是否存在，70% 概率通过。
     */
    private List<CheckResult> executeExistenceCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
        List<CheckResult> results = new ArrayList<>();
        String objectType = dslNode.has("objectType") ? dslNode.get("objectType").asText() : "Space";

        if (dslNode.has("requiredItems") && dslNode.get("requiredItems").isArray()) {
            for (JsonNode item : dslNode.get("requiredItems")) {
                String itemName = item.has("name") ? item.get("name").asText() : "Unknown";
                String itemType = item.has("type") ? item.get("type").asText() : objectType;
                long minCount = item.has("minCount") ? item.get("minCount").asLong(1) : 1;

                // 模拟 70% 概率存在
                boolean exists = ThreadLocalRandom.current().nextDouble() < 0.7;
                long actualCount = exists ? (minCount + ThreadLocalRandom.current().nextLong(0, 3)) : 0;

                CheckResult result = new CheckResult();
                result.setTenantId(tenantId);
                result.setExecutionId(executionId);
                result.setObjectId(UUID.randomUUID());
                result.setObjectType(itemType);
                result.setMeasuredValue("存在=" + (exists ? "是" : "否") + " 数量=" + actualCount);
                result.setThreshold("要求最少 " + minCount + " 个");
                result.setOutcome(exists ? "PASS" : "FAIL");
                result.setExplanation(String.format(
                        "存在性检查: %s(%s) 要求至少%d个, 实际%d个 -> %s",
                        itemName, itemType, minCount, actualCount,
                        exists ? "通过" : "不通过"));
                results.add(result);
            }
        } else {
            // 无 requiredItems 时做通用检查
            CheckResult na = new CheckResult();
            na.setTenantId(tenantId);
            na.setExecutionId(executionId);
            na.setObjectId(UUID.randomUUID());
            na.setObjectType(objectType);
            na.setOutcome("NOT_APPLICABLE");
            na.setExplanation("存在性检查未配置必需项列表");
            results.add(na);
        }

        return results;
    }

    private void generateFindings(UUID tenantId, List<CheckResult> results) {
        for (CheckResult result : results) {
            if ("FAIL".equals(result.getOutcome()) || "INDETERMINATE".equals(result.getOutcome())
                    || "ERROR".equals(result.getOutcome()) || "MANUAL_REVIEW".equals(result.getOutcome())) {

                ComplianceFinding finding = new ComplianceFinding();
                finding.setTenantId(tenantId);
                finding.setResultId(result.getId());
                finding.setSeverity("FAIL".equals(result.getOutcome()) ? "HIGH" : "MEDIUM");
                finding.setStatus("OPEN");
                finding.setNote(result.getExplanation());
                findingRepository.save(finding);
            }
        }
    }

    private Map<String, Long> computeOutcomeSummary(List<RuleExecution> executions) {
        Map<String, Long> summary = new HashMap<>();
        summary.put("totalRules", (long) executions.size());
        summary.put("pass", executions.stream().mapToLong(RuleExecution::getPassCount).sum());
        summary.put("fail", executions.stream().mapToLong(RuleExecution::getFailCount).sum());
        summary.put("notApplicable", executions.stream().mapToLong(RuleExecution::getNotApplicableCount).sum());
        summary.put("indeterminate", executions.stream().mapToLong(RuleExecution::getIndeterminateCount).sum());
        summary.put("error", executions.stream().mapToLong(RuleExecution::getErrorCount).sum());
        summary.put("manualReview", executions.stream().mapToLong(RuleExecution::getManualReviewCount).sum());
        return summary;
    }

    private String computeRunStatus(Map<String, Long> summary) {
        if (summary.getOrDefault("error", 0L) > 0) {
            return "PARTIAL";
        }
        if (summary.getOrDefault("fail", 0L) > 0 || summary.getOrDefault("indeterminate", 0L) > 0) {
            return "COMPLETED";
        }
        return "COMPLETED";
    }

    private String computeExecutionStatus(RuleExecution execution) {
        if (execution.getErrorCount() > 0) {
            return "ERROR";
        }
        if (execution.getFailCount() > 0) {
            return "FAILED";
        }
        if (execution.getPassCount() > 0) {
            return "PASSED";
        }
        return "SKIPPED";
    }

    private String serializeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException ex) {
            log.error("JSON 序列化失败", ex);
            return "{}";
        }
    }

    private ComplianceCheckRunDto toDto(ComplianceCheckRun cr, List<RuleExecution> executions) {
        List<RuleExecutionDto> executionDtos = executions.stream()
                .map(this::toExecutionDto)
                .toList();

        return new ComplianceCheckRunDto(
                cr.getId(),
                cr.getTenantId(),
                cr.getProjectId(),
                cr.getRuleSetId(),
                cr.getStatus(),
                cr.getOutcomeSummary(),
                executionDtos,
                cr.getStartedAt(),
                cr.getCompletedAt(),
                cr.getCreatedAt(),
                cr.getUpdatedAt(),
                cr.getCreatedBy(),
                cr.getUpdatedBy(),
                cr.getRowVersion()
        );
    }

    private RuleExecutionDto toExecutionDto(RuleExecution e) {
        return new RuleExecutionDto(
                e.getId(),
                e.getTenantId(),
                e.getRunId(),
                e.getRevisionId(),
                e.getApplicabilityCount(),
                e.getPassCount(),
                e.getFailCount(),
                e.getNotApplicableCount(),
                e.getIndeterminateCount(),
                e.getErrorCount(),
                e.getManualReviewCount(),
                e.getStatus(),
                e.getDurationMs(),
                e.getLogs(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getRowVersion()
        );
    }

    private CheckResultDto toResultDto(CheckResult r) {
        return new CheckResultDto(
                r.getId(),
                r.getTenantId(),
                r.getExecutionId(),
                r.getObjectId(),
                r.getObjectType(),
                r.getOutcome(),
                r.getMeasuredValue(),
                r.getThreshold(),
                r.getExplanation(),
                r.getEvidenceJson(),
                r.getCreatedAt(),
                r.getCreatedBy(),
                r.getRowVersion()
        );
    }
}