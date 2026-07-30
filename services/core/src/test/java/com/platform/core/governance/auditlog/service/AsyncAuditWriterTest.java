package com.platform.core.governance.auditlog.service;

import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.domain.AuditLog;
import com.platform.core.governance.auditlog.domain.AuditObject;
import com.platform.core.governance.auditlog.repository.AuditLogRepository;
import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

/**
 * AsyncAuditWriter 单元测试
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>正常写入: 调用 repository.save 并填充所有字段</li>
 *   <li>异常容错: repository 抛异常不应传播</li>
 *   <li>traceId / ipAddress / userAgent / details null 兜底为 "unknown"/""</li>
 *   <li>systemActor / anonymousActor 静态工厂方法</li>
 * </ul>
 */
@DisplayName("AsyncAuditWriter 异步审计日志写入器")
class AsyncAuditWriterTest {

    private AuditLogRepository repository;
    private AsyncAuditWriter writer;

    @BeforeEach
    void setUp() {
        repository = mock(AuditLogRepository.class);
        writer = new AsyncAuditWriter(repository);
    }

    @Nested
    @DisplayName("writeAsync 正常写入")
    class WriteAsync {

        @Test
        @DisplayName("应调用 repository.save 并填充所有字段")
        void shouldSaveAuditLogWithAllFields() {
            // Arrange
            UUID tenantId = UUID.randomUUID();
            Instant timestamp = Instant.now();
            AuditActor actor = new AuditActor(
                    "user-001", "user@example.com", GovernanceAuditActorType.USER
            );
            AuditObject object = new AuditObject("projects", "proj-001", "Project Alpha");

            // Act
            writer.writeAsync(
                    tenantId, timestamp, actor, "portfolio.projects.create",
                    GovernanceAuditCategory.DATA, object, "trace-abc-123",
                    GovernanceResult.SUCCESS, GovernanceRiskLevel.MEDIUM,
                    true, "203.0.113.10", "Mozilla/5.0",
                    "{\"method\":\"POST\",\"path\":\"/api/v1/projects\"}"
            );

            // Assert
            ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository, times(1)).save(logCaptor.capture());
            AuditLog saved = logCaptor.getValue();
            assertThat(saved.getTenantId()).isEqualTo(tenantId);
            assertThat(saved.getTimestamp()).isEqualTo(timestamp);
            assertThat(saved.getActor()).isEqualTo(actor);
            assertThat(saved.getAction()).isEqualTo("portfolio.projects.create");
            assertThat(saved.getCategory()).isEqualTo(GovernanceAuditCategory.DATA);
            assertThat(saved.getObject()).isEqualTo(object);
            assertThat(saved.getTraceId()).isEqualTo("trace-abc-123");
            assertThat(saved.getResult()).isEqualTo(GovernanceResult.SUCCESS);
            assertThat(saved.getRiskLevel()).isEqualTo(GovernanceRiskLevel.MEDIUM);
            assertThat(saved.isMasked()).isTrue();
            assertThat(saved.getIpAddress()).isEqualTo("203.0.113.10");
            assertThat(saved.getUserAgent()).isEqualTo("Mozilla/5.0");
            assertThat(saved.getDetails()).isEqualTo("{\"method\":\"POST\",\"path\":\"/api/v1/projects\"}");
        }

        @Test
        @DisplayName("traceId 为 null 时应兜底为 unknown")
        void shouldFallbackTraceIdToUnknown() {
            writer.writeAsync(
                    UUID.randomUUID(), Instant.now(),
                    new AuditActor("u", "u", GovernanceAuditActorType.USER),
                    "action", GovernanceAuditCategory.ADMIN,
                    new AuditObject("o", "i", "n"),
                    null, GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW,
                    true, "127.0.0.1", "UA", "{}"
            );

            ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getTraceId()).isEqualTo("unknown");
        }

        @Test
        @DisplayName("ipAddress 为 null 时应兜底为 unknown")
        void shouldFallbackIpAddressToUnknown() {
            writer.writeAsync(
                    UUID.randomUUID(), Instant.now(),
                    new AuditActor("u", "u", GovernanceAuditActorType.USER),
                    "action", GovernanceAuditCategory.ADMIN,
                    new AuditObject("o", "i", "n"),
                    "trace", GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW,
                    true, null, "UA", "{}"
            );

            ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getIpAddress()).isEqualTo("unknown");
        }

        @Test
        @DisplayName("userAgent 为 null 时应兜底为 unknown")
        void shouldFallbackUserAgentToUnknown() {
            writer.writeAsync(
                    UUID.randomUUID(), Instant.now(),
                    new AuditActor("u", "u", GovernanceAuditActorType.USER),
                    "action", GovernanceAuditCategory.ADMIN,
                    new AuditObject("o", "i", "n"),
                    "trace", GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW,
                    true, "127.0.0.1", null, "{}"
            );

            ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getUserAgent()).isEqualTo("unknown");
        }

        @Test
        @DisplayName("details 为 null 时应兜底为空字符串")
        void shouldFallbackDetailsToEmpty() {
            writer.writeAsync(
                    UUID.randomUUID(), Instant.now(),
                    new AuditActor("u", "u", GovernanceAuditActorType.USER),
                    "action", GovernanceAuditCategory.ADMIN,
                    new AuditObject("o", "i", "n"),
                    "trace", GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW,
                    true, "127.0.0.1", "UA", null
            );

            ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getDetails()).isEqualTo("");
        }
    }

    @Nested
    @DisplayName("异常容错")
    class ExceptionTolerance {

        @Test
        @DisplayName("repository.save 抛异常不应传播")
        void shouldNotPropagateRepositoryException() {
            // Arrange
            org.mockito.Mockito.doThrow(new RuntimeException("DB connection lost"))
                    .when(repository).save(any(AuditLog.class));

            // Act + Assert: 不应抛异常
            writer.writeAsync(
                    UUID.randomUUID(), Instant.now(),
                    new AuditActor("u", "u", GovernanceAuditActorType.USER),
                    "action", GovernanceAuditCategory.ADMIN,
                    new AuditObject("o", "i", "n"),
                    "trace", GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW,
                    true, "127.0.0.1", "UA", "{}"
            );

            // 仍尝试调用 save
            verify(repository, times(1)).save(any(AuditLog.class));
        }
    }

    @Nested
    @DisplayName("静态工厂方法")
    class StaticFactory {

        @Test
        @DisplayName("systemActor 应返回 SYSTEM 类型 actor")
        void shouldCreateSystemActor() {
            AuditActor actor = AsyncAuditWriter.systemActor();
            assertThat(actor.getId()).isEqualTo("system");
            assertThat(actor.getName()).isEqualTo("System");
            assertThat(actor.getType()).isEqualTo(GovernanceAuditActorType.SYSTEM);
        }

        @Test
        @DisplayName("anonymousActor 应返回 USER 类型 actor 兜底")
        void shouldCreateAnonymousActor() {
            AuditActor actor = AsyncAuditWriter.anonymousActor();
            assertThat(actor.getId()).isEqualTo("anonymous");
            assertThat(actor.getName()).isEqualTo("Anonymous");
            assertThat(actor.getType()).isEqualTo(GovernanceAuditActorType.USER);
        }
    }
}
