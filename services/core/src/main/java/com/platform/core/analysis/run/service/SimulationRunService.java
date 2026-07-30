package com.platform.core.analysis.run.service;

import com.platform.core.analysis.domain.enums.RunStatus;
import com.platform.core.analysis.problem.domain.AnalysisProblem;
import com.platform.core.analysis.problem.repository.AnalysisProblemRepository;
import com.platform.core.analysis.run.domain.SimulationRun;
import com.platform.core.analysis.run.dto.CancelRunRequest;
import com.platform.core.analysis.run.dto.ConvergenceMetricDto;
import com.platform.core.analysis.run.dto.CreateSimulationRunRequest;
import com.platform.core.analysis.run.dto.RunTimelineEventDto;
import com.platform.core.analysis.run.dto.SimulationRunDto;
import com.platform.core.analysis.run.repository.ConvergenceMetricRepository;
import com.platform.core.analysis.run.repository.RunTimelineEventRepository;
import com.platform.core.analysis.run.repository.SimulationRunRepository;
import com.platform.core.analysis.scenario.domain.AnalysisScenario;
import com.platform.core.analysis.scenario.repository.AnalysisScenarioRepository;
import com.platform.core.analysis.solver.domain.SolverProfile;
import com.platform.core.analysis.solver.repository.SolverProfileRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 模拟运行服务（D37.14 P10）
 *
 * <p>核心操作：
 *  - listRuns：按问题/状态查询
 *  - getRun：单条详情
 *  - createRun：创建运行（QUEUED）
 *  - cancelRun：取消运行（cancel 高风险动作）
 *  - retryRun：重试运行（retry storm 检测）
 *  - getRunTimeline：运行时间线
 *  - getRunConvergence：收敛指标
 *
 * 安全红线：
 *  - cancel/retry 为高风险动作，需 stepUpToken
 *  - retry storm 检测：retry_count ≥ 5 阻断重试
 *  - unknown job 标识：is_unknown_job=true 时需 Reconcile
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Service
public class SimulationRunService {

    private static final Logger log = LoggerFactory.getLogger(SimulationRunService.class);

    /** retry storm 检测阈值 */
    private static final int RETRY_STORM_THRESHOLD = 5;

    private final SimulationRunRepository runRepository;
    private final RunTimelineEventRepository timelineRepository;
    private final ConvergenceMetricRepository convergenceRepository;
    private final AnalysisProblemRepository problemRepository;
    private final AnalysisScenarioRepository scenarioRepository;
    private final SolverProfileRepository solverProfileRepository;

    public SimulationRunService(
            SimulationRunRepository runRepository,
            RunTimelineEventRepository timelineRepository,
            ConvergenceMetricRepository convergenceRepository,
            AnalysisProblemRepository problemRepository,
            AnalysisScenarioRepository scenarioRepository,
            SolverProfileRepository solverProfileRepository
    ) {
        this.runRepository = runRepository;
        this.timelineRepository = timelineRepository;
        this.convergenceRepository = convergenceRepository;
        this.problemRepository = problemRepository;
        this.scenarioRepository = scenarioRepository;
        this.solverProfileRepository = solverProfileRepository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public Page<SimulationRunDto> listRuns(
            UUID tenantId,
            UUID problemId,
            RunStatus status,
            int page,
            int pageSize
    ) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.min(Math.max(1, pageSize), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "queuedAt"));

        Page<SimulationRun> result;
        if (problemId != null && status != null) {
            // 优先按 problemId 过滤（V0 简化：返回全部，前端按 status 二次过滤）
            result = runRepository.findByTenantIdAndProblemId(tenantId, problemId, pageable);
        } else if (problemId != null) {
            result = runRepository.findByTenantIdAndProblemId(tenantId, problemId, pageable);
        } else if (status != null) {
            result = runRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            result = runRepository.findByTenantId(tenantId, pageable);
        }
        return result.map(this::toDto);
    }

    @Transactional(readOnly = true)
    public SimulationRunDto getRun(UUID tenantId, UUID runId) {
        SimulationRun entity = runRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SimulationRun not found: " + runId));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public List<RunTimelineEventDto> getRunTimeline(UUID tenantId, UUID runId) {
        validateRunExists(tenantId, runId);
        return timelineRepository.findAllByTenantIdAndRunIdOrderByOccurredAtAsc(tenantId, runId)
                .stream()
                .map(e -> new RunTimelineEventDto(
                        e.getId(),
                        e.getRunId(),
                        e.getEventType(),
                        e.getStatusFrom(),
                        e.getStatusTo(),
                        e.getOccurredAt(),
                        e.getDurationMs(),
                        e.getOperatorId(),
                        e.getMessage(),
                        e.getMetadata(),
                        e.getTraceId(),
                        e.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ConvergenceMetricDto> getRunConvergence(UUID tenantId, UUID runId) {
        validateRunExists(tenantId, runId);
        return convergenceRepository.findAllByTenantIdAndRunIdOrderByIterationAsc(tenantId, runId)
                .stream()
                .map(m -> new ConvergenceMetricDto(
                        m.getId(),
                        m.getRunId(),
                        m.getIteration(),
                        m.getResidual(),
                        m.getConvergenceStatus(),
                        m.getOccurredAt()
                ))
                .collect(Collectors.toList());
    }

    // ── 创建 ──

    @Transactional
    public SimulationRunDto createRun(
            UUID tenantId,
            String currentUser,
            CreateSimulationRunRequest request
    ) {
        validateProblemExists(tenantId, request.problemId());
        validateScenarioExists(tenantId, request.scenarioId());
        SolverProfile solver = validateSolverExists(tenantId, request.solverProfileId());

        // 容量校验：正在运行的任务数 < maxConcurrentRuns
        long runningCount = runRepository.countByTenantIdAndSolverProfileIdAndStatusIn(
                tenantId,
                request.solverProfileId(),
                List.of(RunStatus.QUEUED, RunStatus.LICENSING, RunStatus.PREPARING, RunStatus.RUNNING)
        );
        if (runningCount >= solver.getMaxConcurrentRuns()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "求解器并发已满: " + runningCount + "/" + solver.getMaxConcurrentRuns());
        }

        SimulationRun entity = new SimulationRun();
        entity.setTenantId(tenantId);
        entity.setProblemId(request.problemId());
        entity.setScenarioId(request.scenarioId());
        entity.setSolverProfileId(request.solverProfileId());
        entity.setSolverProfileName(solver.getName());
        entity.setStatus(RunStatus.QUEUED);
        entity.setQueuedAt(Instant.now());
        entity.setRetryCount(0);
        entity.setUnknownJob(false);

        SimulationRun saved = runRepository.save(entity);
        log.info("SimulationRun created: id={}, problemId={}, tenantId={}, queuedBy={}",
                saved.getId(), request.problemId(), tenantId, currentUser);
        return toDto(saved);
    }

    // ── 状态流转：取消运行 ──

    @Transactional
    public SimulationRunDto cancelRun(
            UUID tenantId,
            UUID runId,
            String currentUser,
            CancelRunRequest request
    ) {
        SimulationRun entity = runRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SimulationRun not found: " + runId));

        // 已终态的运行不可取消
        if (isTerminalStatus(entity.getStatus())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "SimulationRun 已处于终态: " + entity.getStatus());
        }

        // 高风险动作强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        entity.setStatus(RunStatus.CANCELLED);
        entity.setCompletedAt(Instant.now());
        entity.setCancelledBy(currentUser);
        entity.setCancelReason(request.reason());

        SimulationRun saved = runRepository.save(entity);
        log.info("SimulationRun cancelled: id={}, tenantId={}, cancelledBy={}, reason={}",
                runId, tenantId, currentUser, request.reason());
        return toDto(saved);
    }

    // ── 状态流转：重试运行 ──

    @Transactional
    public SimulationRunDto retryRun(
            UUID tenantId,
            UUID runId,
            String currentUser,
            CancelRunRequest request
    ) {
        SimulationRun entity = runRepository.findByIdAndTenantId(runId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SimulationRun not found: " + runId));

        // 仅终态（FAILED/CANCELLED/UNKNOWN）运行可重试
        if (entity.getStatus() != RunStatus.FAILED
                && entity.getStatus() != RunStatus.CANCELLED
                && entity.getStatus() != RunStatus.UNKNOWN) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "SimulationRun 必须在 FAILED/CANCELLED/UNKNOWN 状态才能重试，当前状态: "
                            + entity.getStatus());
        }

        // retry storm 检测
        if (entity.getRetryCount() >= RETRY_STORM_THRESHOLD) {
            log.warn("Retry storm detected: runId={}, retryCount={}, tenantId={}",
                    runId, entity.getRetryCount(), tenantId);
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.TOO_MANY_REQUESTS,
                    "重试次数已达上限 " + RETRY_STORM_THRESHOLD + "，疑似 retry storm，请联系运维");
        }

        // 高风险动作强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        // 创建新的运行（V0 简化：复用原记录，retry_count + 1，重置状态为 QUEUED）
        entity.setStatus(RunStatus.QUEUED);
        entity.setQueuedAt(Instant.now());
        entity.setStartedAt(null);
        entity.setCompletedAt(null);
        entity.setFailureReason(null);
        entity.setRetryCount(entity.getRetryCount() + 1);
        entity.setParentRunId(entity.getId()); // V0 占位：指向自己，V1 应创建新记录
        entity.setUnknownJob(false);

        SimulationRun saved = runRepository.save(entity);
        log.info("SimulationRun retried: id={}, tenantId={}, retriedBy={}, retryCount={}",
                runId, tenantId, currentUser, saved.getRetryCount());
        return toDto(saved);
    }

    // ── 辅助方法 ──

    private boolean isTerminalStatus(RunStatus status) {
        return status == RunStatus.CONVERGED
                || status == RunStatus.DIVERGED
                || status == RunStatus.CANCELLED
                || status == RunStatus.FAILED;
    }

    private void validateRunExists(UUID tenantId, UUID runId) {
        if (runRepository.findByIdAndTenantId(runId, tenantId).isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    HttpStatus.NOT_FOUND,
                    "SimulationRun not found: " + runId);
        }
    }

    private void validateProblemExists(UUID tenantId, UUID problemId) {
        if (problemRepository.findByIdAndTenantId(problemId, tenantId).isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    HttpStatus.NOT_FOUND,
                    "AnalysisProblem not found: " + problemId);
        }
    }

    private void validateScenarioExists(UUID tenantId, UUID scenarioId) {
        if (scenarioRepository.findByIdAndTenantId(scenarioId, tenantId).isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    HttpStatus.NOT_FOUND,
                    "AnalysisScenario not found: " + scenarioId);
        }
    }

    private SolverProfile validateSolverExists(UUID tenantId, UUID solverProfileId) {
        return solverProfileRepository.findByIdAndTenantId(solverProfileId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SolverProfile not found: " + solverProfileId));
    }

    private void validateStepUpToken(String stepUpToken) {
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "高风险动作必须提供 stepUpToken");
        }
    }

    /**
     * 提取当前操作用户：从 x-user-id 请求头读取
     */
    public String extractCurrentUser(HttpServletRequest request) {
        String userId = request.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED,
                    "缺少 x-user-id 请求头");
        }
        return userId;
    }

    // ── 实体 → DTO ──

    public SimulationRunDto toDto(SimulationRun entity) {
        return new SimulationRunDto(
                entity.getId(),
                entity.getProblemId(),
                entity.getScenarioId(),
                entity.getSolverProfileId(),
                entity.getSolverProfileName(),
                entity.getStatus(),
                entity.getQueuedAt(),
                entity.getStartedAt(),
                entity.getCompletedAt(),
                entity.getSolverVersion(),
                entity.getActualDurationSec(),
                entity.getActualCost(),
                entity.getFailureReason(),
                entity.getRetryCount(),
                entity.getParentRunId(),
                entity.isUnknownJob(),
                entity.getCancelledBy(),
                entity.getCancelReason(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
