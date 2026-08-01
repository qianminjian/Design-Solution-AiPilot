package com.platform.core.governance.testevidence.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.testevidence.domain.TestEvidence;
import com.platform.core.governance.testevidence.domain.TestEvidenceRetention;
import com.platform.core.governance.testevidence.domain.TestEvidenceType;
import com.platform.core.governance.testevidence.dto.TestEvidenceCreateRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceDto;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyResult;
import com.platform.core.governance.testevidence.repository.TestEvidenceRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * TestEvidenceService 单元测试（P0-1.4 测试报告与证据存储）
 *
 * <p>覆盖：
 * <ul>
 *   <li>POST create：成功创建（含 testRunId 关联）</li>
 *   <li>POST create：证据类型非法拒绝</li>
 *   <li>POST create：retention 非法拒绝</li>
 *   <li>POST create：classification 非法拒绝</li>
 *   <li>GET 详情：不存在返回 404</li>
 *   <li>POST verify：hash 匹配校验通过</li>
 *   <li>POST verify：hash 不匹配校验失败</li>
 *   <li>POST verify：记录不存在返回 404</li>
 *   <li>GET 列表：按租户过滤分页</li>
 *   <li>GET 列表：跨租户不可见（byObject 过滤）</li>
 * </ul>
 *
 * <p>权威源：TestEvidenceService.java + D45.10 + P0-1.4 路线图
 */
@DisplayName("TestEvidenceService 测试证据服务")
@ExtendWith(MockitoExtension.class)
class TestEvidenceServiceTest {

    @Mock
    private TestEvidenceRepository repository;

    private TestEvidenceService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID evidenceId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final String sha256Hex =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private final String otherSha256Hex =
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    @BeforeEach
    void setUp() {
        service = new TestEvidenceService(repository);
    }

    // ===== POST create =====

    @Test
    @DisplayName("POST create 应成功创建证据记录并携带 testRunId")
    void create_shouldPersistEvidenceWithTestRunId() {
        // Arrange
        TestEvidenceCreateRequest request = validRequest();
        TestEvidence saved = entityWith(TestEvidenceType.INTEGRATION);
        saved.setId(evidenceId);
        when(repository.save(any(TestEvidence.class))).thenAnswer(inv -> {
            TestEvidence e = inv.getArgument(0);
            e.setId(evidenceId);
            return e;
        });

        // Act
        TestEvidenceDto dto = service.create(tenantId, request);

        // Assert
        assertThat(dto.id()).isEqualTo(evidenceId);
        assertThat(dto.evidenceType()).isEqualTo(TestEvidenceType.INTEGRATION);
        assertThat(dto.retention()).isEqualTo(TestEvidenceRetention.DAYS_90);
        assertThat(dto.classification()).isEqualTo("L4");
        assertThat(dto.testRunId()).isEqualTo("test-run-001");
        assertThat(dto.hash()).isEqualTo(sha256Hex);
        verify(repository).save(any(TestEvidence.class));
    }

    @Test
    @DisplayName("POST create 证据类型非法应拒绝")
    void create_shouldRejectInvalidEvidenceType() {
        // Arrange
        TestEvidenceCreateRequest request =
                new TestEvidenceCreateRequest(
                        "INVALID_TYPE", "s3://bucket/ev.json", sha256Hex, "mvn", "1.0.0",
                        "unit run", "DAYS_90", "L4", null, null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                });
        verify(repository, never()).save(any(TestEvidence.class));
    }

    @Test
    @DisplayName("POST create retention 非法应拒绝")
    void create_shouldRejectInvalidRetention() {
        // Arrange
        TestEvidenceCreateRequest request =
                new TestEvidenceCreateRequest(
                        "UNIT", "s3://bucket/ev.json", sha256Hex, "mvn", "1.0.0",
                        "unit run", "FOREVER", "L4", null, null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                });
        verify(repository, never()).save(any(TestEvidence.class));
    }

    @Test
    @DisplayName("POST create classification 非法应拒绝")
    void create_shouldRejectInvalidClassification() {
        // Arrange
        TestEvidenceCreateRequest request =
                new TestEvidenceCreateRequest(
                        "UNIT", "s3://bucket/ev.json", sha256Hex, "mvn", "1.0.0",
                        "unit run", "DAYS_90", "L9", null, null, null, null, null);

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                });
        verify(repository, never()).save(any(TestEvidence.class));
    }

    // ===== GET 详情 =====

    @Test
    @DisplayName("GET 详情 记录不存在应返回 404")
    void get_shouldReturnNotFoundWhenMissing() {
        // Arrange
        when(repository.findById(evidenceId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.get(tenantId, evidenceId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }

    @Test
    @DisplayName("GET 详情 跨租户记录不可见")
    void get_shouldHideOtherTenantEvidence() {
        // Arrange
        TestEvidence otherTenant = entityWith(TestEvidenceType.UNIT);
        otherTenant.setTenantId(UUID.fromString("99999999-9999-9999-9999-999999999999"));
        when(repository.findById(evidenceId)).thenReturn(Optional.of(otherTenant));

        // Act & Assert
        assertThatThrownBy(() -> service.get(tenantId, evidenceId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }

    // ===== POST verify =====

    @Test
    @DisplayName("POST verify hash 匹配应校验通过")
    void verify_shouldPassWhenHashMatches() {
        // Arrange
        TestEvidence entity = entityWith(TestEvidenceType.CONTRACT);
        when(repository.findById(evidenceId)).thenReturn(Optional.of(entity));
        TestEvidenceVerifyRequest request =
                new TestEvidenceVerifyRequest(evidenceId, sha256Hex);

        // Act
        TestEvidenceVerifyResult result = service.verify(tenantId, request);

        // Assert
        assertThat(result.verified()).isTrue();
        assertThat(result.storedHash()).isEqualTo(sha256Hex);
    }

    @Test
    @DisplayName("POST verify hash 不匹配应校验失败")
    void verify_shouldFailWhenHashMismatch() {
        // Arrange
        TestEvidence entity = entityWith(TestEvidenceType.CONTRACT);
        when(repository.findById(evidenceId)).thenReturn(Optional.of(entity));
        TestEvidenceVerifyRequest request =
                new TestEvidenceVerifyRequest(evidenceId, otherSha256Hex);

        // Act
        TestEvidenceVerifyResult result = service.verify(tenantId, request);

        // Assert
        assertThat(result.verified()).isFalse();
        assertThat(result.actualHash()).isEqualTo(otherSha256Hex);
    }

    @Test
    @DisplayName("POST verify 记录不存在应返回 404")
    void verify_shouldReturnNotFoundWhenMissing() {
        // Arrange
        when(repository.findById(evidenceId)).thenReturn(Optional.empty());
        TestEvidenceVerifyRequest request =
                new TestEvidenceVerifyRequest(evidenceId, sha256Hex);

        // Act & Assert
        assertThatThrownBy(() -> service.verify(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }

    // ===== GET 列表 =====

    @Test
    @DisplayName("GET 列表 应按租户过滤并分页返回")
    void list_shouldFilterByTenantAndPage() {
        // Arrange
        TestEvidence entity = entityWith(TestEvidenceType.E2E);
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        Pageable pageable = PageRequest.of(0, 20);

        // Act
        Page<TestEvidenceDto> result = service.list(tenantId, null, null, pageable);

        // Assert
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).id()).isEqualTo(entity.getId());
    }

    // ===== byObject（P0-13.x 质量门禁引用）=====

    @Test
    @DisplayName("byObject 跨租户记录应被过滤")
    void findByObject_shouldFilterOtherTenant() {
        // Arrange
        TestEvidence sameTenant = entityWith(TestEvidenceType.ACCEPTANCE);
        sameTenant.setTenantId(tenantId);
        TestEvidence otherTenant = entityWith(TestEvidenceType.ACCEPTANCE);
        otherTenant.setTenantId(UUID.fromString("99999999-9999-9999-9999-999999999999"));
        when(repository.findByObjectIdAndObjectType("release-1", "release"))
                .thenReturn(List.of(sameTenant, otherTenant));

        // Act
        List<TestEvidenceDto> result =
                service.findByObject(tenantId, "release-1", "release");

        // Assert
        assertThat(result).hasSize(1);
    }

    // ===== 辅助方法 =====

    private TestEvidenceCreateRequest validRequest() {
        return new TestEvidenceCreateRequest(
                "INTEGRATION", "s3://bucket/evidence/int-001.json", sha256Hex,
                "mvn-failsafe", "1.0.0", "集成测试运行摘要",
                "DAYS_90", "L4", "HMAC-SHA256", "c2ln",
                "release-1", "release", "test-run-001");
    }

    private TestEvidence entityWith(TestEvidenceType type) {
        TestEvidence e = new TestEvidence();
        e.setId(evidenceId);
        e.setTenantId(tenantId);
        e.setEvidenceType(type);
        e.setObjectUri("s3://bucket/evidence/int-001.json");
        e.setHash(sha256Hex);
        e.setTool("mvn-failsafe");
        e.setVersion("1.0.0");
        e.setRawSummary("集成测试运行摘要");
        e.setRetention(TestEvidenceRetention.DAYS_90);
        e.setClassification("L4");
        e.setTestRunId("test-run-001");
        return e;
    }
}
