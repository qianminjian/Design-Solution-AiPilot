package com.platform.core.governance.auditlog.support;

import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AuditActionEvaluator 单元测试
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>resolveCategory: AUTH/GOVERNANCE/AI/DATA/ADMIN 五大分类</li>
 *   <li>resolveRiskLevel: DELETE 升级 CRITICAL、/actions 升级 HIGH、revoke/rollback 等升级 CRITICAL</li>
 *   <li>resolveAction: {domain}.{resource}.{verb} 格式 + /actions 子路径动作名</li>
 * </ul>
 */
@DisplayName("AuditActionEvaluator 审计分类与风险等级评估器")
class AuditActionEvaluatorTest {

    private AuditActionEvaluator evaluator;

    @BeforeEach
    void setUp() {
        evaluator = new AuditActionEvaluator();
    }

    @Nested
    @DisplayName("resolveCategory 分类解析")
    class ResolveCategory {

        @Test
        @DisplayName("/api/v1/auth/** 应归 AUTH 类")
        void shouldClassifyAuth() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/auth/login");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.AUTH);
        }

        @Test
        @DisplayName("/api/v1/access-grants/** 应归 GOVERNANCE 类")
        void shouldClassifyAccessGrants() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/access-grants");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.GOVERNANCE);
        }

        @Test
        @DisplayName("/api/v1/releases/** 应归 GOVERNANCE 类")
        void shouldClassifyReleases() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/releases");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.GOVERNANCE);
        }

        @Test
        @DisplayName("/api/v1/data-assets/** 应归 GOVERNANCE 类")
        void shouldClassifyDataAssets() {
            HttpServletRequest request = buildRequest("PATCH", "/api/v1/data-assets/abc-123");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.GOVERNANCE);
        }

        @Test
        @DisplayName("/api/v1/restore-drills/** 应归 GOVERNANCE 类")
        void shouldClassifyRestoreDrills() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/restore-drills");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.GOVERNANCE);
        }

        @Test
        @DisplayName("/api/v1/compliance-rules/** 应归 GOVERNANCE 类")
        void shouldClassifyComplianceRules() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/compliance-rules");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.GOVERNANCE);
        }

        @Test
        @DisplayName("/api/v1/ai/generate 应归 AI 类")
        void shouldClassifyAi() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/ai/generate");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.AI);
        }

        @Test
        @DisplayName("/api/v1/ai-generation-records 应归 AI 类")
        void shouldClassifyAiGenerationRecords() {
            HttpServletRequest request = buildRequest("GET", "/api/v1/ai-generation-records");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.AI);
        }

        @Test
        @DisplayName("/api/v1/projects/** 应归 DATA 类")
        void shouldClassifyProjects() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.DATA);
        }

        @Test
        @DisplayName("/api/v1/documents/** 应归 DATA 类")
        void shouldClassifyDocuments() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/documents");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.DATA);
        }

        @Test
        @DisplayName("/api/v1/principals/** 应归 ADMIN 类")
        void shouldClassifyPrincipals() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/principals");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.ADMIN);
        }

        @Test
        @DisplayName("未匹配前缀应降级到 ADMIN 类")
        void shouldFallbackToAdmin() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/unknown-resource");
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.ADMIN);
        }

        @Test
        @DisplayName("空 URI 应归 ADMIN 类")
        void shouldHandleNullUri() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.setMethod("POST");
            request.setRequestURI(null);
            assertThat(evaluator.resolveCategory(request)).isEqualTo(GovernanceAuditCategory.ADMIN);
        }
    }

    @Nested
    @DisplayName("resolveRiskLevel 风险等级解析")
    class ResolveRiskLevel {

        @Test
        @DisplayName("DELETE 方法应升级为 CRITICAL")
        void shouldUpgradeDeleteToCritical() {
            HttpServletRequest request = buildRequest("DELETE", "/api/v1/projects/123");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/restore 子路径应为 CRITICAL")
        void shouldUpgradeRestoreToCritical() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/backups/bck-123/restore");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/restore-drills 路径应为 CRITICAL")
        void shouldUpgradeRestoreDrillsToCritical() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/restore-drills");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/actions + action=revoke 应为 CRITICAL")
        void shouldUpgradeRevokeActionToCritical() {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/access-grants/abc-123/actions");
            request.addParameter("action", "revoke");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/actions + action=rollback 应为 CRITICAL")
        void shouldUpgradeRollbackActionToCritical() {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/releases/rel-001/actions");
            request.addParameter("action", "rollback");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/actions + action=promote 应为 CRITICAL")
        void shouldUpgradePromoteActionToCritical() {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/releases/rel-001/actions");
            request.addParameter("action", "promote");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.CRITICAL);
        }

        @Test
        @DisplayName("/actions 无 action 参数应为 HIGH")
        void shouldReturnHighForActionsWithoutParam() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/access-grants/abc-123/actions");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.HIGH);
        }

        @Test
        @DisplayName("AUTH 类应为 MEDIUM")
        void shouldReturnMediumForAuth() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/auth/login");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.MEDIUM);
        }

        @Test
        @DisplayName("AI 类应为 HIGH")
        void shouldReturnHighForAi() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/ai/generate");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.HIGH);
        }

        @Test
        @DisplayName("DATA 类 POST 应为 MEDIUM")
        void shouldReturnMediumForData() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.MEDIUM);
        }

        @Test
        @DisplayName("ADMIN 类 POST 应为 MEDIUM")
        void shouldReturnMediumForAdmin() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/principals");
            GovernanceAuditCategory category = evaluator.resolveCategory(request);
            assertThat(evaluator.resolveRiskLevel(request, category))
                    .isEqualTo(GovernanceRiskLevel.MEDIUM);
        }
    }

    @Nested
    @DisplayName("resolveAction 操作名解析")
    class ResolveAction {

        @Test
        @DisplayName("POST /api/v1/projects 应解析为 portfolio.projects.create")
        void shouldResolveCreateAction() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            assertThat(evaluator.resolveAction(request)).isEqualTo("portfolio.projects.create");
        }

        @Test
        @DisplayName("PATCH /api/v1/projects/123 应解析为 portfolio.projects.update")
        void shouldResolveUpdateAction() {
            HttpServletRequest request = buildRequest("PATCH", "/api/v1/projects/123");
            assertThat(evaluator.resolveAction(request)).isEqualTo("portfolio.projects.update");
        }

        @Test
        @DisplayName("DELETE /api/v1/projects/123 应解析为 portfolio.projects.delete")
        void shouldResolveDeleteAction() {
            HttpServletRequest request = buildRequest("DELETE", "/api/v1/projects/123");
            assertThat(evaluator.resolveAction(request)).isEqualTo("portfolio.projects.delete");
        }

        @Test
        @DisplayName("POST /api/v1/access-grants 应解析为 governance.access_grants.create")
        void shouldResolveGovernanceCreateAction() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/access-grants");
            assertThat(evaluator.resolveAction(request)).isEqualTo("governance.access_grants.create");
        }

        @Test
        @DisplayName("/actions + action=revoke 应解析为 governance.{resource}.revoke")
        void shouldResolveRevokeAction() {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/access-grants/abc-123/actions");
            request.addParameter("action", "revoke");
            assertThat(evaluator.resolveAction(request)).isEqualTo("governance.access_grants.revoke");
        }

        @Test
        @DisplayName("/actions 无 action 参数应解析为 governance.{resource}.act")
        void shouldResolveActAction() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/releases/rel-001/actions");
            assertThat(evaluator.resolveAction(request)).isEqualTo("governance.releases.act");
        }

        @Test
        @DisplayName("/restore 子路径应解析为 governance.{resource}.restore")
        void shouldResolveRestoreAction() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/backups/bck-001/restore");
            assertThat(evaluator.resolveAction(request)).isEqualTo("governance.backups.restore");
        }

        @Test
        @DisplayName("POST /api/v1/ai/generate 应解析为 ai.ai.create")
        void shouldResolveAiCreateAction() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/ai/generate");
            assertThat(evaluator.resolveAction(request)).isEqualTo("ai.ai.create");
        }

        @Test
        @DisplayName("短路径 (<4 段) 应返回 unknown.{method}")
        void shouldReturnUnknownForShortPath() {
            HttpServletRequest request = buildRequest("POST", "/api");
            assertThat(evaluator.resolveAction(request)).isEqualTo("unknown.post");
        }

        @Test
        @DisplayName("未匹配 domain 应使用 platform 前缀")
        void shouldFallbackToPlatformDomain() {
            HttpServletRequest request = buildRequest("POST", "/api/v1/unknown-resource");
            assertThat(evaluator.resolveAction(request)).isEqualTo("platform.unknown_resource.create");
        }
    }

    /**
     * 构建测试用 HttpServletRequest
     */
    private MockHttpServletRequest buildRequest(String method, String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod(method);
        request.setRequestURI(uri);
        return request;
    }
}
