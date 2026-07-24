package com.platform.core.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.ai.domain.AiGenerationRecord;
import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.repository.AiGenerationRecordRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AI 生成记录服务 — 审计追溯
 */
@Service
public class AiGenerationRecordService {

    private final AiGenerationRecordRepository repository;
    private final ObjectMapper objectMapper;

    public AiGenerationRecordService(AiGenerationRecordRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /** 创建 AI 生成记录 */
    @Transactional
    public AiGenerationRecordDto create(UUID tenantId, CreateAiGenerationRecordRequest request, UUID userId) {
        AiGenerationRecord entity = new AiGenerationRecord();
        entity.setTenantId(tenantId);
        entity.setProjectId(request.projectId());
        entity.setDesignOptionId(request.designOptionId());
        entity.setPromptTemplate(request.promptTemplate());
        entity.setRenderedPrompt(request.renderedPrompt());
        entity.setRawContent(request.rawContent());
        entity.setModel(request.model());
        entity.setRiskLevel(request.riskLevel());
        entity.setRequiresHumanReview(request.requiresHumanReview() != null ? request.requiresHumanReview() : true);
        entity.setLatencyMs(request.latencyMs() != null ? request.latencyMs() : 0);
        entity.setTraceId(request.traceId());
        entity.setCreatedBy(userId);
        entity.setUpdatedBy(userId);

        // JSONB 字段序列化
        entity.setVariables(toJson(request.variables()));
        entity.setCandidates(toJson(request.candidates()));
        entity.setTokenUsage(toJson(request.tokenUsage()));
        entity.setGuardrailResult(toJson(request.guardrailResult()));

        AiGenerationRecord saved = repository.save(entity);
        return toDto(saved);
    }

    /** 查询 AI 生成记录详情 */
    @Transactional(readOnly = true)
    public AiGenerationRecordDto get(UUID tenantId, UUID id) {
        AiGenerationRecord record = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "AI 生成记录不存在"));
        return toDto(record);
    }

    /** 按设计选项反查 AI 生成记录（审计追溯：设计选项 → AI 来源） */
    @Transactional(readOnly = true)
    public List<AiGenerationRecordDto> listByDesignOption(UUID tenantId, UUID designOptionId) {
        return repository.findByTenantIdAndDesignOptionId(tenantId, designOptionId).stream()
                .map(this::toDto)
                .toList();
    }

    /** 按项目查询 AI 生成记录（按时间倒序） */
    @Transactional(readOnly = true)
    public List<AiGenerationRecordDto> listByProject(UUID tenantId, UUID projectId) {
        return repository.findByTenantIdAndProjectIdOrderByCreatedAtDesc(tenantId, projectId).stream()
                .map(this::toDto)
                .toList();
    }

    /** 关联设计选项（接受候选为设计选项时调用） */
    @Transactional
    public AiGenerationRecordDto linkDesignOption(UUID tenantId, UUID recordId, UUID designOptionId) {
        AiGenerationRecord record = repository.findByIdAndTenantId(recordId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "AI 生成记录不存在"));
        record.setDesignOptionId(designOptionId);
        AiGenerationRecord saved = repository.save(record);
        return toDto(saved);
    }

    private AiGenerationRecordDto toDto(AiGenerationRecord e) {
        return new AiGenerationRecordDto(
                e.getId(), e.getTenantId(), e.getProjectId(), e.getDesignOptionId(),
                e.getPromptTemplate(),
                fromJson(e.getVariables()),
                e.getRenderedPrompt(), e.getRawContent(),
                fromJson(e.getCandidates()),
                e.getModel(),
                fromJson(e.getTokenUsage()),
                e.getRiskLevel(),
                fromJson(e.getGuardrailResult()),
                e.getRequiresHumanReview(), e.getLatencyMs(), e.getTraceId(),
                e.getCreatedBy(), e.getCreatedAt(), e.getUpdatedAt(), e.getRowVersion()
        );
    }

    private String toJson(Map<String, Object> map) {
        if (map == null) return null;
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException ex) {
            // 数据异常时返回原始字符串包装，避免查询失败
            return Map.of("_raw", json);
        }
    }
}
