package com.platform.core.operations.action.service;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.common.spi.StepUpTokenValidator;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.action.dto.DualApprovalRequest;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.dto.OperationsActionResponseDto;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.connector.service.ConnectorService;
import com.platform.core.operations.domain.enums.DualApprovalStatus;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
import com.platform.core.operations.queue.service.QueueTaskService;
import com.platform.core.operations.worker.service.WorkerService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.List;
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

    /**
     * 危险动作类型 → 风险等级映射
     * 对齐 D37.17 §Operations 危险动作：
     *  - LOW：RESUME（无额外校验）
     *  - MEDIUM：RETRY/RECONCILE/PAUSE（需 impactPreviewAcknowledged）
     *  - HIGH：ISOLATE/FAILOVER（需 stepUpToken + impactPreviewAcknowledged）
     *  - IRREVERSIBLE：CANCEL/DELETE（需双人审批 + stepUpToken + impactPreviewAcknowledged）
     */
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
        // V1.10: DELETE 资源属于不可逆动作，触发双人审批流程
        RISK_LEVEL_MAP.put(OperationsActionType.DELETE, OperationsRiskLevel.IRREVERSIBLE);
    }

    /** 审批间隔最小阈值（5 秒，防误操作） */
    private static final Duration MIN_REVIEW_INTERVAL = Duration.ofSeconds(5);

    private final OperationsActionRepository repository;
    private final WorkerService workerService;
    private final ConnectorService connectorService;
    private final QueueTaskService queueTaskService;
    /**
     * A-61 P1-3 修复：依赖倒置，operations 域通过 StepUpTokenValidator 端口接口
     * 解除对 auth 域 JwtTokenProvider 的直接依赖。
     */
    private final StepUpTokenValidator stepUpTokenValidator;
    /**
     * stepUpToken 哈希盐（A-61 P0-2 修复：从环境变量 STEPUP_TOKEN_SALT 注入，禁止硬编码）
     *
     * <p>对齐 security.md §1 密钥管理：盐值通过环境变量读取，禁止硬编码到源码。
     * V1+ 接入 KMS 后改为从 KMS 动态获取，V0 使用应用配置注入。
     */
    private final String stepUpTokenSalt;

    public OperationsActionService(
            OperationsActionRepository repository,
            WorkerService workerService,
            ConnectorService connectorService,
            QueueTaskService queueTaskService,
            StepUpTokenValidator stepUpTokenValidator,
            @Value("${platform.security.stepup-token-salt:}") String stepUpTokenSalt
    ) {
        this.repository = repository;
        this.workerService = workerService;
        this.connectorService = connectorService;
        this.queueTaskService = queueTaskService;
        this.stepUpTokenValidator = stepUpTokenValidator;
        // 启动时校验盐值非空（对齐 security.md §1：应用启动时必须验证关键配置）
        if (stepUpTokenSalt == null || stepUpTokenSalt.isBlank()) {
            log.warn("platform.security.stepup-token-salt 未配置，stepUpToken 哈希将使用默认弱盐（仅适用于开发环境，生产环境必须配置环境变量 STEPUP_TOKEN_SALT）");
            this.stepUpTokenSalt = "default-dev-salt-DO-NOT-USE-IN-PRODUCTION";
        } else {
            this.stepUpTokenSalt = stepUpTokenSalt;
        }
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

        // 5. 持久化动作记录
        OperationsAction entity = new OperationsAction();
        entity.setTenantId(tenantId);
        entity.setOperationId(generateOperationId());
        entity.setActionType(request.actionType());
        entity.setTargetType(request.targetType());
        entity.setTargetId(request.targetId());
        entity.setRiskLevel(riskLevel);
        entity.setReason(request.reason());
        entity.setImpactPreviewAcknowledged(request.impactPreviewAcknowledged());
        entity.setInitiatedBy(initiatedBy);
        entity.setInitiatedAt(Instant.now());
        entity.setAuditTraceId(generateAuditTraceId());

        // V0 简化：stepUpToken 哈希（V1 接入 KMS SHA-256 + 盐）
        if (request.stepUpToken() != null && !request.stepUpToken().isBlank()) {
            entity.setStepUpTokenHash(hashToken(request.stepUpToken()));
        }

        // V1.9: IRREVERSIBLE 动作进入双人审批流程，不立即执行
        if (riskLevel == OperationsRiskLevel.IRREVERSIBLE) {
            entity.setStatus(OperationsActionStatus.QUEUED);
            entity.setDualApprovalStatus(DualApprovalStatus.PENDING_REVIEW1);
            entity.setAffectedCount(0);
            OperationsAction saved = repository.save(entity);
            log.info("IRREVERSIBLE OperationsAction 进入双人审批待审批人1: operationId={}, tenantId={}, action={}, target={}, initiatedBy={}",
                    saved.getOperationId(), tenantId, request.actionType(), request.targetId(), initiatedBy);
            return toDto(saved);
        }

        // 非 IRREVERSIBLE 动作直接执行（保持 V0 行为）
        entity.setStatus(OperationsActionStatus.RUNNING);
        entity.setDualApprovalStatus(DualApprovalStatus.NOT_REQUIRED);

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
            stepUpTokenValidator.validateStepUpToken(request.stepUpToken());
            log.info("stepUpToken 验证通过 principalId={} purpose={}",
                    stepUpTokenValidator.getPrincipalIdFromToken(request.stepUpToken()),
                    stepUpTokenValidator.getPurposeFromToken(request.stepUpToken()));
        }

        // IRREVERSIBLE 需双人审批（V1.9 真实实现：发起时仅落库，等待审批人 1/2 批准后执行）
        if (riskLevel == OperationsRiskLevel.IRREVERSIBLE) {
            log.info("IRREVERSIBLE 动作发起，进入双人审批流程: action={}, target={}",
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
            // V1.10: DELETE Worker 不可逆，需双人审批后由 approveReview2 调用本方法
            case DELETE -> workerService.deleteWorker(tenantId, targetId, request.reason());
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
            // V1.10: DELETE Connector 不可逆，需双人审批后由 approveReview2 调用本方法
            case DELETE -> connectorService.deleteConnector(tenantId, targetId, request.reason());
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

    /**
     * 解析发起人 ID（A-61 P0-1/P0-4 修复：从 SecurityContext 读取，禁止读 x-user-id 头）
     *
     * <p>对齐 security.md §2.2 认证 Token 红线与 D39 §D39.7 身份多租户授权：
     * <ul>
     *   <li>从 SecurityContext 读取 AuthenticatedPrincipal.principalId（由 JwtAuthenticationFilter 解析 JWT 后注入）</li>
     *   <li>禁止读 x-user-id 头（BFF 已强制覆盖该头，但 Core Service 不应信任 HTTP 头作为身份依据）</li>
     *   <li>认证与授权解耦：JwtAuthenticationFilter 完成认证后注入 SecurityContext，服务层从 SecurityContext 读取身份</li>
     *   <li>httpRequest 为 null（如定时任务调用）或未认证时返回 "system"</li>
     * </ul>
     *
     * @param httpRequest HTTP 请求（保留参数为兼容现有调用方，V1+ 可移除）
     * @return 发起人 principalId 字符串；未认证时返回 "system"
     */
    private String resolveInitiatedBy(HttpServletRequest httpRequest) {
        // A-61 P0-1/P0-4 修复：优先从 SecurityContext 读取已认证主体
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            Object principal = auth.getPrincipal();
            if (principal instanceof AuthenticatedPrincipal ap) {
                UUID principalId = ap.principalId();
                if (principalId != null) {
                    return principalId.toString();
                }
            }
        }
        // 兜底：未认证场景（定时任务、系统调用）返回 "system"
        // httpRequest 参数保留为兼容现有调用方，但不再读取 x-user-id 头
        if (httpRequest == null) {
            return "system";
        }
        return "system";
    }

    /**
     * 计算 stepUpToken 的 SHA-256 + 盐哈希（A-61 P0-2 修复：替换可逆 String.hashCode()）
     *
     * <p>对齐 security.md §2.2 密码存储红线：
     * <ul>
     *   <li>使用 SHA-256 不可逆哈希算法（替代 String.hashCode() 的可逆 32 位哈希）</li>
     *   <li>盐值从环境变量 STEPUP_TOKEN_SALT 注入，禁止硬编码到源码</li>
     *   <li>盐值与 token 拼接后哈希，防止彩虹表攻击</li>
     *   <li>返回十六进制字符串（64 字符），便于存储与比较</li>
     *   <li>V1+ 接入 KMS 后改为从 KMS 动态获取盐值，V0 使用应用配置注入</li>
     * </ul>
     *
     * @param token 原始 stepUpToken
     * @return SHA-256 + 盐的十六进制哈希字符串
     */
    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            // 盐值与 token 拼接后哈希（防止彩虹表攻击）
            byte[] hashBytes = digest.digest((stepUpTokenSalt + ":" + token).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 标准算法，理论不会缺失；兜底降级为 token 的十六进制哈希
            log.error("SHA-256 algorithm not available, falling back to unsafe hash (this should never happen)", e);
            throw new IllegalStateException("SHA-256 algorithm not available in JRE", e);
        }
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
                entity.getRiskLevel(),
                entity.getInitiatedBy(),
                entity.getInitiatedAt(),
                entity.getCompletedAt(),
                entity.getAffectedCount(),
                entity.getAuditTraceId(),
                entity.getErrorMessage(),
                // V1.9 双人审批字段
                entity.getDualApprovalStatus(),
                entity.getReviewer1Id(),
                entity.getReviewer1At(),
                entity.getReviewer2Id(),
                entity.getReviewer2At()
        );
    }

    // ============================================================
    // V1.9 双人审批方法（IRREVERSIBLE 动作）
    // ============================================================

    /**
     * 审批人 1 批准（V1.9）
     *
     * <p>状态机：PENDING_REVIEW1 → PENDING_REVIEW2
     *
     * <p>安全红线：
     * <ul>
     *   <li>审批人 1 ≠ 发起人（initiated_by）</li>
     *   <li>审批人 1 必须提供有效 stepUpToken</li>
     *   <li>审批意见必填</li>
     * </ul>
     */
    @Transactional
    public OperationsActionResponseDto approveReview1(
            UUID tenantId, UUID actionId, DualApprovalRequest request, HttpServletRequest httpRequest
    ) {
        OperationsAction entity = loadAndValidateForReview(tenantId, actionId, DualApprovalStatus.PENDING_REVIEW1);
        String reviewerId = resolveReviewer(httpRequest);
        validateReviewerConstraints(entity, reviewerId, null, request.stepUpToken(), true);

        entity.setReviewer1(reviewerId);
        entity.setReviewer1Id(reviewerId);
        entity.setReviewer1At(Instant.now());
        entity.setReviewer1Comment(request.comment());
        entity.setDualApprovalStatus(DualApprovalStatus.PENDING_REVIEW2);

        OperationsAction saved = repository.save(entity);
        log.info("IRREVERSIBLE OperationsAction 审批人1批准: operationId={}, reviewer1={}, comment={}",
                saved.getOperationId(), reviewerId, request.comment());
        return toDto(saved);
    }

    /**
     * 审批人 1 拒绝（V1.9）
     *
     * <p>状态机：PENDING_REVIEW1 → REJECTED_REVIEW1（终态）
     */
    @Transactional
    public OperationsActionResponseDto rejectReview1(
            UUID tenantId, UUID actionId, DualApprovalRequest request, HttpServletRequest httpRequest
    ) {
        OperationsAction entity = loadAndValidateForReview(tenantId, actionId, DualApprovalStatus.PENDING_REVIEW1);
        String reviewerId = resolveReviewer(httpRequest);
        validateReviewerConstraints(entity, reviewerId, null, request.stepUpToken(), false);

        entity.setReviewer1(reviewerId);
        entity.setReviewer1Id(reviewerId);
        entity.setReviewer1At(Instant.now());
        entity.setReviewer1Comment(request.comment());
        entity.setDualApprovalStatus(DualApprovalStatus.REJECTED_REVIEW1);
        entity.setStatus(OperationsActionStatus.FAILED);
        entity.setCompletedAt(Instant.now());
        entity.setErrorMessage("审批人1拒绝：" + request.comment());

        OperationsAction saved = repository.save(entity);
        log.info("IRREVERSIBLE OperationsAction 审批人1拒绝: operationId={}, reviewer1={}, comment={}",
                saved.getOperationId(), reviewerId, request.comment());
        return toDto(saved);
    }

    /**
     * 审批人 2 批准（V1.9）
     *
     * <p>状态机：PENDING_REVIEW2 → APPROVED（终态）+ 执行实际动作
     *
     * <p>安全红线：
     * <ul>
     *   <li>审批人 2 ≠ 审批人 1 ≠ 发起人（三人不同）</li>
     *   <li>审批人 2 必须提供有效 stepUpToken</li>
     *   <li>审批意见必填</li>
     *   <li>审批间隔 ≥ 5 秒（防误操作）</li>
     *   <li>审批人 2 批准后立即执行实际动作（dispatchAction）</li>
     * </ul>
     */
    @Transactional
    public OperationsActionResponseDto approveReview2(
            UUID tenantId, UUID actionId, DualApprovalRequest request, HttpServletRequest httpRequest
    ) {
        OperationsAction entity = loadAndValidateForReview(tenantId, actionId, DualApprovalStatus.PENDING_REVIEW2);
        String reviewerId = resolveReviewer(httpRequest);
        validateReviewerConstraints(entity, reviewerId, entity.getReviewer1Id(), request.stepUpToken(), true);

        // 审批间隔校验（防误操作）
        validateReviewInterval(entity.getReviewer1At());

        entity.setReviewer2(reviewerId);
        entity.setReviewer2Id(reviewerId);
        entity.setReviewer2At(Instant.now());
        entity.setReviewer2Comment(request.comment());
        entity.setDualApprovalStatus(DualApprovalStatus.APPROVED);

        // 审批人 2 批准后执行实际动作
        try {
            OperationsActionRequest actionReq = new OperationsActionRequest(
                    entity.getActionType(),
                    entity.getTargetType(),
                    entity.getTargetId(),
                    entity.getReason(),
                    null,
                    entity.isImpactPreviewAcknowledged()
            );
            dispatchAction(tenantId, actionReq, entity);
            entity.setStatus(OperationsActionStatus.COMPLETED);
            entity.setCompletedAt(Instant.now());
            entity.setAffectedCount(1);
        } catch (BusinessException ex) {
            entity.setStatus(OperationsActionStatus.FAILED);
            entity.setCompletedAt(Instant.now());
            entity.setErrorMessage("审批通过但执行失败：" + ex.getMessage());
            repository.save(entity);
            throw ex;
        } catch (Exception ex) {
            entity.setStatus(OperationsActionStatus.FAILED);
            entity.setCompletedAt(Instant.now());
            entity.setErrorMessage("审批通过但执行异常：" + (ex.getMessage() != null ? ex.getMessage() : "Unknown"));
            repository.save(entity);
            log.error("IRREVERSIBLE OperationsAction 执行失败: operationId={}", entity.getOperationId(), ex);
            throw new BusinessException(
                    ErrorCode.INTERNAL_ERROR,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "IRREVERSIBLE 动作执行失败: " + ex.getMessage());
        }

        OperationsAction saved = repository.save(entity);
        log.info("IRREVERSIBLE OperationsAction 审批人2批准并执行: operationId={}, reviewer2={}, status={}",
                saved.getOperationId(), reviewerId, saved.getStatus());
        return toDto(saved);
    }

    /**
     * 审批人 2 拒绝（V1.9）
     *
     * <p>状态机：PENDING_REVIEW2 → REJECTED_REVIEW2（终态）
     */
    @Transactional
    public OperationsActionResponseDto rejectReview2(
            UUID tenantId, UUID actionId, DualApprovalRequest request, HttpServletRequest httpRequest
    ) {
        OperationsAction entity = loadAndValidateForReview(tenantId, actionId, DualApprovalStatus.PENDING_REVIEW2);
        String reviewerId = resolveReviewer(httpRequest);
        validateReviewerConstraints(entity, reviewerId, entity.getReviewer1Id(), request.stepUpToken(), false);

        entity.setReviewer2(reviewerId);
        entity.setReviewer2Id(reviewerId);
        entity.setReviewer2At(Instant.now());
        entity.setReviewer2Comment(request.comment());
        entity.setDualApprovalStatus(DualApprovalStatus.REJECTED_REVIEW2);
        entity.setStatus(OperationsActionStatus.FAILED);
        entity.setCompletedAt(Instant.now());
        entity.setErrorMessage("审批人2拒绝：" + request.comment());

        OperationsAction saved = repository.save(entity);
        log.info("IRREVERSIBLE OperationsAction 审批人2拒绝: operationId={}, reviewer2={}, comment={}",
                saved.getOperationId(), reviewerId, request.comment());
        return toDto(saved);
    }

    /** 加载动作并校验状态机（仅指定状态可审批） */
    private OperationsAction loadAndValidateForReview(
            UUID tenantId, UUID actionId, DualApprovalStatus expectedStatus
    ) {
        OperationsAction entity = repository.findByIdAndTenantId(actionId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND,
                        "OperationsAction 不存在: " + actionId));

        if (entity.getRiskLevel() != OperationsRiskLevel.IRREVERSIBLE) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.BAD_REQUEST,
                    "非 IRREVERSIBLE 动作不支持双人审批");
        }

        if (entity.getDualApprovalStatus() != expectedStatus) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.CONFLICT,
                    "动作当前状态 " + entity.getDualApprovalStatus()
                            + " 不允许此操作，期望状态: " + expectedStatus);
        }
        return entity;
    }

    /**
     * 解析审批人 ID（A-61 P0-1/P0-4 修复：从 SecurityContext 读取，禁止读 x-user-id 头）
     *
     * <p>审批人必须已通过 JWT 认证，SecurityContext 中存在 AuthenticatedPrincipal。
     * 未认证时抛 UNAUTHORIZED 异常（禁止匿名审批）。
     *
     * @param httpRequest HTTP 请求（保留为兼容现有调用方，V1+ 可移除）
     * @return 审批人 principalId 字符串
     */
    private String resolveReviewer(HttpServletRequest httpRequest) {
        // A-61 P0-1/P0-4 修复：从 SecurityContext 读取已认证主体
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            Object principal = auth.getPrincipal();
            if (principal instanceof AuthenticatedPrincipal ap) {
                UUID principalId = ap.principalId();
                if (principalId != null) {
                    return principalId.toString();
                }
            }
        }
        throw new BusinessException(
                ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED,
                "审批操作需要已认证的 JWT 主体（SecurityContext 中无 AuthenticatedPrincipal）");
    }

    /**
     * 审批人约束校验
     *
     * @param entity          动作实体
     * @param reviewerId      当前审批人 ID
     * @param reviewer1Id     审批人 1 ID（审批人 2 操作时传入校验不可相同）
     * @param stepUpToken     step-up token（必填）
     * @param isApprove       是否为批准操作（拒绝时 stepUpToken 仍需校验，确保操作人身份）
     */
    private void validateReviewerConstraints(
            OperationsAction entity, String reviewerId, String reviewer1Id,
            String stepUpToken, boolean isApprove
    ) {
        // 审批人 ≠ 发起人
        if (reviewerId.equals(entity.getInitiatedBy())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.FORBIDDEN,
                    "审批人不可与发起人相同（职责分离原则）");
        }

        // 审批人 2 ≠ 审批人 1
        if (reviewer1Id != null && reviewerId.equals(reviewer1Id)) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.FORBIDDEN,
                    "审批人 2 不可与审批人 1 相同（三人不同原则）");
        }

        // stepUpToken 必填且有效
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.BAD_REQUEST,
                    "审批操作必须提供 stepUpToken 二次认证");
        }
        stepUpTokenValidator.validateStepUpToken(stepUpToken);

        log.info("审批人 stepUpToken 校验通过: reviewerId={}, actionId={}, isApprove={}",
                reviewerId, entity.getId(), isApprove);
    }

    /** 审批间隔校验（审批人 1 批准时间到审批人 2 操作时间 ≥ 5 秒，防误操作） */
    private void validateReviewInterval(Instant reviewer1At) {
        if (reviewer1At == null) {
            return; // 理论上不会发生，前置校验已保证状态机
        }
        Duration elapsed = Duration.between(reviewer1At, Instant.now());
        if (elapsed.compareTo(MIN_REVIEW_INTERVAL) < 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.CONFLICT,
                    "审批间隔过短（" + elapsed.toSeconds() + "s），至少需 "
                            + MIN_REVIEW_INTERVAL.getSeconds() + "s 防误操作");
        }
    }

    // ============================================================
    // V1.9.1 查询方法（待审批列表 / 详情查询）
    // ============================================================

    /**
     * 查询 Operations 主动作详情（含双人审批状态）
     * 对应契约：GET /api/v1/operations/action/{actionId}
     */
    @Transactional(readOnly = true)
    public OperationsActionResponseDto getActionDetail(UUID tenantId, UUID actionId) {
        OperationsAction entity = repository.findByIdAndTenantId(actionId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND,
                        "OperationsAction 不存在: " + actionId));
        return toDto(entity);
    }

    /**
     * 按 operationId 查询动作详情（前端使用 operationId 字符串而非 UUID）
     * 对应契约：GET /api/v1/operations/action/by-operation-id/{operationId}
     */
    @Transactional(readOnly = true)
    public OperationsActionResponseDto getActionByOperationId(UUID tenantId, String operationId) {
        OperationsAction entity = repository.findByTenantIdAndOperationId(tenantId, operationId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND,
                        "OperationsAction 不存在: operationId=" + operationId));
        return toDto(entity);
    }

    /**
     * 查询待审批操作列表（D37.23 §不可逆/合规：二人审批）
     *
     * <p>默认查询 PENDING_REVIEW1 + PENDING_REVIEW2 状态的操作，按 initiatedAt 倒序。
     * 审批人可在前端查看待办，点击进入审批流程。
     *
     * @param tenantId   租户 ID
     * @param statuses   要查询的双人审批状态集合（null 时默认查 PENDING_REVIEW1 + PENDING_REVIEW2）
     * @param pageable   分页参数
     */
    @Transactional(readOnly = true)
    public Page<OperationsActionResponseDto> listActionsByDualApprovalStatus(
            UUID tenantId, Collection<DualApprovalStatus> statuses, Pageable pageable
    ) {
        Collection<DualApprovalStatus> targetStatuses = (statuses == null || statuses.isEmpty())
                ? List.of(DualApprovalStatus.PENDING_REVIEW1, DualApprovalStatus.PENDING_REVIEW2)
                : statuses;
        Page<OperationsAction> page = repository.findByTenantIdAndDualApprovalStatusIn(
                tenantId, targetStatuses, pageable);
        return page.map(this::toDto);
    }
}
