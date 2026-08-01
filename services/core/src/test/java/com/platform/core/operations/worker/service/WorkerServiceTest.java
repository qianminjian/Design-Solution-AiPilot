package com.platform.core.operations.worker.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.domain.WorkerStatus;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * WorkerService 单元测试（V1.10 新增）
 *
 * <p>聚焦 V1.10 新增的 {@link WorkerService#deleteWorker} 方法分支覆盖：
 * <ul>
 *   <li>Worker 不存在 → 抛 NOT_FOUND</li>
 *   <li>Worker 状态为 RUNNING/IDLE → 抛 BUSINESS_RULE_VIOLATION（CONFLICT）</li>
 *   <li>Worker 状态为 STOPPED/ERROR → 成功删除</li>
 * </ul>
 *
 * <p>对齐 testing.md §4 Mock 规范：Repository 使用 Mockito mock，避免真实数据库依赖。
 *
 * @design D37-关键界面-交互状态.md §D37.17 Operations 危险动作
 * @design D37-关键界面-交互状态.md §D37.23 不可逆/合规：二人审批
 */
@ExtendWith(MockitoExtension.class)
class WorkerServiceTest {

    @Mock
    private WorkerStatusRepository repository;

    @InjectMocks
    private WorkerService workerService;

    private UUID tenantId;
    private UUID workerId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        workerId = UUID.randomUUID();
    }

    // ── deleteWorker ──

    @Test
    @DisplayName("删除 Worker：Worker 不存在时应抛 NOT_FOUND 异常")
    void deleteWorker_shouldThrowNotFound_whenWorkerNotExists() {
        // Arrange
        when(repository.findByIdAndTenantId(workerId, tenantId))
                .thenReturn(Optional.empty());

        // Act + Assert
        assertThatThrownBy(() ->
                workerService.deleteWorker(tenantId, workerId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });

        // 验证未触发删除
        verify(repository, never()).delete(any(WorkerStatus.class));
    }

    @Test
    @DisplayName("删除 Worker：状态为 RUNNING 时应抛 BUSINESS_RULE_VIOLATION（CONFLICT）")
    void deleteWorker_shouldThrowConflict_whenWorkerRunning() {
        // Arrange
        WorkerStatus worker = buildWorker(WorkerRuntimeStatus.RUNNING);
        when(repository.findByIdAndTenantId(workerId, tenantId))
                .thenReturn(Optional.of(worker));

        // Act + Assert
        assertThatThrownBy(() ->
                workerService.deleteWorker(tenantId, workerId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(be.getMessage()).contains("RUNNING");
                });

        verify(repository, never()).delete(any(WorkerStatus.class));
    }

    @Test
    @DisplayName("删除 Worker：状态为 IDLE 时应抛 BUSINESS_RULE_VIOLATION（CONFLICT）")
    void deleteWorker_shouldThrowConflict_whenWorkerIdle() {
        // Arrange
        WorkerStatus worker = buildWorker(WorkerRuntimeStatus.IDLE);
        when(repository.findByIdAndTenantId(workerId, tenantId))
                .thenReturn(Optional.of(worker));

        // Act + Assert
        assertThatThrownBy(() ->
                workerService.deleteWorker(tenantId, workerId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(be.getMessage()).contains("IDLE");
                });

        verify(repository, never()).delete(any(WorkerStatus.class));
    }

    @Test
    @DisplayName("删除 Worker：状态为 STOPPED 时应成功删除")
    void deleteWorker_shouldDelete_whenWorkerStopped() {
        // Arrange
        WorkerStatus worker = buildWorker(WorkerRuntimeStatus.STOPPED);
        when(repository.findByIdAndTenantId(workerId, tenantId))
                .thenReturn(Optional.of(worker));

        // Act
        workerService.deleteWorker(tenantId, workerId, "资源已废弃，确认清理");

        // Assert
        verify(repository, times(1)).delete(worker);
    }

    @Test
    @DisplayName("删除 Worker：状态为 ERROR 时应成功删除")
    void deleteWorker_shouldDelete_whenWorkerError() {
        // Arrange
        WorkerStatus worker = buildWorker(WorkerRuntimeStatus.ERROR);
        when(repository.findByIdAndTenantId(workerId, tenantId))
                .thenReturn(Optional.of(worker));

        // Act
        workerService.deleteWorker(tenantId, workerId, "异常实例清理");

        // Assert
        verify(repository, times(1)).delete(worker);
    }

    // ── 测试辅助 ──

    /** 构造测试用 WorkerStatus 实体 */
    private WorkerStatus buildWorker(WorkerRuntimeStatus status) {
        WorkerStatus worker = new WorkerStatus();
        worker.setId(workerId);
        worker.setTenantId(tenantId);
        worker.setWorkerCode("test-worker-001");
        worker.setType(WorkerType.AI);
        worker.setStatus(status);
        return worker;
    }
}
