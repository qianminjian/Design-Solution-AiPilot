package com.platform.core.operations.action.service;

import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.dto.OperationsActionResponseDto;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.connector.service.ConnectorService;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
import com.platform.core.operations.queue.service.QueueTaskService;
import com.platform.core.operations.worker.service.WorkerService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

/**
 * Operations 主动作服务（D37.17 §危险动作）
 *
 * <p>核心职责：
 * <ul>
 *   <li>校验危险动作约束（riskLevel + stepUpToken + impactPreviewAcknowledged）</li>
 *   <li>分发到目标子域服务（WORKER/CONNECTOR/QUEUE_TASK）</li>
 *   <li>持久化审计记录（operations_action 表 + audit_logs 关联）</li>
 *   <li>retry storm 检测（RETRY 动作 + 阈值检查）</li>
 * </ul>
 *
 * <p>安全红线（D37.17 §Operations 危险动作）：
 * <ul>
 *   <li>LOW（RESUME）：无额外校验</li>
 *   <li>MEDIUM（RETRY/RECONCILE/PAUSE）：需 impactPreviewAcknowledged=true</li>
 *   <li>HIGH（ISOLATE/FAILOVER）：需 stepUpToken + impactPreviewAcknowledged=true</li>
 *   <li>IRREVERSIBLE（CANCEL）：需 stepUpToken + impactPreviewAcknowledged=true + 双人审批（V0 占位通过）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D40-信息-物理安全.md（Step-up 认证）
 * @design D35-API-事件契约.md（危险动作审计）
 */
@Service
public class OperationsActionService {

    private static final Logger log = LoggerFactory.getLogger(OperationsActionService.class);

    /** retry storm 检测阈值：单一目标近期 FAILED 动作数超过 5 次拒绝 RETRY */
    private static final long RETRY_STORM_FAILED_THRESHOLD = 5;

    /** 用户请求头名称 */
    private static final String USER_ID_HEADER = "x-user-id";

    /** 动作类型 → 风险等级映射（对齐前端 OPERATIONS_ACTION_RISK_LEVEL） */
    private static final Map<OperationsActionType, OperationsRiskLevel> RISK_LEVEL_MAP =
            new EnumMap<>(OperationsActionType.class);

    static {
        RISK_LEVEL_MAP.put(OperationsActionType.ISOLATE, OperationsRiskLevel.HIGH);
        RISK_LEVEL_MAP.put(OperationsActionType.RETRY, OperationsRiskLevel.MEDIUM);
        RISK_LEVEL_MAP.put(OperationsActionType.RECONCILE, OperationsRiskLevel.MEDIUM);
        RISK_LEVEL_MAP.put(OperationsActionType.FAILOVER, OperationsRiskLevel.HIGH);
        RISK_LEVEL_MAP.put(OperationsActionType.PAUSE, OperationsRiskLevel.MEDIUM);
        RISK_LEVEL_MAP.put(OperationsActionType.RESUME, OperationsRiskLevel.LOW);
        RISK_LEVEL_MAP.put(OperationsActionType.CANCEL, OperationsRiskLevel.IRREVERSIBLE);
    }

    private final OperationsActionRepository repository;
    private final WorkerService workerService;
    private final ConnectorService connectorService;
    private final QueueTaskService queueTaskService;
    private final JwtTokenProvider jwtTokenProvider;

    public OperationsActionService(
            OperationsActionRepository repository,
            WorkerService workerService,
            ConnectorService connectorService,
            QueueTaskService queueTaskService,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.repository = repository;
        this.workerService = workerService;
        this.connectorService = connectorService;
        this.queueTaskService = queueTaskService;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public OperationsActionResponseDto executeAction(
            UUID tenantId,
            OperationsActionRequest request,
            HttpServletRequest httpRequest
    ) {
        // 1. 解析风险等级
        OperationsRiskLevel riskLevel = RISK_LEVEL_MAP.get(request.actionType());
        if (riskLevel == null) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "未知动作类型: " + request.actionType());
        }

        // 2. 校验危险动作约束
        validateRiskConstraints(request, riskLevel);

        // 3. retry storm 检测（RETRY 动作）
        if (request.actionType() == OperationsActionType.RETRY) {
            detectRetryStorm(tenantId, request.targetId());
        }

        // 4. 解析执行人
        String initiatedBy = resolveInitiatedBy(httpRequest);

        // 5. 持久化动作记录（QUEUED 状态）
        OperationsAction entity = new OperationsAction();
        entity.setTenantId(tenantId);
        entity.setOperationId(generateOperationId());
        entity.setActionType(request.actionType());
        entity.setTargetType(request.targetType());
        entity.setTargetId(request.targetId());
        entity.setRiskLevel(riskLevel);
        entity.setStatus(OperationsActionStatus.RUNNING);
        entity.setReason(request.reason());
        entity.setImpactPreviewAcknowledged(request.impactPreviewAcknowledged());
        entity.setInitiatedBy(initiatedBy);
        entity.setInitiatedAt(Instant.now());
        entity.setAuditTraceId(generateAuditTraceId());

        // V0 简化：stepUpToken 哈希（V1 接入 KMS SHA-256 + 盐）
        if (request.stepUpToken() != null && !request.stepUpToken().isBlank()) {
            entity.setStepUpTokenHash(hashToken(request.stepUpToken()));
        }

        OperationsAction saved = repository.save(entity);
        log.info("OperationsAction queued: operationId={}, tenantId={}, action={}, target={}",
                saved.getOperationId(), tenantId, request.actionType(), request.targetId());

        // 6. 分发到目标子域服务
        try {
            dispatchAction(tenantId, request, saved);
            saved.setStatus(OperationsActionStatus.COMPLETED);
            saved.setCompletedAt(Instant.now());
            saved.setAffectedCount(1);
        } catch (BusinessException ex) {
            saved.setStatus(OperationsActionStatus.FAILED);
            saved.setCompletedAt(Instant.now());
            saved.setErrorMessage(ex.getMessage());
            repository.save(saved);
            throw ex;
        } catch (Exception ex) {
            saved.setStatus(OperationsActionStatus.FAILED);
            saved.setCompletedAt(Instant.now());
            saved.setErrorMessage(ex.getMessage() != null ? ex.getMessage() : "Unknown error");
            repository.save(saved);
            log.error("OperationsAction failed: operationId={}, error={}",
                    saved.getOperationId(), ex.getMessage(), ex);
            throw new BusinessException(
                    ErrorCode.INTERNAL_ERROR,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "OperationsAction 执行失败: " + ex.getMessage());
        }

        OperationsAction completed = repository.save(saved);
        log.info("OperationsAction completed: operationId={}, status={}",
                completed.getOperationId(), completed.getStatus());

        return toDto(completed);
    }

    /** 校验危险动作约束（riskLevel + stepUpToken + impactPreviewAcknowledged） */
    private void validateRiskConstraints(OperationsActionRequest request, OperationsRiskLevel riskLevel) {
        if (riskLevel == OperationsRiskLevel.LOW) {
            return;
        }

        // MEDIUM/HIGH/IRREVERSIBLE 需 impactPreviewAcknowledged=true
        if (!request.impactPreviewAcknowledged()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "风险等级 " + riskLevel + " 必须确认影响预览（impactPreviewAcknowledged=true）");
        }

        // HIGH/IRREVERSIBLE 需 stepUpToken
        if (riskLevel == OperationsRiskLevel.HIGH || riskLevel == OperationsRiskLevel.IRREVERSIBLE) {
            if (request.stepUpToken() == null || request.stepUpToken().isBlank()) {
                throw new BusinessException(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        HttpStatus.BAD_REQUEST,
                        "风险等级 " + riskLevel + " 必须提供 stepUpToken");
            }
            // 验证 stepUpToken 有效性（签名 + 有效期 + 类型）
            jwtTokenProvider.validateStepUpToken(request.stepUpToken());
            log.info("stepUpToken 验证通过 principalId={} purpose={}",
                    jwtTokenProvider.getPrincipalIdFromToken(request.stepUpToken()),
                    jwtTokenProvider.getPurposeFromToken(request.stepUpToken()));
        }

        // IRREVERSIBLE 需双人审批（V0 占位：跳过审批人校验，V1 接入审批工作流）
        if (riskLevel == OperationsRiskLevel.IRREVERSIBLE) {
            log.warn("IRREVERSIBLE 动作执行（V0 占位审批通过）: action={}, target={}",
                    request.actionType(), request.targetId());
        }
    }

    /** retry storm 检测：单一目标近期 FAILED 动作数超过阈值拒绝 RETRY */
    private void detectRetryStorm(UUID tenantId, String targetId) {
        long failedCount = repository.countByTenantIdAndTargetIdAndStatus(
                tenantId, targetId, OperationsActionStatus.FAILED);
        if (failedCount >= RETRY_STORM_FAILED_THRESHOLD) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "检测到 retry storm：目标对象 " + targetId
                            + " 近期 FAILED 动作数=" + failedCount
                            + " 已超过阈值 " + RETRY_STORM_FAILED_THRESHOLD
                            + "，需人工介入");
        }
    }

    /** 分发动作到目标子域服务 */
    private void dispatchAction(UUID tenantId, OperationsActionRequest request, OperationsAction entity) {
        UUID targetUuid = parseTargetId(request.targetId());

        switch (request.targetType()) {
            case WORKER -> dispatchToWorker(tenantId, request, targetUuid);
            case CONNECTOR -> dispatchToConnector(tenantId, request, targetUuid);
            case QUEUE_TASK -> dispatchToQueueTask(tenantId, request, targetUuid);
            default -> throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "未知目标对象类型: " + request.targetType());
        }
    }

    private void dispatchToWorker(UUID tenantId, OperationsActionRequest request, UUID targetId) {
        switch (request.actionType()) {
            case ISOLATE -> workerService.isolateWorker(tenantId, targetId, request.reason());
            case FAILOVER -> workerService.failoverWorker(tenantId, targetId, request.reason());
            case PAUSE -> workerService.pauseWorker(tenantId, targetId);
            case RESUME -> workerService.resumeWorker(tenantId, targetId);
            default -> throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "Worker 不支持的动作: " + request.actionType());
        }
    }

    private void dispatchToConnector(UUID tenantId, OperationsActionRequest request, UUID targetId) {
        switch (request.actionType()) {
            case ISOLATE -> connectorService.isolateConnector(tenantId, targetId, request.reason());
            case FAILOVER -> connectorService.failoverConnector(tenantId, targetId, request.reason());
            case RECONCILE -> connectorService.reconcileConnector(tenantId, targetId, request.reason());
            default -> throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "Connector 不支持的动作: " + request.actionType());
        }
    }

    private void dispatchToQueueTask(UUID tenantId, OperationsActionRequest request, UUID targetId) {
        switch (request.actionType()) {
            case RETRY -> queueTaskService.retryTask(tenantId, targetId);
            case PAUSE -> queueTaskService.pauseTask(tenantId, targetId);
            case RESUME -> queueTaskService.resumeTask(tenantId, targetId);
            case CANCEL -> queueTaskService.cancelTask(tenantId, targetId);
            default -> throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "QueueTask 不支持的动作: " + request.actionType());
        }
    }

    private UUID parseTargetId(String targetId) {
        try {
            return UUID.fromString(targetId);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    HttpStatus.BAD_REQUEST,
                    "targetId 不是有效的 UUID: " + targetId);
        }
    }

    private String resolveInitiatedBy(HttpServletRequest httpRequest) {
        if (httpRequest == null) {
            return "system";
        }
        String userId = httpRequest.getHeader(USER_ID_HEADER);
        return (userId != null && !userId.isBlank()) ? userId : "system";
    }

    /** V0 简化：直接返回 token 字符串作为占位哈希（V1 接入 SHA-256 + 盐 + KMS） */
    private String hashToken(String token) {
        return "v0hash:" + token.hashCode();
    }

    private String generateOperationId() {
        return "OPS-ACT-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String generateAuditTraceId() {
        return "trace-" + UUID.randomUUID();
    }

    private OperationsActionResponseDto toDto(OperationsAction entity) {
        return new OperationsActionResponseDto(
                entity.getOperationId(),
                entity.getActionType(),
                entity.getTargetId(),
                entity.getStatus(),
                entity.getInitiatedAt(),
                entity.getCompletedAt(),
                entity.getAffectedCount(),
                entity.getAuditTraceId()
        );
    }
}
