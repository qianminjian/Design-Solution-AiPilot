package com.platform.core.governance.testexception.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.response.BusinessException;
import com.platform.core.governance.testexception.domain.TestException;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import com.platform.core.governance.testexception.dto.TestExceptionCreateRequest;
import com.platform.core.governance.testexception.dto.TestExceptionDto;
import com.platform.core.governance.testexception.dto.TestExceptionRevokeRequest;
import com.platform.core.governance.testexception.repository.TestExceptionRepository;
import java.time.Instant;
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
 * TestExceptionService 单元测试（D45.22 例外治理 / D45.25 TestException API，SIT P0-13.3）
 *
 * <p>覆盖：创建（签署即生效）、非法 risk 拒绝、approvers 缺失拒绝、expiry 过期拒绝、
 * 详情、分页列表、撤销（状态校验）、到期自动撤销。
 *
 * <p>权威源：TestExceptionService.java + D45.22 + D45.25
 */
@DisplayName("TestExceptionService 测试例外服务")
@ExtendWith(MockitoExtension.class)
class TestExceptionServiceTest {

    @Mock
    private TestExceptionRepository repository;

    private TestExceptionService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID exceptionId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final String approversJson =
            "[{\"principalId\":\"33333333-3333-3333-3333-333333333333\","
                    + "\"signedAt\":\"2026-08-01T00:00:00Z\",\"comment\":\"风险接受\"}]";

    @BeforeEach
    void setUp() {
        service = new TestExceptionService(repository);
    }

    // ===== POST create =====

    @Test
    @DisplayName("创建应成功且签署即生效（ACTIVE）")
    void create_shouldActivateSignedException() {
        // Arrange
        TestException saved = entity();
        saved.setId(exceptionId);
        when(repository.save(any(TestException.class))).thenAnswer(inv -> {
            TestException e = inv.getArgument(0);
            e.setId(exceptionId);
            return e;
        });
        TestExceptionCreateRequest request = validRequest();

        // Act
        TestExceptionDto dto = service.create(tenantId, request);

        // Assert
        assertThat(dto.id()).isEqualTo(exceptionId);
        assertThat(dto.status()).isEqualTo(TestExceptionStatus.ACTIVE);
        assertThat(dto.risk()).isEqualTo("HIGH");
        assertThat(dto.scope()).isEqualTo("REQ-GB50016-6.4.11");
        assertThat(dto.versionTarget()).isEqualTo("R2.1");
        verify(repository).save(any(TestException.class));
    }

    @Test
    @DisplayName("非法 risk 应拒绝")
    void create_shouldRejectInvalidRisk() {
        // Arrange
        TestExceptionCreateRequest request = new TestExceptionCreateRequest(
                "REQ-X", "理由", "SEVERE", "补偿控制", approversJson,
                Instant.now().plusSeconds(3600), null, null, "R2.1", null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("risk");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("approvers 缺失应拒绝（例外有签署验收）")
    void create_shouldRejectMissingApprovers() {
        // Arrange
        TestExceptionCreateRequest request = new TestExceptionCreateRequest(
                "REQ-X", "理由", "HIGH", "补偿控制", "[]",
                Instant.now().plusSeconds(3600), null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("approvers");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("approvers 缺 signedAt 应拒绝（例外有签署验收）")
    void create_shouldRejectApproversWithoutSignedAt() {
        // Arrange
        TestExceptionCreateRequest request = new TestExceptionCreateRequest(
                "REQ-X", "理由", "HIGH", "补偿控制",
                "[{\"principalId\":\"33333333-3333-3333-3333-333333333333\"}]",
                Instant.now().plusSeconds(3600), null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("signedAt");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("expiry 早于当前时间应拒绝")
    void create_shouldRejectPastExpiry() {
        // Arrange
        TestExceptionCreateRequest request = new TestExceptionCreateRequest(
                "REQ-X", "理由", "HIGH", "补偿控制", approversJson,
                Instant.now().minusSeconds(60), null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("expiry");
        verify(repository, never()).save(any());
    }

    // ===== GET 详情 =====

    @Test
    @DisplayName("详情不存在应返回 404")
    void get_shouldReturnNotFoundWhenMissing() {
        // Arrange
        when(repository.findById(exceptionId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.get(tenantId, exceptionId))
                .isInstanceOf(BusinessException.class);
    }

    // ===== GET 列表 =====

    @Test
    @DisplayName("列表应按租户过滤分页")
    void list_shouldFilterByTenantAndPage() {
        // Arrange
        TestException entity = entity();
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        Pageable pageable = PageRequest.of(0, 20);

        // Act
        Page<TestExceptionDto> result = service.list(tenantId, null, pageable);

        // Assert
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).id()).isEqualTo(entity.getId());
    }

    // ===== POST :revoke =====

    @Test
    @DisplayName("撤销 ACTIVE 例外应成功")
    void revoke_shouldSucceedForActive() {
        // Arrange
        TestException entity = entity();
        when(repository.findById(exceptionId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);

        // Act
        TestExceptionDto dto = service.revoke(tenantId, exceptionId,
                new TestExceptionRevokeRequest("补偿控制已生效"));

        // Assert
        assertThat(dto.status()).isEqualTo(TestExceptionStatus.REVOKED);
        verify(repository).save(entity);
    }

    @Test
    @DisplayName("撤销已撤销的例外应拒绝")
    void revoke_shouldRejectAlreadyRevoked() {
        // Arrange
        TestException entity = entity();
        entity.setStatus(TestExceptionStatus.EXPIRED);
        when(repository.findById(exceptionId)).thenReturn(Optional.of(entity));

        // Act & Assert
        assertThatThrownBy(() -> service.revoke(tenantId, exceptionId,
                new TestExceptionRevokeRequest("撤销")))
                .isInstanceOf(BusinessException.class);
        verify(repository, never()).save(any());
    }

    // ===== 到期自动撤销 =====

    @Test
    @DisplayName("到期例外应批量撤销为 EXPIRED")
    void expireOverdue_shouldBulkMarkExpired() {
        // Arrange
        when(repository.bulkMarkExpired(
                eq(TestExceptionStatus.ACTIVE), eq(TestExceptionStatus.EXPIRED), any(Instant.class)))
                .thenReturn(2);

        // Act
        int affected = service.expireOverdue(Instant.now());

        // Assert
        assertThat(affected).isEqualTo(2);
        verify(repository).bulkMarkExpired(
                eq(TestExceptionStatus.ACTIVE), eq(TestExceptionStatus.EXPIRED), any(Instant.class));
    }

    @Test
    @DisplayName("无到期例外应返回 0 且不记录 INFO 日志")
    void expireOverdue_shouldReturnZeroWhenNone() {
        // Arrange
        when(repository.bulkMarkExpired(
                eq(TestExceptionStatus.ACTIVE), eq(TestExceptionStatus.EXPIRED), any(Instant.class)))
                .thenReturn(0);

        // Act
        int affected = service.expireOverdue(Instant.now());

        // Assert
        assertThat(affected).isZero();
    }

    // ===== 辅助方法 =====

    private TestExceptionCreateRequest validRequest() {
        return new TestExceptionCreateRequest(
                "REQ-GB50016-6.4.11", "第三方构件兼容性风险接受", "HIGH", "补偿控制：降级回退方案",
                approversJson, Instant.now().plusSeconds(7 * 86400),
                "R3 版本升级后复测", "残余风险：兼容性影响范围受限", "R2.1", "test-run-001");
    }

    private TestException entity() {
        TestException e = new TestException();
        e.setId(exceptionId);
        e.setTenantId(tenantId);
        e.setScope("REQ-GB50016-6.4.11");
        e.setReason("第三方构件兼容性风险接受");
        e.setRisk("HIGH");
        e.setCompensation("补偿控制：降级回退方案");
        e.setApprovers(approversJson);
        e.setExpiry(Instant.now().plusSeconds(7 * 86400));
        e.setVersionTarget("R2.1");
        e.setStatus(TestExceptionStatus.ACTIVE);
        return e;
    }
}
