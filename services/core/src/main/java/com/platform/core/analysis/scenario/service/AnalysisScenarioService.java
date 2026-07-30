package com.platform.core.analysis.scenario.service;

import com.platform.core.analysis.problem.domain.AnalysisProblem;
import com.platform.core.analysis.problem.repository.AnalysisProblemRepository;
import com.platform.core.analysis.scenario.domain.AnalysisScenario;
import com.platform.core.analysis.scenario.dto.AnalysisScenarioDto;
import com.platform.core.analysis.scenario.dto.CreateAnalysisScenarioRequest;
import com.platform.core.analysis.scenario.repository.AnalysisScenarioRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 分析场景服务（D37.14 P10）
 *
 * <p>核心操作：
 *  - listScenarios：按问题 ID 查询场景列表
 *  - getScenario：单条详情
 *  - createScenario：创建场景（AI 推荐场景须人工确认）
 *  - updateScenario：更新场景
 *  - deleteScenario：删除场景
 *
 * 安全红线：
 *  - AI 推荐场景（isAiRecommended=true）须人工确认后才可用于运行
 *  - 基线场景（isBaseline=true）每个问题唯一
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Service
public class AnalysisScenarioService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisScenarioService.class);

    private final AnalysisScenarioRepository scenarioRepository;
    private final AnalysisProblemRepository problemRepository;

    public AnalysisScenarioService(
            AnalysisScenarioRepository scenarioRepository,
            AnalysisProblemRepository problemRepository
    ) {
        this.scenarioRepository = scenarioRepository;
        this.problemRepository = problemRepository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public List<AnalysisScenarioDto> listScenarios(UUID tenantId, UUID problemId) {
        validateProblemExists(tenantId, problemId);
        return scenarioRepository.findAllByTenantIdAndProblemId(tenantId, problemId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AnalysisScenarioDto getScenario(UUID tenantId, UUID problemId, UUID scenarioId) {
        validateProblemExists(tenantId, problemId);
        AnalysisScenario entity = scenarioRepository.findByIdAndTenantId(scenarioId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisScenario not found: " + scenarioId));
        if (!entity.getProblemId().equals(problemId)) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "场景不属于指定问题: problemId=" + problemId);
        }
        return toDto(entity);
    }

    // ── 创建/更新/删除 ──

    @Transactional
    public AnalysisScenarioDto createScenario(
            UUID tenantId,
            UUID problemId,
            String currentUser,
            CreateAnalysisScenarioRequest request
    ) {
        validateProblemExists(tenantId, problemId);

        // 基线场景唯一性校验
        if (request.isBaseline()) {
            scenarioRepository.findByTenantIdAndProblemIdAndBaselineTrue(tenantId, problemId)
                    .ifPresent(existing -> {
                        throw new BusinessException(
                                ErrorCode.BUSINESS_RULE_VIOLATION,
                                HttpStatus.CONFLICT,
                                "问题已存在基线场景: scenarioId=" + existing.getId());
                    });
        }

        AnalysisScenario entity = new AnalysisScenario();
        entity.setTenantId(tenantId);
        entity.setProblemId(problemId);
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setScenarioType(request.scenarioType());
        entity.setParameters(request.parameters() != null ? request.parameters() : "{}");
        entity.setBaseline(request.isBaseline());
        entity.setAiRecommended(request.isAiRecommended());
        entity.setAiRecommendationReason(request.aiRecommendationReason());

        // AI 推荐场景须人工确认（V0 占位：创建时未确认）
        if (request.isAiRecommended()) {
            entity.setConfirmedBy(null);
            entity.setConfirmedAt(null);
        } else {
            // 非 AI 推荐场景直接视为已确认
            entity.setConfirmedBy(currentUser);
            entity.setConfirmedAt(Instant.now());
        }

        AnalysisScenario saved = scenarioRepository.save(entity);
        log.info("AnalysisScenario created: id={}, problemId={}, tenantId={}, isAiRecommended={}",
                saved.getId(), problemId, tenantId, request.isAiRecommended());
        return toDto(saved);
    }

    @Transactional
    public AnalysisScenarioDto updateScenario(
            UUID tenantId,
            UUID problemId,
            UUID scenarioId,
            CreateAnalysisScenarioRequest request
    ) {
        validateProblemExists(tenantId, problemId);
        AnalysisScenario entity = scenarioRepository.findByIdAndTenantId(scenarioId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisScenario not found: " + scenarioId));
        if (!entity.getProblemId().equals(problemId)) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "场景不属于指定问题");
        }

        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setScenarioType(request.scenarioType());
        entity.setParameters(request.parameters() != null ? request.parameters() : "{}");

        AnalysisScenario saved = scenarioRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void deleteScenario(UUID tenantId, UUID problemId, UUID scenarioId) {
        validateProblemExists(tenantId, problemId);
        AnalysisScenario entity = scenarioRepository.findByIdAndTenantId(scenarioId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisScenario not found: " + scenarioId));
        if (!entity.getProblemId().equals(problemId)) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "场景不属于指定问题");
        }
        scenarioRepository.delete(entity);
        log.info("AnalysisScenario deleted: id={}, problemId={}", scenarioId, problemId);
    }

    // ── 辅助方法 ──

    private void validateProblemExists(UUID tenantId, UUID problemId) {
        if (problemRepository.findByIdAndTenantId(problemId, tenantId).isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    HttpStatus.NOT_FOUND,
                    "AnalysisProblem not found: " + problemId);
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

    public AnalysisScenarioDto toDto(AnalysisScenario entity) {
        return new AnalysisScenarioDto(
                entity.getId(),
                entity.getProblemId(),
                entity.getName(),
                entity.getDescription(),
                entity.getScenarioType(),
                entity.getParameters(),
                entity.isBaseline(),
                entity.isAiRecommended(),
                entity.getAiRecommendationReason(),
                entity.getConfirmedBy(),
                entity.getConfirmedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
