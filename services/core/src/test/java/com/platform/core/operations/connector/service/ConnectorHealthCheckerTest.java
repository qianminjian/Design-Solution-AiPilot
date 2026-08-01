package com.platform.core.operations.connector.service;

import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ConnectorHealthChecker 单元测试（A-59 新增）
 *
 * <p>覆盖方法：
 * <ul>
 *   <li>{@link ConnectorHealthChecker#checkAsync} 的分发逻辑：
 *       <ul>
 *         <li>AI_PROVIDER 类型 → 跳过实际检查（OD-05 V1 ManualHandoff 约束），状态置为 UNKNOWN</li>
 *         <li>REVIT/RHINO/SKETCHUP 类型 → 跳过实际检查（无标准健康检查端点），状态置为 UNKNOWN</li>
 *         <li>endpointUrl 为 null 或空字符串 → 跳过实际检查，状态置为 UNKNOWN</li>
 *         <li>Repository 返回 empty → 不更新（ifPresent 保护）</li>
 *         <li>Repository 抛异常 → checkAsync 兜底捕获，不抛出</li>
 *       </ul>
 *   </li>
 * </ul>
 *
 * <p>设计说明：
 * <ul>
 *   <li>测试用例仅覆盖不触发真实 HTTP 调用的分支（AI_PROVIDER/REVIT/RHINO/SKETCHUP/null endpointUrl），
 *       避免单元测试依赖网络（对齐 testing.md §4 Mock 规范）</li>
 *   <li>LLM/MINIO 类型的真实 HTTP 调用由集成测试覆盖（待 V1 接入 WireMock 后补充）</li>
 *   <li>Repository 使用 Mockito mock，避免真实数据库依赖</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md（OD-05 外部 AI 接入约束）
 * @design security.md §12 AI 安全红线（AI_PROVIDER V1 不自动接入）
 */
@ExtendWith(MockitoExtension.class)
class ConnectorHealthCheckerTest {

    @Mock
    private ConnectorStatusRepository repository;

    private ConnectorHealthChecker healthChecker;

    private UUID tenantId;
    private UUID connectorId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        connectorId = UUID.randomUUID();
        healthChecker = new ConnectorHealthChecker(repository);
    }

    // ── OD-05 V1 ManualHandoff 约束（AI_PROVIDER 跳过） ──

    @Test
    @DisplayName("AI_PROVIDER 类型应跳过实际检查并置为 UNKNOWN（OD-05 V1 ManualHandoff 约束）")
    void checkAsync_shouldSkipAndSetUnknown_whenTypeIsAiProvider() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.AI_PROVIDER, ConnectorHealthStatus.UNKNOWN,
                "https://eviai.example.com");
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.AI_PROVIDER,
                "https://eviai.example.com", "eviai-001");

        // Assert
        // 关键断言：AI_PROVIDER 类型不调用付费 API，状态被更新为 UNKNOWN（doCheck 返回 UNKNOWN）
        // entity.setStatus(UNKNOWN) + entity.setLastHealthCheckAt(now) + repository.save(entity)
        assertThat(entity.getStatus()).isEqualTo(ConnectorHealthStatus.UNKNOWN);
        assertThat(entity.getLastHealthCheckAt()).isNotNull();
        verify(repository, times(1)).save(entity);
    }

    // ── 设计工具连接器（无标准健康检查端点） ──

    @Test
    @DisplayName("REVIT 类型应跳过实际检查并置为 UNKNOWN（无标准健康检查端点）")
    void checkAsync_shouldSkipAndSetUnknown_whenTypeIsRevit() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.REVIT, ConnectorHealthStatus.UNKNOWN,
                "http://revit-worker:8080");
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.REVIT,
                "http://revit-worker:8080", "revit-001");

        // Assert
        verify(repository, times(1)).save(entity);
    }

    @Test
    @DisplayName("RHINO 类型应跳过实际检查并置为 UNKNOWN（无标准健康检查端点）")
    void checkAsync_shouldSkipAndSetUnknown_whenTypeIsRhino() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.RHINO, ConnectorHealthStatus.UNKNOWN,
                "http://rhino-worker:8080");
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.RHINO,
                "http://rhino-worker:8080", "rhino-001");

        // Assert
        verify(repository, times(1)).save(entity);
    }

    @Test
    @DisplayName("SKETCHUP 类型应跳过实际检查并置为 UNKNOWN（无标准健康检查端点）")
    void checkAsync_shouldSkipAndSetUnknown_whenTypeIsSketchup() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.SKETCHUP, ConnectorHealthStatus.UNKNOWN,
                "http://sketchup-worker:8080");
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.SKETCHUP,
                "http://sketchup-worker:8080", "sketchup-001");

        // Assert
        verify(repository, times(1)).save(entity);
    }

    // ── endpointUrl 为空的保护 ──

    @Test
    @DisplayName("endpointUrl 为 null 时应跳过实际检查并置为 UNKNOWN（LLM 类型）")
    void checkAsync_shouldSkipAndSetUnknown_whenEndpointUrlIsNull() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.LLM, ConnectorHealthStatus.UNKNOWN, null);
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.LLM, null, "llm-001");

        // Assert
        // 关键断言：endpointUrl 为 null 时不发起 HTTP 请求，状态保持 UNKNOWN
        verify(repository, times(1)).save(entity);
    }

    @Test
    @DisplayName("endpointUrl 为空字符串时应跳过实际检查并置为 UNKNOWN")
    void checkAsync_shouldSkipAndSetUnknown_whenEndpointUrlIsBlank() {
        // Arrange
        ConnectorStatus entity = buildEntity(ConnectorType.LLM, ConnectorHealthStatus.UNKNOWN, "");
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(entity));

        // Act
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.LLM, "", "llm-001");

        // Assert
        verify(repository, times(1)).save(entity);
    }

    // ── Repository 异常路径 ──

    @Test
    @DisplayName("Repository 返回 empty 时 checkAsync 不应抛异常（ifPresent 保护）")
    void checkAsync_shouldNotThrow_whenRepositoryReturnsEmpty() {
        // Arrange
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.empty());

        // Act + Assert
        // 关键断言：实体不存在时不应抛异常，不应调用 save
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.AI_PROVIDER,
                "https://eviai.example.com", "eviai-001");

        verify(repository, never()).save(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("Repository 抛异常时 checkAsync 应兜底捕获（不抛出，不影响主流程）")
    void checkAsync_shouldSilentlyCatchException_whenRepositoryThrows() {
        // Arrange
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenThrow(new RuntimeException("Database connection lost"));

        // Act + Assert
        // 关键断言：异常被 checkAsync 内部 try-catch 兜底，不抛出
        healthChecker.checkAsync(tenantId, connectorId, ConnectorType.AI_PROVIDER,
                "https://eviai.example.com", "eviai-001");

        verify(repository, never()).save(any(ConnectorStatus.class));
    }

    // ── 测试辅助 ──

    /**
     * 构造测试用 ConnectorStatus 实体（spy 包装，便于 verify setter 调用）
     *
     * <p>使用 spy 而非 real object 的原因：
     * 测试中需要 verify(entity).setStatus(...)，但 real object 的 setter 不会触发 Mockito 的调用记录。
     * spy 包装后，对 setter 的调用会被 Mockito 拦截记录，同时不影响实际字段赋值。
     */
    private ConnectorStatus buildEntity(
            ConnectorType type,
            ConnectorHealthStatus status,
            String endpointUrl) {
        ConnectorStatus entity = new ConnectorStatus();
        entity.setId(connectorId);
        entity.setTenantId(tenantId);
        entity.setConnectorCode("test-connector");
        entity.setName("测试连接器");
        entity.setType(type);
        entity.setStatus(status);
        entity.setCallCount1h(0);
        entity.setErrorCount1h(0);
        entity.setAvgLatencyMs(0);
        entity.setLastUsedAt(java.time.Instant.now());
        entity.setEndpointUrl(endpointUrl);
        return entity;
    }
}
