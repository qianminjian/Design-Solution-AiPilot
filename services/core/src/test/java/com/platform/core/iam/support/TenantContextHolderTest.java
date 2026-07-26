package com.platform.core.iam.support;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TenantContextHolder 单元测试
 *
 * 覆盖：
 * - setTenantId / getTenantId / clear
 * - ThreadLocal 线程隔离
 * - Optional 兜底
 */
@DisplayName("TenantContextHolder 租户上下文持有者")
class TenantContextHolderTest {

    @BeforeEach
    @AfterEach
    void cleanUp() {
        // 每个测试前后清理 ThreadLocal，避免污染
        TenantContextHolder.clear();
    }

    @Nested
    @DisplayName("setTenantId / getTenantId")
    class SetAndGet {

        @Test
        @DisplayName("应能设置并获取租户 ID")
        void shouldSetAndGetValue() {
            // Arrange
            UUID tenantId = UUID.randomUUID();

            // Act
            TenantContextHolder.setTenantId(tenantId);

            // Assert
            assertThat(TenantContextHolder.getTenantId()).hasValue(tenantId);
        }

        @Test
        @DisplayName("未设置时应返回 Optional.empty()")
        void shouldReturnEmptyWhenNotSet() {
            // Act + Assert
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }

        @Test
        @DisplayName("clear 后应返回 Optional.empty()")
        void shouldReturnEmptyAfterClear() {
            // Arrange
            TenantContextHolder.setTenantId(UUID.randomUUID());
            assertThat(TenantContextHolder.getTenantId()).isPresent();

            // Act
            TenantContextHolder.clear();

            // Assert
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }

        @Test
        @DisplayName("重复 setTenantId 应覆盖旧值")
        void shouldOverwriteExistingValue() {
            // Arrange
            UUID firstTenant = UUID.randomUUID();
            UUID secondTenant = UUID.randomUUID();

            // Act
            TenantContextHolder.setTenantId(firstTenant);
            TenantContextHolder.setTenantId(secondTenant);

            // Assert
            assertThat(TenantContextHolder.getTenantId()).hasValue(secondTenant);
        }

        @Test
        @DisplayName("setTenantId(null) 应等价于 clear")
        void shouldHandleNullAsClear() {
            // Arrange
            TenantContextHolder.setTenantId(UUID.randomUUID());

            // Act
            TenantContextHolder.setTenantId(null);

            // Assert
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }
    }

    @Nested
    @DisplayName("线程隔离")
    class ThreadIsolation {

        @Test
        @DisplayName("不同线程应持有独立的租户 ID")
        void shouldIsolateTenantBetweenThreads() throws InterruptedException {
            // Arrange
            UUID mainThreadTenant = UUID.randomUUID();
            UUID workerThreadTenant = UUID.randomUUID();

            TenantContextHolder.setTenantId(mainThreadTenant);

            CountDownLatch latch = new CountDownLatch(1);
            AtomicReference<java.util.Optional<UUID>> workerGetResult = new AtomicReference<>();

            // Act：在子线程中设置 workerThreadTenant，不应影响主线程
            ExecutorService executor = Executors.newSingleThreadExecutor();
            executor.submit(() -> {
                TenantContextHolder.setTenantId(workerThreadTenant);
                workerGetResult.set(TenantContextHolder.getTenantId());
                latch.countDown();
            });

            // Assert
            assertThat(latch.await(2, TimeUnit.SECONDS)).isTrue();
            // 子线程取到的应是自己设置的 workerThreadTenant
            assertThat(workerGetResult.get()).hasValue(workerThreadTenant);
            // 主线程仍应是 mainThreadTenant
            assertThat(TenantContextHolder.getTenantId()).hasValue(mainThreadTenant);

            executor.shutdown();
        }

        @Test
        @DisplayName("子线程未设置时应返回 Optional.empty()")
        void shouldReturnEmptyInChildThread() throws InterruptedException {
            // Arrange：主线程设置 tenant
            UUID mainTenant = UUID.randomUUID();
            TenantContextHolder.setTenantId(mainTenant);

            CountDownLatch latch = new CountDownLatch(1);
            AtomicReference<java.util.Optional<UUID>> childGetResult = new AtomicReference<>();

            // Act：子线程不设置，直接 get
            ExecutorService executor = Executors.newSingleThreadExecutor();
            executor.submit(() -> {
                childGetResult.set(TenantContextHolder.getTenantId());
                latch.countDown();
            });

            // Assert
            assertThat(latch.await(2, TimeUnit.SECONDS)).isTrue();
            // 子线程应是 empty（ThreadLocal 不继承）
            assertThat(childGetResult.get()).isEmpty();
            // 主线程仍是 mainTenant
            assertThat(TenantContextHolder.getTenantId()).hasValue(mainTenant);

            executor.shutdown();
        }
    }
}
