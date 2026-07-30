package com.platform.core.governance.auditlog.support;

import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * 审计日志分类与风险等级评估器
 *
 * <p>解析规则 (按 URL 前缀匹配):
 * <ul>
 *   <li>/api/v1/auth/&#42;&#42; = AUTH 类, 风险 MEDIUM (登录/登出/刷新)</li>
 *   <li>/api/v1/access-grants/&#42;&#42;/actions = GOVERNANCE 类, 风险 HIGH</li>
 *   <li>/api/v1/releases/&#42;&#42;/actions = GOVERNANCE 类, 风险 HIGH</li>
 *   <li>/api/v1/data-assets/&#42;&#42;/actions = GOVERNANCE 类, 风险 HIGH (DELETE 操作为 CRITICAL)</li>
 *   <li>/api/v1/evidence-packages/&#42;&#42;/actions = GOVERNANCE 类, 风险 HIGH</li>
 *   <li>/api/v1/backups/&#42;&#42;/restore = GOVERNANCE 类, 风险 CRITICAL</li>
 *   <li>/api/v1/restore-drills = GOVERNANCE 类, 风险 HIGH</li>
 *   <li>/api/v1/compliance-rules/&#42;&#42; = GOVERNANCE 类, 风险 MEDIUM</li>
 *   <li>/api/v1/projects/&#42;&#42; = DATA 类, 风险 MEDIUM</li>
 *   <li>/api/v1/documents/&#42;&#42; = DATA 类, 风险 MEDIUM</li>
 *   <li>/api/v1/ai/&#42;&#42; = AI 类, 风险 HIGH</li>
 *   <li>其他写操作 = ADMIN 类, 风险 MEDIUM</li>
 * </ul>
 *
 * <p>设计原则:
 * <ul>
 *   <li>默认宽松匹配, 未匹配的写操作降级到 ADMIN/MEDIUM</li>
 *   <li>高风险操作 (DELETE/恢复/破窗) 必须显式升级到 CRITICAL</li>
 * </ul>
 */
@Component
public class AuditActionEvaluator {

    /**
     * 解析审计分类
     */
    public GovernanceAuditCategory resolveCategory(HttpServletRequest request) {
        String path = normalizePath(request.getRequestURI());
        if (path.startsWith("/api/v1/auth/")) {
            return GovernanceAuditCategory.AUTH;
        }
        if (path.startsWith("/api/v1/access-grants")
                || path.startsWith("/api/v1/releases")
                || path.startsWith("/api/v1/data-assets")
                || path.startsWith("/api/v1/evidence-packages")
                || path.startsWith("/api/v1/backups")
                || path.startsWith("/api/v1/restore-drills")
                || path.startsWith("/api/v1/compliance-rules")
                || path.startsWith("/api/v1/compliance-check-runs")
                || path.startsWith("/api/v1/rule-sets")
                || path.startsWith("/api/v1/findings")) {
            return GovernanceAuditCategory.GOVERNANCE;
        }
        if (path.startsWith("/api/v1/ai/")
                || path.startsWith("/api/v1/ai-generation-records")) {
            return GovernanceAuditCategory.AI;
        }
        if (path.startsWith("/api/v1/projects")
                || path.startsWith("/api/v1/documents")
                || path.startsWith("/api/v1/stages")
                || path.startsWith("/api/v1/baselines")
                || path.startsWith("/api/v1/gates")
                || path.startsWith("/api/v1/design-options")) {
            return GovernanceAuditCategory.DATA;
        }
        if (path.startsWith("/api/v1/principals")
                || path.startsWith("/api/v1/organizations")
                || path.startsWith("/api/v1/memberships")
                || path.startsWith("/api/v1/role-bindings")) {
            return GovernanceAuditCategory.ADMIN;
        }
        return GovernanceAuditCategory.ADMIN;
    }

    /**
     * 解析风险等级
     *
     * 升级规则：
     *  - 所有 /actions 子路径 (治理域操作) -> HIGH
     *  - DELETE 方法 -> CRITICAL (不可逆操作)
     *  - /restore 子路径 -> CRITICAL (生产恢复)
     *  - /actions + action=revoke/rollback/delete -> CRITICAL
     */
    public GovernanceRiskLevel resolveRiskLevel(
            HttpServletRequest request,
            GovernanceAuditCategory category
    ) {
        String method = request.getMethod().toUpperCase();
        String path = normalizePath(request.getRequestURI());

        if (method.equals("DELETE")) {
            return GovernanceRiskLevel.CRITICAL;
        }
        if (path.endsWith("/restore") || path.contains("/restore-drills")) {
            return GovernanceRiskLevel.CRITICAL;
        }
        if (path.endsWith("/actions")) {
            String action = request.getParameter("action");
            if (action != null) {
                String lower = action.toLowerCase();
                if (lower.contains("revoke")
                        || lower.contains("rollback")
                        || lower.contains("delete")
                        || lower.contains("seal")
                        || lower.contains("promote")) {
                    return GovernanceRiskLevel.CRITICAL;
                }
            }
            return GovernanceRiskLevel.HIGH;
        }
        if (category == GovernanceAuditCategory.AUTH) {
            return GovernanceRiskLevel.MEDIUM;
        }
        if (category == GovernanceAuditCategory.AI) {
            return GovernanceRiskLevel.HIGH;
        }
        return GovernanceRiskLevel.MEDIUM;
    }

    /**
     * 解析操作名称（用于审计日志的 action 字段）
     *
     * 格式：{domain}.{resource}.{verb}
     * 示例：governance.access_grants.revoke / data.projects.create
     */
    public String resolveAction(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase();
        String path = normalizePath(request.getRequestURI());
        String[] segments = path.split("/");
        if (segments.length < 4) {
            return "unknown." + method.toLowerCase();
        }
        // segments[0]="" segments[1]="api" segments[2]="v1" segments[3]=资源名
        String resource = segments[3];
        String verb = mapMethodToVerb(method);

        // 处理 /actions 子路径
        if (path.endsWith("/actions") && segments.length >= 5) {
            // 取父级资源作为动作
            String actionParam = request.getParameter("action");
            if (actionParam != null && !actionParam.isBlank()) {
                verb = actionParam.toLowerCase();
            } else {
                verb = "act";
            }
        }
        // 处理 /restore 子路径
        if (path.endsWith("/restore")) {
            verb = "restore";
        }

        String domainPrefix = resolveDomainPrefix(resource);
        return domainPrefix + "." + toSnakeCase(resource) + "." + verb;
    }

    private String mapMethodToVerb(String method) {
        return switch (method) {
            case "POST" -> "create";
            case "PATCH", "PUT" -> "update";
            case "DELETE" -> "delete";
            case "GET" -> "read";
            default -> method.toLowerCase();
        };
    }

    private String resolveDomainPrefix(String resource) {
        if (resource.contains("access-grant") || resource.contains("release")
                || resource.contains("data-asset") || resource.contains("audit-log")
                || resource.contains("evidence") || resource.contains("backup")
                || resource.contains("restore-drill") || resource.contains("compliance")) {
            return "governance";
        }
        if (resource.contains("principal") || resource.contains("organization")
                || resource.contains("membership") || resource.contains("role-binding")) {
            return "iam";
        }
        if (resource.contains("project") || resource.contains("stage")
                || resource.contains("baseline") || resource.contains("gate")) {
            return "portfolio";
        }
        if (resource.contains("document") || resource.contains("version")) {
            return "cde";
        }
        if (resource.contains("ai")) {
            return "ai";
        }
        return "platform";
    }

    private String toSnakeCase(String input) {
        return input.replace("-", "_");
    }

    private String normalizePath(String uri) {
        if (uri == null) {
            return "/";
        }
        return uri.trim();
    }
}
