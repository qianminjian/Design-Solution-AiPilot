package com.platform.core.change.taskplan.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.change.affecteditem.domain.AffectedItem;
import com.platform.core.change.affecteditem.repository.AffectedItemRepository;
import com.platform.core.change.domain.enums.TaskPlanStatus;
import com.platform.core.change.taskplan.domain.TaskPlanItem;
import com.platform.core.change.taskplan.dto.CreateTaskPlanItemRequest;
import com.platform.core.change.taskplan.dto.GenerateTaskPlanRequest;
import com.platform.core.change.taskplan.dto.TaskPlanItemDto;
import com.platform.core.change.taskplan.dto.UpdateTaskPlanItemRequest;
import com.platform.core.change.taskplan.repository.TaskPlanItemRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 处置任务服务（D37.16 P12 变更影响与闭环工作台）
 *
 * 核心操作：
 *  - listTaskPlanItems：按变更请求 ID 查询处置任务
 *  - getTaskPlanItem：单条详情
 *  - createTaskPlanItem：手动创建任务
 *  - updateTaskPlanItem：更新任务
 *  - deleteTaskPlanItem：删除任务
 *  - generateTaskPlan：基于受影响项自动生成任务
 *  - completeTaskPlanItem：完成任务
 *  - skipTaskPlanItem：跳过任务（须审批记录）
 *
 * 安全红线：
 *  - 关闭前所有 blocksClosure=true 的任务必须 COMPLETED 或 SKIPPED
 *  - SKIPPED 必须填写 skipReason 和 skipApprovedBy
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Service
public class TaskPlanItemService {

    private static final Logger log = LoggerFactory.getLogger(TaskPlanItemService.class);

    private final TaskPlanItemRepository repository;
    private final AffectedItemRepository affectedItemRepository;
    private final ObjectMapper objectMapper;

    public TaskPlanItemService(
            TaskPlanItemRepository repository,
            AffectedItemRepository affectedItemRepository,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.affectedItemRepository = affectedItemRepository;
        this.objectMapper = objectMapper;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public List<TaskPlanItemDto> listTaskPlanItems(UUID tenantId, UUID changeId) {
        return repository.findAllByTenantIdAndChangeId(tenantId, changeId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskPlanItemDto getTaskPlanItem(UUID tenantId, UUID id) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));
        return toDto(entity);
    }

    // ── 创建/更新/删除 ──

    @Transactional
    public TaskPlanItemDto createTaskPlanItem(
            UUID tenantId,
            UUID changeId,
            CreateTaskPlanItemRequest request
    ) {
        TaskPlanItem entity = new TaskPlanItem();
        entity.setTenantId(tenantId);
        entity.setChangeId(changeId);
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setAssignee(request.assignee());
        entity.setDiscipline(request.discipline());
        entity.setStatus(TaskPlanStatus.PENDING);
        entity.setDueDate(request.dueDate());
        entity.setAffectedItemIds(serializeIds(request.affectedItemIds()));
        entity.setPriority(request.priority());
        entity.setSequenceOrder(request.sequenceOrder());
        entity.setBlocksClosure(request.blocksClosure());

        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem created: id={}, changeId={}, tenantId={}, assignee={}",
                saved.getId(), changeId, tenantId, saved.getAssignee());
        return toDto(saved);
    }

    @Transactional
    public TaskPlanItemDto updateTaskPlanItem(
            UUID tenantId,
            UUID id,
            UpdateTaskPlanItemRequest request
    ) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));

        if (entity.getStatus() == TaskPlanStatus.COMPLETED
                || entity.getStatus() == TaskPlanStatus.CANCELLED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "TaskPlanItem 已完成或已取消，不可编辑");
        }

        if (request.title() != null && !request.title().isBlank()) {
            entity.setTitle(request.title());
        }
        if (request.description() != null) {
            entity.setDescription(request.description());
        }
        if (request.assignee() != null && !request.assignee().isBlank()) {
            entity.setAssignee(request.assignee());
        }
        if (request.discipline() != null) {
            entity.setDiscipline(request.discipline());
        }
        if (request.dueDate() != null) {
            entity.setDueDate(request.dueDate());
        }
        if (request.priority() != null) {
            entity.setPriority(request.priority());
        }
        if (request.sequenceOrder() != null) {
            entity.setSequenceOrder(request.sequenceOrder());
        }
        if (request.blocksClosure() != null) {
            entity.setBlocksClosure(request.blocksClosure());
        }

        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem updated: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    @Transactional
    public void deleteTaskPlanItem(UUID tenantId, UUID id) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));
        if (entity.getStatus() == TaskPlanStatus.COMPLETED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "已完成的任务不可删除");
        }
        repository.delete(entity);
        log.info("TaskPlanItem deleted: id={}, tenantId={}", id, tenantId);
    }

    // ── 状态流转 ──

    @Transactional
    public TaskPlanItemDto startTaskPlanItem(UUID tenantId, UUID id) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));

        if (entity.getStatus() != TaskPlanStatus.PENDING) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "TaskPlanItem 必须在 PENDING 状态才能启动，当前: " + entity.getStatus());
        }

        entity.setStatus(TaskPlanStatus.IN_PROGRESS);
        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem started: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    @Transactional
    public TaskPlanItemDto completeTaskPlanItem(
            UUID tenantId,
            UUID id,
            String completedBy
    ) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));

        if (entity.getStatus() != TaskPlanStatus.IN_PROGRESS) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "TaskPlanItem 必须在 IN_PROGRESS 状态才能完成，当前: " + entity.getStatus());
        }

        entity.setStatus(TaskPlanStatus.COMPLETED);
        entity.setCompletedAt(Instant.now());
        entity.setCompletedBy(completedBy);

        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem completed: id={}, tenantId={}, completedBy={}",
                id, tenantId, completedBy);
        return toDto(saved);
    }

    @Transactional
    public TaskPlanItemDto skipTaskPlanItem(
            UUID tenantId,
            UUID id,
            String skipReason,
            String skipApprovedBy
    ) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));

        if (entity.getStatus() == TaskPlanStatus.COMPLETED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "已完成的任务不可跳过");
        }

        if (skipReason == null || skipReason.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "跳过任务必须填写 skipReason");
        }
        if (skipApprovedBy == null || skipApprovedBy.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "跳过任务必须填写 skipApprovedBy（审批人）");
        }

        entity.setStatus(TaskPlanStatus.SKIPPED);
        entity.setSkipReason(skipReason);
        entity.setSkipApprovedBy(skipApprovedBy);

        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem skipped: id={}, tenantId={}, approvedBy={}",
                id, tenantId, skipApprovedBy);
        return toDto(saved);
    }

    @Transactional
    public TaskPlanItemDto cancelTaskPlanItem(UUID tenantId, UUID id) {
        TaskPlanItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "TaskPlanItem not found: " + id));

        if (entity.getStatus() == TaskPlanStatus.COMPLETED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "已完成的任务不可取消");
        }

        entity.setStatus(TaskPlanStatus.CANCELLED);
        TaskPlanItem saved = repository.save(entity);
        log.info("TaskPlanItem cancelled: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    // ── 自动生成（基于受影响项） ──

    /**
     * 基于受影响项自动生成处置任务
     *
     * <p>V0 简化实现：每个受影响项生成一个默认任务，按专业聚合。
     * V1 完整实现：调用规则引擎/AI 辅助生成任务模板。
     *
     * @param tenantId 租户 ID
     * @param changeId 变更请求 ID
     * @param request 生成请求（含默认责任人、默认完成时间）
     * @return 生成的任务列表
     */
    @Transactional
    public List<TaskPlanItemDto> generateTaskPlan(
            UUID tenantId,
            UUID changeId,
            GenerateTaskPlanRequest request
    ) {
        List<AffectedItem> affectedItems = affectedItemRepository
                .findAllByTenantIdAndChangeId(tenantId, changeId);

        if (affectedItems.isEmpty()) {
            log.info("TaskPlan generation skipped: no affected items, changeId={}", changeId);
            return Collections.emptyList();
        }

        Instant defaultDueDate = request.defaultDueDate() != null
                ? Instant.parse(request.defaultDueDate())
                : Instant.now().plusSeconds(7 * 24 * 3600L); // 默认 7 天

        List<TaskPlanItem> tasks = new ArrayList<>();
        int sequence = 1;
        for (AffectedItem affected : affectedItems) {
            // 跳过 NO_IMPACT 项
            if (affected.getImpact() == com.platform.core.change.domain.enums.ImpactLevel.NO_IMPACT) {
                continue;
            }

            TaskPlanItem task = new TaskPlanItem();
            task.setTenantId(tenantId);
            task.setChangeId(changeId);
            task.setTitle(String.format("处置 %s: %s", affected.getCode(), affected.getName()));
            task.setDescription("基于受影响项自动生成: " + affected.getEvidence());
            task.setAssignee(request.defaultAssignee());
            task.setDiscipline(affected.getDiscipline());
            task.setStatus(TaskPlanStatus.PENDING);
            task.setDueDate(defaultDueDate);
            task.setAffectedItemIds("[\"" + affected.getId() + "\"]");
            task.setPriority("MEDIUM");
            task.setSequenceOrder(sequence++);
            task.setBlocksClosure(true);

            tasks.add(task);
        }

        List<TaskPlanItem> saved = repository.saveAll(tasks);
        log.info("TaskPlan generated: changeId={}, count={}", changeId, saved.size());
        return saved.stream().map(this::toDto).toList();
    }

    // ── 统计（供 ChangeRequestService 关闭校验使用） ──

    @Transactional(readOnly = true)
    public long countBlockingTasks(UUID tenantId, UUID changeId) {
        long pending = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, TaskPlanStatus.PENDING);
        long inProgress = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, TaskPlanStatus.IN_PROGRESS);
        long blocked = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, TaskPlanStatus.BLOCKED);
        return pending + inProgress + blocked;
    }

    @Transactional(readOnly = true)
    public long countByChangeId(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeId(tenantId, changeId);
    }

    // ── 实体 → DTO ──

    public TaskPlanItemDto toDto(TaskPlanItem entity) {
        return new TaskPlanItemDto(
                entity.getId(),
                entity.getChangeId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getAssignee(),
                entity.getDiscipline(),
                entity.getStatus(),
                entity.getDueDate(),
                entity.getCompletedAt(),
                entity.getCompletedBy(),
                parseIds(entity.getAffectedItemIds()),
                entity.getPriority(),
                entity.getSequenceOrder(),
                entity.isBlocksClosure(),
                entity.getSkipReason(),
                entity.getSkipApprovedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String serializeIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(ids);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize affectedItemIds: {}", ids, e);
            return "[]";
        }
    }

    private List<String> parseIds(String json) {
        if (json == null || json.isBlank() || "[]".equals(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse affectedItemIds: {}", json, e);
            return Collections.emptyList();
        }
    }
}
