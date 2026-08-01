package com.platform.core.governance.qualitygate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.response.BusinessException;
import com.platform.core.governance.qualitygate.domain.QualityGate;
import com.platform.core.governance.qualitygate.domain.QualityGateLevel;
import com.platform.core.governance.qualitygate.domain.QualityGateStatus;
import com.platform.core.governance.qualitygate.dto.QualityGateCreateRequest;
import com.platform.core.governance.qualitygate.dto.QualityGateDto;
import com.platform.core.governance.qualitygate.dto.QualityGateSignRequest;
import com.platform.core.governance.qualitygate.repository.QualityGateRepository;
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
 * QualityGateService 单元测试（D45.23 质量门禁与验收签署，SIT P0-13.4）
 *
 * <p>覆盖：创建（6 级 Gate 预置检查项）、非法 gateLevel 拒绝、详情、分页列表、
 * 签署（PASS/FAIL）、AI 代签拒绝（红线）、重复签署拒绝。
 *
 * <p>权威源：QualityGateService.java + D45.23
 */
@DisplayName("QualityGateService 质量门禁服务")
@ExtendWith(MockitoExtension.class)
class QualityGateServiceTest {

    @Mock
    private QualityGateRepository repository;

    private QualityGateService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID gateId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID signerId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new QualityGateService(repository);
    }

    // ===== POST create =====

    @Test
    @DisplayName("创建 PR_MERGE 门禁应预置检查项")
    void create_shouldInitPrMergeChecks() {
        // Arrange
        when(repository.save(any(QualityGate.class))).thenAnswer(inv -> {
            QualityGate g = inv.getArgument(0);
            g.setId(gateId);
            return g;
        });
        QualityGateCreateRequest request = new QualityGateCreateRequest("PR_MERGE", "R2.1");

        // Act
        QualityGateDto dto = service.create(tenantId, request);

        // Assert
        assertThat(dto.id()).isEqualTo(gateId);
        assertThat(dto.gateLevel()).isEqualTo(QualityGateLevel.PR_MERGE);
        assertThat(dto.status()).isEqualTo(QualityGateStatus.NOT_STARTED);
        assertThat(dto.checks()).contains("static-unit", "security-quick-scan");
        assertThat(dto.aiSigned()).isFalse();
        verify(repository).save(any(QualityGate.class));
    }

    @Test
    @DisplayName("创建 PRODUCTION_PROMOTION 门禁应包含 Critical Trace Coverage 检查项")
    void create_shouldInitProductionChecks() {
        // Arrange
        when(repository.save(any(QualityGate.class))).thenAnswer(inv -> {
            QualityGate g = inv.getArgument(0);
            g.setId(gateId);
            return g;
        });
        QualityGateCreateRequest request =
                new QualityGateCreateRequest("PRODUCTION_PROMOTION", "R2.1");

        // Act
        QualityGateDto dto = service.create(tenantId, request);

        // Assert
        assertThat(dto.checks()).contains("critical-trace-coverage", "signed-bundle", "go-no-go");
    }

    @Test
    @DisplayName("非法 gateLevel 应拒绝")
    void create_shouldRejectInvalidLevel() {
        // Arrange
        QualityGateCreateRequest request = new QualityGateCreateRequest("UNKNOWN_GATE", "R2.1");

        // Act & Assert
        assertThatThrownBy(() -> service.create(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("gateLevel");
        verify(repository, never()).save(any());
    }

    // ===== GET 详情 =====

    @Test
    @DisplayName("详情不存在应返回 404")
    void get_shouldReturnNotFoundWhenMissing() {
        // Arrange
        when(repository.findById(gateId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.get(tenantId, gateId))
                .isInstanceOf(BusinessException.class);
    }

    // ===== GET 列表 =====

    @Test
    @DisplayName("列表应按租户过滤分页")
    void list_shouldFilterByTenantAndPage() {
        // Arrange
        QualityGate entity = entity();
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        Pageable pageable = PageRequest.of(0, 20);

        // Act
        Page<QualityGateDto> result = service.list(tenantId, null, pageable);

        // Assert
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).id()).isEqualTo(gateId);
    }

    // ===== POST :sign =====

    @Test
    @DisplayName("签署 PASS 应设置 PASSED 且记录签署角色与时间")
    void sign_shouldPassWhenDecisionPass() {
        // Arrange
        QualityGate entity = entity();
        when(repository.findById(gateId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);
        QualityGateSignRequest request =
                new QualityGateSignRequest("Developer+Reviewer", signerId, "PASS");

        // Act
        QualityGateDto dto = service.sign(tenantId, gateId, request);

        // Assert
        assertThat(dto.status()).isEqualTo(QualityGateStatus.PASSED);
        assertThat(dto.decision()).isEqualTo("PASS");
        assertThat(dto.signerRole()).isEqualTo("Developer+Reviewer");
        assertThat(dto.signedBy()).isEqualTo(signerId);
        assertThat(dto.signedAt()).isNotNull();
        assertThat(dto.aiSigned()).isFalse();
    }

    @Test
    @DisplayName("签署 FAIL 应设置 FAILED")
    void sign_shouldFailWhenDecisionFail() {
        // Arrange
        QualityGate entity = entity();
        when(repository.findById(gateId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenReturn(entity);
        QualityGateSignRequest request =
                new QualityGateSignRequest("QA Lead", signerId, "FAIL");

        // Act
        QualityGateDto dto = service.sign(tenantId, gateId, request);

        // Assert
        assertThat(dto.status()).isEqualTo(QualityGateStatus.FAILED);
        assertThat(dto.decision()).isEqualTo("FAIL");
    }

    @Test
    @DisplayName("AI 角色签署应拒绝（AI 不代签红线）")
    void sign_shouldRejectAiSigner() {
        // Act & Assert（角色校验先于 DB 查询，无需 stub）
        QualityGateSignRequest request =
                new QualityGateSignRequest("AI", signerId, "PASS");

        assertThatThrownBy(() -> service.sign(tenantId, gateId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AI 不代签");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("AGENT 角色签署应拒绝（AI 不代签红线）")
    void sign_shouldRejectAgentSigner() {
        // Act & Assert（角色校验先于 DB 查询，无需 stub）
        QualityGateSignRequest request =
                new QualityGateSignRequest("agent", signerId, "PASS");

        assertThatThrownBy(() -> service.sign(tenantId, gateId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AI 不代签");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("已签署门禁不可重复签署")
    void sign_shouldRejectAlreadySigned() {
        // Arrange
        QualityGate entity = entity();
        entity.setStatus(QualityGateStatus.PASSED);
        when(repository.findById(gateId)).thenReturn(Optional.of(entity));
        QualityGateSignRequest request =
                new QualityGateSignRequest("Release Authority", signerId, "PASS");

        // Act & Assert
        assertThatThrownBy(() -> service.sign(tenantId, gateId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不可重复签署");
        verify(repository, never()).save(any());
    }

    // ===== 辅助方法 =====

    private QualityGate entity() {
        QualityGate g = new QualityGate();
        g.setId(gateId);
        g.setTenantId(tenantId);
        g.setGateLevel(QualityGateLevel.PR_MERGE);
        g.setStatus(QualityGateStatus.NOT_STARTED);
        g.setVersionTarget("R2.1");
        g.setChecks("[]");
        return g;
    }
}
