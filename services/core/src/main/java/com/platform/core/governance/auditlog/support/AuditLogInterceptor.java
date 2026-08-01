package com.platform.core.governance.auditlog.support;

import com.platform.core.common.response.BusinessException;
import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.domain.AuditObject;
import com.platform.core.governance.auditlog.service.AsyncAuditWriter;
import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import com.platform.core.common.security.AuthenticatedPrincipal;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 审计日志拦截器
 *
 * 拦截所有写操作（POST/PATCH/PUT/DELETE），自动记录到 governance.audit_log 表。
 *
 * 设计要点：
 *  - 仅拦截写操作（GET 不记录，避免噪音）
 *  - 在 afterCompletion 阶段写入（确保响应状态可用）
 *  - 异步写入：不阻塞主请求线程
 *  - 异常容错：审计失败不影响主流程
 *  - 自动脱敏：默认 masked=true，详细信息仅记录必要字段
 *
 * 拦截顺序：
 *  - preHandle：仅记录请求开始时间，不阻断
 *  - afterCompletion：解析 actor / category / action / result，异步写入
 */
public class AuditLogInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuditLogInterceptor.class);

    /** 请求开始时间属性 key */
    private static final String START_TIME_ATTR = "auditLog.startTime";

    /** 业务异常属性 key（由 GlobalExceptionHandler 设置） */
    private static final String BUSINESS_EXCEPTION_ATTR = "auditLog.businessException";

    private final AsyncAuditWriter asyncWriter;
    private final AuditActionEvaluator evaluator;

    public AuditLogInterceptor(
            AsyncAuditWriter asyncWriter,
            AuditActionEvaluator evaluator
    ) {
        this.asyncWriter = asyncWriter;
        this.evaluator = evaluator;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 仅记录写操作
        if (!isWriteOperation(request)) {
            return true;
        }
        request.setAttribute(START_TIME_ATTR, Instant.now());
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) {
        // no-op：不在 postHandle 写入，避免 ModelAndView 异常影响审计
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        if (!isWriteOperation(request)) {
            return;
        }
        try {
            writeAuditLog(request, response, ex);
        } catch (Exception auditEx) {
            log.error("Failed to write audit log: {}", auditEx.getMessage(), auditEx);
        }
    }

    private boolean isWriteOperation(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase();
        return method.equals("POST")
                || method.equals("PATCH")
                || method.equals("PUT")
                || method.equals("DELETE");
    }

    private void writeAuditLog(HttpServletRequest request, HttpServletResponse response, Exception ex) {
        Instant startTime = (Instant) request.getAttribute(START_TIME_ATTR);
        if (startTime == null) {
            startTime = Instant.now();
        }

        // 解析租户 ID（优先从 ThreadLocal，其次从 header）
        Optional<UUID> tenantOpt = TenantContextHolder.getTenantId();
        UUID tenantId = tenantOpt.orElseGet(() -> parseUuidHeader(request, "x-tenant-id"));
        if (tenantId == null) {
            // 无租户上下文：跳过审计（可能是登录前调用）
            return;
        }

        // 解析 actor
        AuditActor actor = resolveActor(request);

        // 解析 category / riskLevel / action
        GovernanceAuditCategory category = evaluator.resolveCategory(request);
        GovernanceRiskLevel riskLevel = evaluator.resolveRiskLevel(request, category);
        String action = evaluator.resolveAction(request);

        // 解析 object
        AuditObject object = resolveObject(request);

        // 解析 result
        GovernanceResult result = resolveResult(response, ex);

        // traceId
        String traceId = org.slf4j.MDC.get("traceId");

        // P0-1.2 测试数据隔离：从 MDC 读取 testRunId（由 TestRunIdFilter 注入）
        String testRunId = org.slf4j.MDC.get("testRunId");

        // 自动脱敏：高敏感字段不写详情
        boolean masked = true;
        String details = buildDetails(request, response, startTime, riskLevel);

        asyncWriter.writeAsync(
                tenantId,
                startTime,
                actor,
                action,
                category,
                object,
                traceId,
                result,
                riskLevel,
                masked,
                resolveClientIp(request),
                request.getHeader("User-Agent"),
                details,
                testRunId
        );
    }

    private AuditActor resolveActor(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedPrincipal principal) {
            return new AuditActor(
                    principal.principalId().toString(),
                    principal.email(),
                    GovernanceAuditActorType.USER
            );
        }
        // 兜底：从 header 取 x-user-id
        String userId = request.getHeader("x-user-id");
        if (userId != null && !userId.isBlank()) {
            return new AuditActor(
                    userId,
                    userId,
                    GovernanceAuditActorType.USER
            );
        }
        return AsyncAuditWriter.anonymousActor();
    }

    private AuditObject resolveObject(HttpServletRequest request) {
        String path = request.getRequestURI();
        String[] segments = path.split("/");
        if (segments.length >= 5) {
            // /api/v1/{resource}/{id}
            String resourceType = segments[3];
            String id = segments[4];
            return new AuditObject(
                    toObjectType(resourceType),
                    id,
                    toObjectName(resourceType)
            );
        }
        if (segments.length >= 4) {
            String resourceType = segments[3];
            return new AuditObject(
                    toObjectType(resourceType),
                    "unknown",
                    toObjectName(resourceType)
            );
        }
        return new AuditObject("unknown", "unknown", "unknown");
    }

    private GovernanceResult resolveResult(HttpServletResponse response, Exception ex) {
        if (ex != null) {
            if (ex instanceof BusinessException) {
                return GovernanceResult.FAILURE;
            }
            return GovernanceResult.ERROR;
        }
        int status = response.getStatus();
        if (status >= 200 && status < 300) {
            return GovernanceResult.SUCCESS;
        }
        if (status == 401 || status == 403) {
            return GovernanceResult.DENIED;
        }
        if (status >= 500) {
            return GovernanceResult.ERROR;
        }
        return GovernanceResult.FAILURE;
    }

    private String buildDetails(
            HttpServletRequest request,
            HttpServletResponse response,
            Instant startTime,
            GovernanceRiskLevel riskLevel
    ) {
        long durationMs = System.currentTimeMillis() - startTime.toEpochMilli();
        return String.format(
                "{\"method\":\"%s\",\"path\":\"%s\",\"status\":%d,\"durationMs\":%d,\"riskLevel\":\"%s\"}",
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus(),
                durationMs,
                riskLevel.name()
        );
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private UUID parseUuidHeader(HttpServletRequest request, String headerName) {
        String value = request.getHeader(headerName);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String toObjectType(String resource) {
        return resource.replace("-", "_");
    }

    private String toObjectName(String resource) {
        // 资源名作为 display name（V1 简化，V2 可查询实体名）
        return resource;
    }
}
