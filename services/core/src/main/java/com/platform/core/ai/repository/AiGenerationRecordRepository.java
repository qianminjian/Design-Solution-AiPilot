package com.platform.core.ai.repository;

import com.platform.core.ai.domain.AiGenerationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * AI 生成记录仓储
 */
public interface AiGenerationRecordRepository extends JpaRepository<AiGenerationRecord, UUID> {

    /** 按租户与 ID 查询 */
    Optional<AiGenerationRecord> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按设计选项反查 AI 生成记录（审计追溯：设计选项 → AI 来源） */
    List<AiGenerationRecord> findByTenantIdAndDesignOptionId(UUID tenantId, UUID designOptionId);

    /** 按项目查询 AI 生成记录（按时间倒序） */
    List<AiGenerationRecord> findByTenantIdAndProjectIdOrderByCreatedAtDesc(UUID tenantId, UUID projectId);

    /**
     * 按项目与复核状态查询 AI 生成记录
     * 用于人工复核工作台查询待复核（PENDING）记录
     */
    List<AiGenerationRecord> findByTenantIdAndProjectIdAndReviewStatus(UUID tenantId, UUID projectId, String reviewStatus);

    /** 按 traceId 查询（全链路追溯） */
    Optional<AiGenerationRecord> findByTenantIdAndTraceId(UUID tenantId, String traceId);
}
