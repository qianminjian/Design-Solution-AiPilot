package com.platform.core.governance.testexception.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.governance.testexception.domain.TestException;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import com.platform.core.governance.testexception.repository.TestExceptionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * TestExceptionExpirationScheduler 单元测试（D45.22 验收：Conditional Pass 到期自动撤销）
 *
 * <p>覆盖：无到期例外跳过批量更新 / 有到期例外批量撤销 / Repository 异常容错 /
 * batchSize 配置注入与兜底。
 *
 * <p>权威源：TestExceptionExpirationScheduler.java + A-64 调度模式
 */
@DisplayName("TestExceptionExpirationScheduler 测试例外到期清理调度器")
@ExtendWith(MockitoExtension.class)
class TestExceptionExpirationSchedulerTest {

    @Mock
    private TestExceptionRepository repository;

    private TestExceptionExpirationScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new TestExceptionExpirationScheduler(repository, 500);
    }

    @Test
    @DisplayName("无到期例外时应跳过批量更新")
    void markExpired_shouldSkipBulkWhenNoneExpired() {
        // Arrange
        when(repository.findExpiredByStatus(eq(TestExceptionStatus.ACTIVE),
                ArgumentMatchers.any(Instant.class))).thenReturn(List.of());

        // Act
        scheduler.markExpiredExceptions();

        // Assert
        verify(repository).findExpiredByStatus(eq(TestExceptionStatus.ACTIVE),
                ArgumentMatchers.any(Instant.class));
        verify(repository, never()).bulkMarkExpired(
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    @DisplayName("有到期例外时应批量撤销为 EXPIRED")
    void markExpired_shouldBulkMarkExpired() {
        // Arrange
        TestException expired = new TestException();
        expired.setId(UUID.randomUUID());
        when(repository.findExpiredByStatus(eq(TestExceptionStatus.ACTIVE),
                ArgumentMatchers.any(Instant.class))).thenReturn(List.of(expired));
        when(repository.bulkMarkExpired(
                eq(TestExceptionStatus.ACTIVE), eq(TestExceptionStatus.EXPIRED),
                ArgumentMatchers.any(Instant.class))).thenReturn(1);

        // Act
        scheduler.markExpiredExceptions();

        // Assert
        verify(repository).bulkMarkExpired(
                eq(TestExceptionStatus.ACTIVE), eq(TestExceptionStatus.EXPIRED),
                ArgumentMatchers.any(Instant.class));
    }

    @Test
    @DisplayName("Repository 抛异常时调度器应兜底捕获不抛出")
    void markExpired_shouldSilentlyCatchException() {
        // Arrange
        when(repository.findExpiredByStatus(eq(TestExceptionStatus.ACTIVE),
                ArgumentMatchers.any(Instant.class)))
                .thenThrow(new RuntimeException("DB 连接失败"));

        // Act（不应抛出异常）
        scheduler.markExpiredExceptions();

        // Assert（异常已兜底，调度器未被中断）
        verify(repository, never()).bulkMarkExpired(
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    @DisplayName("batchSize 应返回注入值")
    void getBatchSize_shouldReturnInjectedValue() {
        assertThat(scheduler.getBatchSize()).isEqualTo(500);
    }

    @Test
    @DisplayName("batchSize 非法配置应兜底默认 500")
    void getBatchSize_shouldFallbackWhenInvalid() {
        TestExceptionExpirationScheduler invalid = new TestExceptionExpirationScheduler(repository, 0);
        assertThat(invalid.getBatchSize()).isEqualTo(500);

        TestExceptionExpirationScheduler negative = new TestExceptionExpirationScheduler(repository, -1);
        assertThat(negative.getBatchSize()).isEqualTo(500);
    }
}
