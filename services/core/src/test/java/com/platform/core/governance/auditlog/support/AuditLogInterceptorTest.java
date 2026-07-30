package com.platform.core.governance.auditlog.support;

import com.platform.core.auth.security.AuthenticatedPrincipal;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.service.AsyncAuditWriter;
import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * AuditLogInterceptor 单元测试
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>preHandle: GET 不记录 / POST 记录开始时间</li>
 *   <li>afterCompletion: 写操作触发异步写入, 只读操作跳过</li>
 *   <li>无租户上下文时跳过审计</li>
 *   <li>AuthenticatedPrincipal 解析 actor</li>
 *   <li>x-user-id header 兜底 actor</li>
 *   <li>BusinessException 解析为 FAILURE, 其他异常为 ERROR</li>
 *   <li>2xx 状态解析为 SUCCESS, 401/403 为 DENIED, 5xx 为 ERROR</li>
 *   <li>X-Forwarded-For 解析真实客户端 IP</li>
 *   <li>/api/v1/{resource}/{id} 解析 object</li>
 *   <li>审计失败不影响主流程</li>
 * </ul>
 */
@DisplayName("AuditLogInterceptor 审计日志拦截器")
class AuditLogInterceptorTest {

    private AsyncAuditWriter asyncWriter;
    private AuditActionEvaluator evaluator;
    private AuditLogInterceptor interceptor;

    @BeforeEach
    void setUp() {
        asyncWriter = mock(AsyncAuditWriter.class);
        evaluator = new AuditActionEvaluator();
        interceptor = new AuditLogInterceptor(asyncWriter, evaluator);
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @Nested
    @DisplayName("preHandle 预处理")
    class PreHandle {

        @Test
        @DisplayName("GET 请求不记录开始时间但仍放行")
        void shouldNotRecordStartTimeForGet() throws Exception {
            MockHttpServletRequest request = buildRequest("GET", "/api/v1/projects");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean proceed = interceptor.preHandle(request, response, new Object());

            assertThat(proceed).isTrue();
            assertThat(request.getAttribute("auditLog.startTime")).isNull();
        }

        @Test
        @DisplayName("POST 请求记录开始时间并放行")
        void shouldRecordStartTimeForPost() throws Exception {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean proceed = interceptor.preHandle(request, response, new Object());

            assertThat(proceed).isTrue();
            assertThat(request.getAttribute("auditLog.startTime")).isNotNull();
        }

        @Test
        @DisplayName("DELETE 请求记录开始时间")
        void shouldRecordStartTimeForDelete() throws Exception {
            MockHttpServletRequest request = buildRequest("DELETE", "/api/v1/projects/123");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean proceed = interceptor.preHandle(request, response, new Object());

            assertThat(proceed).isTrue();
            assertThat(request.getAttribute("auditLog.startTime")).isNotNull();
        }
    }

    @Nested
    @DisplayName("afterCompletion 触发异步写入")
    class AfterCompletion {

        @Test
        @DisplayName("POST 请求应触发异步审计写入")
        void shouldTriggerAsyncWriteForPost() throws Exception {
            UUID tenantId = UUID.randomUUID();
            TenantContextHolder.setTenantId(tenantId);
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            // traceId 和 userAgent 可能 null (MDC 中无 traceId, header 缺失), 使用 nullable matcher
            verify(asyncWriter, times(1)).writeAsync(
                    eq(tenantId), any(Instant.class), any(AuditActor.class), anyString(),
                    any(GovernanceAuditCategory.class), any(),
                    org.mockito.ArgumentMatchers.nullable(String.class),
                    any(GovernanceResult.class), any(GovernanceRiskLevel.class),
                    anyBoolean(), anyString(),
                    org.mockito.ArgumentMatchers.nullable(String.class),
                    anyString()
            );
        }

        @Test
        @DisplayName("GET 请求不应触发审计写入")
        void shouldSkipGetRequest() throws Exception {
            MockHttpServletRequest request = buildRequest("GET", "/api/v1/projects");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.afterCompletion(request, response, new Object(), null);

            verify(asyncWriter, never()).writeAsync(
                    any(), any(), any(), any(), any(), any(), any(),
                    any(), any(), anyBoolean(), any(), any(), any()
            );
        }

        @Test
        @DisplayName("无租户上下文应跳过审计写入")
        void shouldSkipWhenNoTenantContext() throws Exception {
            // 不设置 TenantContextHolder, 也不设置 x-tenant-id header
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            verify(asyncWriter, never()).writeAsync(
                    any(), any(), any(), any(), any(), any(), any(),
                    any(), any(), anyBoolean(), any(), any(), any()
            );
        }

        @Test
        @DisplayName("x-tenant-id header 兜底租户上下文")
        void shouldFallbackToHeaderTenantId() throws Exception {
            UUID tenantId = UUID.randomUUID();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.addHeader("x-tenant-id", tenantId.toString());
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            verify(asyncWriter, times(1)).writeAsync(
                    eq(tenantId), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
        }

        @Test
        @DisplayName("非法 x-tenant-id header 应跳过审计写入")
        void shouldSkipInvalidHeaderTenantId() throws Exception {
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.addHeader("x-tenant-id", "not-a-uuid");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            verify(asyncWriter, never()).writeAsync(
                    any(), any(), any(), any(), any(), any(), any(),
                    any(), any(), anyBoolean(), any(), any(), any()
            );
        }
    }

    @Nested
    @DisplayName("actor 解析")
    class ActorResolution {

        @Test
        @DisplayName("AuthenticatedPrincipal 应解析为 USER actor")
        void shouldResolveAuthenticatedPrincipal() throws Exception {
            UUID tenantId = UUID.randomUUID();
            TenantContextHolder.setTenantId(tenantId);
            UUID principalId = UUID.randomUUID();
            AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                    principalId, tenantId, "user@example.com",
                    List.of("ROLE_DESIGNER"), "session-001",
                    Instant.now(), Instant.now().plusSeconds(900)
            );
            Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
            SecurityContextHolder.getContext().setAuthentication(auth);

            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<AuditActor> actorCaptor = ArgumentCaptor.forClass(AuditActor.class);
            verify(asyncWriter, times(1)).writeAsync(
                    eq(tenantId), any(Instant.class), actorCaptor.capture(), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
            AuditActor actor = actorCaptor.getValue();
            assertThat(actor.getId()).isEqualTo(principalId.toString());
            assertThat(actor.getName()).isEqualTo("user@example.com");
            assertThat(actor.getType()).isEqualTo(GovernanceAuditActorType.USER);
        }

        @Test
        @DisplayName("无认证时应兜底 x-user-id header")
        void shouldFallbackToUserIdHeader() throws Exception {
            UUID tenantId = UUID.randomUUID();
            TenantContextHolder.setTenantId(tenantId);
            String userId = UUID.randomUUID().toString();

            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.addHeader("x-user-id", userId);
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<AuditActor> actorCaptor = ArgumentCaptor.forClass(AuditActor.class);
            verify(asyncWriter, times(1)).writeAsync(
                    eq(tenantId), any(Instant.class), actorCaptor.capture(), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
            AuditActor actor = actorCaptor.getValue();
            assertThat(actor.getId()).isEqualTo(userId);
            assertThat(actor.getName()).isEqualTo(userId);
            assertThat(actor.getType()).isEqualTo(GovernanceAuditActorType.USER);
        }

        @Test
        @DisplayName("无认证且无 header 应使用 anonymous actor")
        void shouldFallbackToAnonymousActor() throws Exception {
            UUID tenantId = UUID.randomUUID();
            TenantContextHolder.setTenantId(tenantId);

            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<AuditActor> actorCaptor = ArgumentCaptor.forClass(AuditActor.class);
            verify(asyncWriter, times(1)).writeAsync(
                    eq(tenantId), any(Instant.class), actorCaptor.capture(), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
            AuditActor actor = actorCaptor.getValue();
            assertThat(actor.getId()).isEqualTo("anonymous");
            assertThat(actor.getName()).isEqualTo("Anonymous");
        }
    }

    @Nested
    @DisplayName("result 解析")
    class ResultResolution {

        @Test
        @DisplayName("2xx 响应应解析为 SUCCESS")
        void shouldResolveSuccess() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.SUCCESS);
        }

        @Test
        @DisplayName("401 响应应解析为 DENIED")
        void shouldResolveDeniedFor401() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(401);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.DENIED);
        }

        @Test
        @DisplayName("403 响应应解析为 DENIED")
        void shouldResolveDeniedFor403() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(403);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.DENIED);
        }

        @Test
        @DisplayName("500 响应应解析为 ERROR")
        void shouldResolveErrorFor500() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(500);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.ERROR);
        }

        @Test
        @DisplayName("BusinessException 应解析为 FAILURE")
        void shouldResolveFailureForBusinessException() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(400);
            BusinessException ex = new BusinessException(ErrorCode.PARAM_INVALID, "Invalid input");

            interceptor.afterCompletion(request, response, new Object(), ex);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.FAILURE);
        }

        @Test
        @DisplayName("非 BusinessException 应解析为 ERROR")
        void shouldResolveErrorForOtherException() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(500);
            RuntimeException ex = new RuntimeException("DB connection lost");

            interceptor.afterCompletion(request, response, new Object(), ex);

            ArgumentCaptor<GovernanceResult> resultCaptor = ArgumentCaptor.forClass(GovernanceResult.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), resultCaptor.capture(), any(), anyBoolean(),
                    any(), any(), any()
            );
            assertThat(resultCaptor.getValue()).isEqualTo(GovernanceResult.ERROR);
        }
    }

    @Nested
    @DisplayName("异常容错")
    class ExceptionTolerance {

        @Test
        @DisplayName("AsyncWriter 抛异常不应影响主流程")
        void shouldNotThrowWhenAsyncWriterFails() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            // 模拟 AsyncWriter 抛异常
            org.mockito.Mockito.doThrow(new RuntimeException("DB connection lost"))
                    .when(asyncWriter)
                    .writeAsync(any(), any(), any(), any(), any(), any(), any(),
                            any(), any(), anyBoolean(), any(), any(), any());

            // 不应抛异常
            interceptor.afterCompletion(request, response, new Object(), null);

            verify(asyncWriter, times(1)).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
        }
    }

    @Nested
    @DisplayName("IP 与 object 解析")
    class IpAndObjectResolution {

        @Test
        @DisplayName("X-Forwarded-For 应优先解析客户端 IP")
        void shouldParseXForwardedFor() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.addHeader("X-Forwarded-For", "203.0.113.10, 10.0.0.1");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<String> ipCaptor = ArgumentCaptor.forClass(String.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    ipCaptor.capture(), any(), any()
            );
            assertThat(ipCaptor.getValue()).isEqualTo("203.0.113.10");
        }

        @Test
        @DisplayName("无 X-Forwarded-For 时应使用 RemoteAddr")
        void shouldUseRemoteAddrWhenNoXff() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("POST", "/api/v1/projects");
            request.setRemoteAddr("10.0.0.42");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(201);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<String> ipCaptor = ArgumentCaptor.forClass(String.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), any(), any(), any(), any(), anyBoolean(),
                    ipCaptor.capture(), any(), any()
            );
            assertThat(ipCaptor.getValue()).isEqualTo("10.0.0.42");
        }

        @Test
        @DisplayName("/api/v1/projects/123 应解析为 object type=projects, id=123")
        void shouldResolveObjectForResourceWithId() throws Exception {
            setupTenantContext();
            MockHttpServletRequest request = buildRequest("DELETE", "/api/v1/projects/123");
            request.setAttribute("auditLog.startTime", Instant.now());
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(204);

            interceptor.afterCompletion(request, response, new Object(), null);

            ArgumentCaptor<com.platform.core.governance.auditlog.domain.AuditObject> objectCaptor =
                    ArgumentCaptor.forClass(com.platform.core.governance.auditlog.domain.AuditObject.class);
            verify(asyncWriter).writeAsync(
                    any(UUID.class), any(Instant.class), any(AuditActor.class), anyString(),
                    any(), objectCaptor.capture(), any(), any(), any(), anyBoolean(),
                    any(), any(), any()
            );
            com.platform.core.governance.auditlog.domain.AuditObject obj = objectCaptor.getValue();
            assertThat(obj.getType()).isEqualTo("projects");
            assertThat(obj.getId()).isEqualTo("123");
        }
    }

    /**
     * 设置租户上下文
     */
    private void setupTenantContext() {
        TenantContextHolder.setTenantId(UUID.randomUUID());
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
