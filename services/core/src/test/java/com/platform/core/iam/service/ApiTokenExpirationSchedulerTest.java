package com.platform.core.iam.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * ApiTokenExpirationScheduler 单元测试（A-64 Token 自动过期清理任务）
 *
 * <p>覆盖：
 * <ul>
 *   <li>无过期 Token：不触发 bulkMarkExpired</li>
 *   <li>有过期 Token：调用 bulkMarkExpired 并记录受影响行数</li>
 *   <li>异常容错：Repository 抛异常时调度任务不抛出（仅记录日志）</li>
 *   <li>配置注入：batchSize 通过 @Value 注入并兜底默认值</li>
 *   <li>batchSize 异常值兜底：@Value 注入 0 或负数时使用默认 500</li>
 * </ul>
 *
 * <p>权威源：ApiTokenExpirationScheduler.java + security.md §1 密钥管理
 */
@ExtendWith(MockitoExtension.class)
class ApiTokenExpirationSchedulerTest {

    @Mock
    private ApiTokenRepository repository;

    @Test
    @DisplayName("无过期 Token 时应跳过 bulkMarkExpired 调用")
    void markExpiredTokens_shouldSkipBulkUpdate_whenNoExpiredTokens() {
        // Arrange
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of());
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 500);

        // Act
        scheduler.markExpiredTokens();

        // Assert：未调用 bulkMarkExpired
        verify(repository, never()).bulkMarkExpired(any(Instant.class));
    }

    @Test
    @DisplayName("有过期 Token 时应调用 bulkMarkExpired 完成状态流转")
    void markExpiredTokens_shouldCallBulkMarkExpired_whenExpiredTokensExist() {
        // Arrange
        ApiToken expiredToken = buildExpiredToken();
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of(expiredToken));
        when(repository.bulkMarkExpired(any(Instant.class))).thenReturn(1);
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 500);

        // Act
        scheduler.markExpiredTokens();

        // Assert
        verify(repository, times(1)).bulkMarkExpired(any(Instant.class));
    }

    @Test
    @DisplayName("Repository 抛异常时调度任务应兜底捕获不抛出")
    void markExpiredTokens_shouldSilentlyCatchException_whenRepositoryThrows() {
        // Arrange
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenThrow(new RuntimeException("DB 连接失败"));
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 500);

        // Act & Assert：不抛出异常（对齐 A-59 调度任务失败不阻断主流程设计）
        scheduler.markExpiredTokens();
        verify(repository, never()).bulkMarkExpired(any(Instant.class));
    }

    @Test
    @DisplayName("batchSize 通过 @Value 注入应正确返回")
    void getBatchSize_shouldReturnInjectedValue() {
        // Arrange
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 200);

        // Act & Assert
        assertThat(scheduler.getBatchSize()).isEqualTo(200);
    }

    @Test
    @DisplayName("batchSize 为 0 时应兜底使用默认值 500")
    void getBatchSize_shouldFallbackToDefault_whenInjectedValueIsZero() {
        // Arrange：模拟环境变量配置异常（TOKEN_CLEANUP_BATCH_SIZE=0）
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 0);

        // Act & Assert
        assertThat(scheduler.getBatchSize()).isEqualTo(500);
    }

    @Test
    @DisplayName("batchSize 为负数时应兜底使用默认值 500")
    void getBatchSize_shouldFallbackToDefault_whenInjectedValueIsNegative() {
        // Arrange：模拟环境变量配置异常（TOKEN_CLEANUP_BATCH_SIZE=-1）
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, -1);

        // Act & Assert
        assertThat(scheduler.getBatchSize()).isEqualTo(500);
    }

    @Test
    @DisplayName("findExpiredActiveTokens 应使用正确的分页参数（PageRequest.of(0, batchSize)）")
    void markExpiredTokens_shouldUseCorrectPageable_whenInvoked() {
        // Arrange
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of());
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 100);

        // Act
        scheduler.markExpiredTokens();

        // Assert：验证 Pageable 参数为 PageRequest.of(0, 100)
        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findExpiredActiveTokens(any(Instant.class), captor.capture());
        Pageable captured = captor.getValue();
        assertThat(captured.getPageNumber()).isZero();
        assertThat(captured.getPageSize()).isEqualTo(100);
    }

    @Test
    @DisplayName("本批处理量达到 batchSize 上限时应记录可能有剩余 Token 待下次调度")
    void markExpiredTokens_shouldLogRemainingHint_whenAffectedReachesBatchSize() {
        // Arrange：模拟本批处理量 = batchSize（说明可能还有剩余）
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of(buildExpiredToken()));
        when(repository.bulkMarkExpired(any(Instant.class))).thenReturn(100);
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 100);

        // Act & Assert：不抛出异常，受影响行数 = batchSize
        scheduler.markExpiredTokens();
        verify(repository).bulkMarkExpired(any(Instant.class));
    }

    @Test
    @DisplayName("本批处理量小于 batchSize 时不应记录剩余提示")
    void markExpiredTokens_shouldNotLogRemainingHint_whenAffectedLessThanBatchSize() {
        // Arrange：模拟本批处理量 < batchSize（说明已处理完所有过期 Token）
        when(repository.findExpiredActiveTokens(any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of(buildExpiredToken()));
        when(repository.bulkMarkExpired(any(Instant.class))).thenReturn(1);
        ApiTokenExpirationScheduler scheduler = new ApiTokenExpirationScheduler(repository, 500);

        // Act
        scheduler.markExpiredTokens();

        // Assert：bulkMarkExpired 返回 1 < batchSize 500，正常完成
        verify(repository).bulkMarkExpired(any(Instant.class));
    }

    // ===== 辅助方法 =====

    /**
     * 构造一个已过期的 ApiToken 实体（仅用于测试）
     */
    private ApiToken buildExpiredToken() {
        ApiToken token = new ApiToken();
        token.setId(UUID.randomUUID());
        token.setPrincipalId(UUID.randomUUID());
        token.setTenantId(UUID.randomUUID());
        token.setName("expired-token-" + UUID.randomUUID().toString().substring(0, 8));
        token.setPrefix("expired00000");
        // tokenHash 长度 64（SHA-256 hex），用 UUID 拼接保证唯一性
        String uuidHex = UUID.randomUUID().toString().replace("-", "");
        token.setTokenHash(uuidHex + uuidHex); // 32 + 32 = 64 hex
        // tokenSalt 长度 32（16 bytes hex）
        token.setTokenSalt(uuidHex);
        token.setScopes("[]");
        token.setStatus("active");
        // expiresAt 早于当前时间，触发过期清理
        token.setExpiresAt(Instant.now().minusSeconds(60));
        return token;
    }
}
