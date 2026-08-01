package com.platform.core.governance.flakycase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.response.BusinessException;
import com.platform.core.governance.flakycase.domain.FlakyCase;
import com.platform.core.governance.flakycase.domain.FlakyCaseStatus;
import com.platform.core.governance.flakycase.dto.FlakyCaseDto;
import com.platform.core.governance.flakycase.dto.FlakyIsolateRequest;
import com.platform.core.governance.flakycase.dto.FlakyReportRequest;
import com.platform.core.governance.flakycase.dto.FlakyResolveRequest;
import com.platform.core.governance.flakycase.repository.FlakyCaseRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * FlakyCaseService 单元测试（D45.22 Flaky 治理，SIT P0-13.2）
 *
 * <p>覆盖：运行结果上报与连续不稳定检测（翻转计数/清零/FLAKY 触发）、详情、分页列表、
 * 隔离（替代 TestCase 不阻断）、修复（根因分类 + 回归样本）、Flaky Case 率验收。
 *
 * <p>权威源：FlakyCaseService.java + D45.22
 */
@DisplayName("FlakyCaseService Flaky Case 服务")
@ExtendWith(MockitoExtension.class)
class FlakyCaseServiceTest {

    @Mock
    private FlakyCaseRepository repository;

    private FlakyCaseService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID caseId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final String testCaseId = "TC-GB50016-001";

    @BeforeEach
    void setUp() {
        service = new FlakyCaseService(repository);
    }

    // ===== POST report =====

    @Test
    @DisplayName("首次上报应创建记录并累计 runCount")
    void report_shouldCreateNewCase() {
        // Arrange
        when(repository.findByTenantIdAndTestCaseId(tenantId, testCaseId))
                .thenReturn(Optional.empty());
        when(repository.save(any(FlakyCase.class))).thenAnswer(inv -> {
            FlakyCase f = inv.getArgument(0);
            f.setId(caseId);
            return f;
        });
        FlakyReportRequest request = new FlakyReportRequest(testCaseId, "REQ-001", true, "run-1");

        // Act
        FlakyCaseDto dto = service.report(tenantId, request);

        // Assert
        assertThat(dto.runCount()).isEqualTo(1);
        assertThat(dto.lastResult()).isTrue();
        assertThat(dto.status()).isEqualTo(FlakyCaseStatus.TRACKED);
        verify(repository).save(any(FlakyCase.class));
    }

    @Test
    @DisplayName("结果翻转应累计连续不稳定")
    void report_shouldCountConsecutiveUnstableOnFlip() {
        // Arrange
        FlakyCase entity = tracked(1, true);
        when(repository.findByTenantIdAndTestCaseId(tenantId, testCaseId))
                .thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);
        FlakyReportRequest request = new FlakyReportRequest(testCaseId, "REQ-001", false, "run-2");

        // Act
        FlakyCaseDto dto = service.report(tenantId, request);

        // Assert
        assertThat(dto.runCount()).isEqualTo(2);
        assertThat(dto.instabilityCount()).isEqualTo(1);
        assertThat(dto.consecutiveUnstable()).isEqualTo(1);
        assertThat(dto.lastResult()).isFalse();
    }

    @Test
    @DisplayName("结果稳定应清零连续不稳定计数")
    void report_shouldResetConsecutiveOnStable() {
        // Arrange
        FlakyCase entity = tracked(3, false);
        entity.setInstabilityCount(2);
        entity.setConsecutiveUnstable(2);
        when(repository.findByTenantIdAndTestCaseId(tenantId, testCaseId))
                .thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);
        FlakyReportRequest request = new FlakyReportRequest(testCaseId, "REQ-001", false, "run-4");

        // Act
        FlakyCaseDto dto = service.report(tenantId, request);

        // Assert
        assertThat(dto.consecutiveUnstable()).isZero();
        assertThat(dto.instabilityCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("连续 3 次翻转应触发 FLAKY 状态（连续重复不稳定即隔离）")
    void report_shouldMarkFlakyAfterThreeConsecutiveFlips() {
        // Arrange
        FlakyCase entity = tracked(5, true);
        entity.setConsecutiveUnstable(2);
        when(repository.findByTenantIdAndTestCaseId(tenantId, testCaseId))
                .thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);
        FlakyReportRequest request = new FlakyReportRequest(testCaseId, "REQ-001", false, "run-6");

        // Act
        FlakyCaseDto dto = service.report(tenantId, request);

        // Assert
        assertThat(dto.consecutiveUnstable()).isEqualTo(3);
        assertThat(dto.status()).isEqualTo(FlakyCaseStatus.FLAKY);
    }

    // ===== GET / isolate / resolve =====

    @Test
    @DisplayName("隔离应设置 ISOLATED 且携带替代 TestCase")
    void isolate_shouldSetIsolatedWithReplacement() {
        // Arrange
        FlakyCase entity = tracked(6, false);
        entity.setStatus(FlakyCaseStatus.FLAKY);
        when(repository.findById(caseId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);

        // Act
        FlakyCaseDto dto = service.isolate(tenantId, caseId,
                new FlakyIsolateRequest("TC-GB50016-001-DET"));

        // Assert
        assertThat(dto.status()).isEqualTo(FlakyCaseStatus.ISOLATED);
        assertThat(dto.replacementCaseId()).isEqualTo("TC-GB50016-001-DET");
    }

    @Test
    @DisplayName("已隔离的 Case 不可重复隔离")
    void isolate_shouldRejectAlreadyIsolated() {
        // Arrange
        FlakyCase entity = tracked(6, false);
        entity.setStatus(FlakyCaseStatus.ISOLATED);
        when(repository.findById(caseId)).thenReturn(Optional.of(entity));

        // Act & Assert
        assertThatThrownBy(() -> service.isolate(tenantId, caseId, new FlakyIsolateRequest(null)))
                .isInstanceOf(BusinessException.class);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("修复应记录根因分类与最小回归样本")
    void resolve_shouldRecordRootCauseAndSample() {
        // Arrange
        FlakyCase entity = tracked(6, false);
        entity.setStatus(FlakyCaseStatus.ISOLATED);
        when(repository.findById(caseId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);

        // Act
        FlakyCaseDto dto = service.resolve(tenantId, caseId,
                new FlakyResolveRequest("TIMING", "TC-GB50016-001@a1b2c3"));

        // Assert
        assertThat(dto.status()).isEqualTo(FlakyCaseStatus.RESOLVED);
        assertThat(dto.rootCause()).isEqualTo("TIMING");
        assertThat(dto.regressionSample()).isEqualTo("TC-GB50016-001@a1b2c3");
    }

    // ===== GET 列表 =====

    @Test
    @DisplayName("列表应按租户过滤分页")
    void list_shouldFilterByTenantAndPage() {
        // Arrange
        FlakyCase entity = tracked(3, true);
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        Pageable pageable = PageRequest.of(0, 20);

        // Act
        Page<FlakyCaseDto> result = service.list(tenantId, null, pageable);

        // Assert
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).id()).isEqualTo(caseId);
    }

    // ===== Flaky Case 率验收 =====

    @Test
    @DisplayName("Flaky 率超 5% 应判定超标")
    void rateExceeded_shouldReturnTrueWhenOverLimit() {
        // Arrange
        when(repository.countByTenantIdAndStatusIn(eq(tenantId), any()))
                .thenReturn(2L);
        when(repository.countByTenantId(tenantId)).thenReturn(30L);

        // Act
        boolean exceeded = service.isFlakyRateExceeded(tenantId);

        // Assert
        assertThat(exceeded).isTrue();
    }

    @Test
    @DisplayName("Flaky 率低于 5% 应判定未超标")
    void rateExceeded_shouldReturnFalseWhenUnderLimit() {
        // Arrange
        when(repository.countByTenantIdAndStatusIn(eq(tenantId), any()))
                .thenReturn(1L);
        when(repository.countByTenantId(tenantId)).thenReturn(40L);

        // Act
        boolean exceeded = service.isFlakyRateExceeded(tenantId);

        // Assert
        assertThat(exceeded).isFalse();
    }

    @Test
    @DisplayName("无 Flaky Case 记录应判定未超标")
    void rateExceeded_shouldReturnFalseWhenNoCase() {
        // Arrange
        when(repository.countByTenantId(tenantId)).thenReturn(0L);

        // Act
        boolean exceeded = service.isFlakyRateExceeded(tenantId);

        // Assert
        assertThat(exceeded).isFalse();
    }

    // ===== 辅助方法 =====

    private FlakyCase tracked(int runCount, boolean lastResult) {
        FlakyCase f = new FlakyCase();
        f.setId(caseId);
        f.setTenantId(tenantId);
        f.setTestCaseId(testCaseId);
        f.setRequirementId("REQ-001");
        f.setStatus(FlakyCaseStatus.TRACKED);
        f.setRunCount(runCount);
        f.setLastResult(lastResult);
        return f;
    }
}
