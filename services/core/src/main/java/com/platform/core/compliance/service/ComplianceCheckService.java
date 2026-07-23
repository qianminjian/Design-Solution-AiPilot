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
import java.util.concurrent.atomic.AtomicLong;
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
        RuleExecution execution = new RuleExecution();
        execution.setTenantId(tenantId);
        execution.setRunId(runId);
        execution.setRevisionId(revisionId);
        execution.setStatus("RUNNING");

        long startTime = System.currentTimeMillis();

        try {
            List<CheckResult> results = executeRuleEngine(tenantId, revisionId, execution.getId());

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

    private List<CheckResult> executePropertyCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
        List<CheckResult> results = new ArrayList<>();
        String propertyName = dslNode.has("propertyName") ? dslNode.get("propertyName").asText() : "unknown";
        String expectedValue = dslNode.has("expectedValue") ? dslNode.get("expectedValue").asText() : null;

        int testObjectCount = dslNode.has("testObjectCount") ? dslNode.get("testObjectCount").asInt(3) : 3;
        for (int i = 1; i <= testObjectCount; i++) {
            CheckResult result = new CheckResult();
            result.setTenantId(tenantId);
            result.setExecutionId(executionId);
            result.setObjectId(UUID.randomUUID());
            result.setObjectType("TestObject");
            result.setMeasuredValue("value-" + i);
            result.setThreshold(expectedValue);
            result.setExplanation("属性检查: " + propertyName);

            if (expectedValue == null || ("value-" + i).equals(expectedValue)) {
                result.setOutcome("PASS");
            } else {
                result.setOutcome("FAIL");
            }
            results.add(result);
        }
        return results;
    }

    private List<CheckResult> executeCountCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
        List<CheckResult> results = new ArrayList<>();
        long expectedCount = dslNode.has("expectedCount") ? dslNode.get("expectedCount").asLong(5) : 5;
        long actualCount = dslNode.has("actualCount") ? dslNode.get("actualCount").asLong(5) : 5;

        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType("CountCheck");
        result.setMeasuredValue(String.valueOf(actualCount));
        result.setThreshold(String.valueOf(expectedCount));
        result.setExplanation("数量检查: 期望 " + expectedCount + ", 实际 " + actualCount);

        if (actualCount >= expectedCount) {
            result.setOutcome("PASS");
        } else {
            result.setOutcome("FAIL");
        }
        results.add(result);
        return results;
    }

    private List<CheckResult> executeRangeCheck(UUID tenantId, UUID executionId, JsonNode dslNode) {
        List<CheckResult> results = new ArrayList<>();
        double minValue = dslNode.has("minValue") ? dslNode.get("minValue").asDouble(0) : 0;
        double maxValue = dslNode.has("maxValue") ? dslNode.get("maxValue").asDouble(100) : 100;

        double testValue = dslNode.has("testValue") ? dslNode.get("testValue").asDouble(50) : 50;

        CheckResult result = new CheckResult();
        result.setTenantId(tenantId);
        result.setExecutionId(executionId);
        result.setObjectId(UUID.randomUUID());
        result.setObjectType("RangeCheck");
        result.setMeasuredValue(String.valueOf(testValue));
        result.setThreshold(minValue + " to " + maxValue);
        result.setExplanation("范围检查: 值 " + testValue + " 应在 [" + minValue + ", " + maxValue + "]");

        if (testValue >= minValue && testValue <= maxValue) {
            result.setOutcome("PASS");
        } else {
            result.setOutcome("FAIL");
        }
        results.add(result);
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