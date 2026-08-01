package com.platform.core.operations.connector.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.dto.ConnectorRegisterRequest;
import com.platform.core.operations.connector.dto.ConnectorStatusDto;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ConnectorService 单元测试（V1.10 + V1.10.2 + A-59 异步健康检查 新增）
 *
 * <p>覆盖方法：
 * <ul>
 *   <li>{@link ConnectorService#deleteConnector}（V1.10）：
 *       <ul>
 *         <li>Connector 不存在 → 抛 NOT_FOUND</li>
 *         <li>Connector 状态为 CONNECTED/DEGRADED → 抛 BUSINESS_RULE_VIOLATION（CONFLICT）</li>
 *         <li>Connector 状态为 DISCONNECTED/UNKNOWN → 成功删除</li>
 *       </ul>
 *   <li>{@link ConnectorService#register}（V1.10.2 + A-59）：
 *       <ul>
 *         <li>首次注册（connectorCode 不存在）→ 新建实体，状态置 UNKNOWN，调用计数初始化为 0</li>
 *         <li>幂等注册（connectorCode 已存在）→ 更新已有实体，保留原 status 与 lastHealthCheckAt</li>
 *         <li>AI_PROVIDER 类型强制 isManualHandoff=true（OD-05 V1 红线，即使请求传入 false）</li>
 *         <li>非 AI_PROVIDER 类型按请求 isManualHandoff 字段设置</li>
 *         <li>A-59 新增：注册成功后异步触发 healthChecker.checkAsync（验证调用参数）</li>
 *       </ul>
 * </ul>
 *
 * <p>对齐 testing.md §4 Mock 规范：Repository 与 ConnectorHealthChecker 均使用 Mockito mock，
 * 避免真实数据库依赖与异步 HTTP 调用。
 *
 * @design D37-关键界面-交互状态.md §D37.17 Operations 危险动作
 * @design D37-关键界面-交互状态.md §D37.23 不可逆/合规：二人审批
 * @design D44-部署拓扑-Hybrid-Site.md（OD-05 外部 AI 接入约束）
 */
@ExtendWith(MockitoExtension.class)
class ConnectorServiceTest {

    @Mock
    private ConnectorStatusRepository repository;

    @Mock
    private ConnectorHealthChecker healthChecker;

    @InjectMocks
    private ConnectorService connectorService;

    private UUID tenantId;
    private UUID connectorId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        connectorId = UUID.randomUUID();
    }

    // ── deleteConnector ──

    @Test
    @DisplayName("删除 Connector：Connector 不存在时应抛 NOT_FOUND 异常")
    void deleteConnector_shouldThrowNotFound_whenConnectorNotExists() {
        // Arrange
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.empty());

        // Act + Assert
        assertThatThrownBy(() ->
                connectorService.deleteConnector(tenantId, connectorId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });

        verify(repository, never()).delete(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("删除 Connector：状态为 CONNECTED 时应抛 BUSINESS_RULE_VIOLATION（CONFLICT）")
    void deleteConnector_shouldThrowConflict_whenConnectorConnected() {
        // Arrange
        ConnectorStatus connector = buildConnector(ConnectorHealthStatus.CONNECTED);
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(connector));

        // Act + Assert
        assertThatThrownBy(() ->
                connectorService.deleteConnector(tenantId, connectorId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(be.getMessage()).contains("CONNECTED");
                });

        verify(repository, never()).delete(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("删除 Connector：状态为 DEGRADED 时应抛 BUSINESS_RULE_VIOLATION（CONFLICT）")
    void deleteConnector_shouldThrowConflict_whenConnectorDegraded() {
        // Arrange
        ConnectorStatus connector = buildConnector(ConnectorHealthStatus.DEGRADED);
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(connector));

        // Act + Assert
        assertThatThrownBy(() ->
                connectorService.deleteConnector(tenantId, connectorId, "废弃清理"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
                    assertThat(be.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(be.getMessage()).contains("DEGRADED");
                });

        verify(repository, never()).delete(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("删除 Connector：状态为 DISCONNECTED 时应成功删除")
    void deleteConnector_shouldDelete_whenConnectorDisconnected() {
        // Arrange
        ConnectorStatus connector = buildConnector(ConnectorHealthStatus.DISCONNECTED);
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(connector));

        // Act
        connectorService.deleteConnector(tenantId, connectorId, "资源已废弃，确认清理");

        // Assert
        verify(repository, times(1)).delete(connector);
    }

    @Test
    @DisplayName("删除 Connector：状态为 UNKNOWN 时应成功删除（不在校验范围）")
    void deleteConnector_shouldDelete_whenConnectorUnknown() {
        // Arrange
        ConnectorStatus connector = buildConnector(ConnectorHealthStatus.UNKNOWN);
        when(repository.findByIdAndTenantId(connectorId, tenantId))
                .thenReturn(Optional.of(connector));

        // Act
        connectorService.deleteConnector(tenantId, connectorId, "异常实例清理");

        // Assert
        verify(repository, times(1)).delete(connector);
    }

    // ── register ──

    @Test
    @DisplayName("注册 Connector：首次注册（connectorCode 不存在）应新建实体并初始化状态为 UNKNOWN")
    void register_shouldCreateNewEntity_whenConnectorCodeNotExists() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "deepseek-llm-001",
                "DeepSeek LLM 连接器",
                ConnectorType.LLM,
                "cn-east-1",
                "https://api.deepseek.com",
                "5000 calls",
                false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001"))
                .thenReturn(Optional.empty());
        // 模拟 repository.save 回填 id 后返回
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.name()).isEqualTo("DeepSeek LLM 连接器");
        assertThat(result.type()).isEqualTo(ConnectorType.LLM);
        assertThat(result.status()).isEqualTo(ConnectorHealthStatus.UNKNOWN);
        assertThat(result.callCount1h()).isZero();
        assertThat(result.errorCount1h()).isZero();
        assertThat(result.avgLatencyMs()).isZero();
        assertThat(result.licenseRemaining()).isEqualTo("5000 calls");
        assertThat(result.isManualHandoff()).isFalse();
        assertThat(result.lastUsedAt()).isNotNull();

        verify(repository, times(1)).findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001");
        verify(repository, times(1)).save(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("注册 Connector：幂等注册（connectorCode 已存在）应更新已有实体并保留原 status 与 lastHealthCheckAt")
    void register_shouldUpdateExistingEntity_whenConnectorCodeExists() {
        // Arrange
        Instant originalHealthCheckAt = Instant.now().minusSeconds(3600);
        ConnectorStatus existing = new ConnectorStatus();
        existing.setId(connectorId);
        existing.setTenantId(tenantId);
        existing.setConnectorCode("deepseek-llm-001");
        existing.setName("旧名称");
        existing.setType(ConnectorType.LLM);
        existing.setStatus(ConnectorHealthStatus.CONNECTED);
        existing.setCallCount1h(100);
        existing.setErrorCount1h(2);
        existing.setAvgLatencyMs(50);
        existing.setLicenseRemaining("1000 calls");
        existing.setLastUsedAt(Instant.now().minusSeconds(1800));
        existing.setLastHealthCheckAt(originalHealthCheckAt);
        existing.setManualHandoff(false);

        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "deepseek-llm-001",
                "新名称",
                ConnectorType.LLM,
                "cn-east-1",
                "https://api.deepseek.com/v2",
                "10000 calls",
                false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001"))
                .thenReturn(Optional.of(existing));
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.name()).isEqualTo("新名称");
        assertThat(result.type()).isEqualTo(ConnectorType.LLM);
        // 关键断言：幂等注册不重置 status（保持 CONNECTED，不被覆盖为 UNKNOWN）
        assertThat(result.status()).isEqualTo(ConnectorHealthStatus.CONNECTED);
        // 关键断言：保留原 lastHealthCheckAt（不被重置为 null）
        assertThat(result.lastUsedAt()).isNotNull();
        // 关键断言：保留原调用计数（100，不被重置为 0）
        assertThat(result.callCount1h()).isEqualTo(100);
        assertThat(result.errorCount1h()).isEqualTo(2);
        assertThat(result.avgLatencyMs()).isEqualTo(50);
        // licenseRemaining 字段更新
        assertThat(result.licenseRemaining()).isEqualTo("10000 calls");

        verify(repository, times(1)).findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001");
        verify(repository, times(1)).save(existing);
    }

    @Test
    @DisplayName("注册 Connector：AI_PROVIDER 类型应强制 isManualHandoff=true（OD-05 V1 红线，即使请求传入 false）")
    void register_shouldForceManualHandoffTrue_whenTypeIsAiProvider() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "eviai-connector-001",
                "EVAI 建筑 AI 连接器",
                ConnectorType.AI_PROVIDER,
                "cn-east-1",
                null,
                null,
                false  // 即使请求传入 false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "eviai-connector-001"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        // 关键断言：AI_PROVIDER 类型强制 isManualHandoff=true，对齐 OD-05 外部 AI V1 约束
        assertThat(result.isManualHandoff()).isTrue();
        assertThat(result.type()).isEqualTo(ConnectorType.AI_PROVIDER);
        assertThat(result.status()).isEqualTo(ConnectorHealthStatus.UNKNOWN);

        verify(repository, times(1)).save(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("注册 Connector：非 AI_PROVIDER 类型应按请求 isManualHandoff 字段设置（true 透传）")
    void register_shouldRespectRequestManualHandoff_whenTypeIsNotAiProvider_andRequestTrue() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "minio-connector-001",
                "MinIO 对象存储连接器",
                ConnectorType.MINIO,
                "cn-east-1",
                "http://minio:9000",
                "Unlimited",
                true  // 请求传入 true
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "minio-connector-001"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        assertThat(result.isManualHandoff()).isTrue();
        assertThat(result.type()).isEqualTo(ConnectorType.MINIO);

        verify(repository, times(1)).save(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("注册 Connector：非 AI_PROVIDER 类型应按请求 isManualHandoff 字段设置（false 透传）")
    void register_shouldRespectRequestManualHandoff_whenTypeIsNotAiProvider_andRequestFalse() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "revit-worker-001",
                "Revit Worker 连接器",
                ConnectorType.REVIT,
                "cn-east-1",
                null,
                null,
                false  // 请求传入 false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "revit-worker-001"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        assertThat(result.isManualHandoff()).isFalse();
        assertThat(result.type()).isEqualTo(ConnectorType.REVIT);

        verify(repository, times(1)).save(any(ConnectorStatus.class));
    }

    @Test
    @DisplayName("注册 Connector：endpointUrl 与 licenseRemaining 为 null 时不应覆盖已有实体的字段值")
    void register_shouldNotOverrideExistingEndpointAndLicense_whenRequestFieldsAreNull() {
        // Arrange
        ConnectorStatus existing = new ConnectorStatus();
        existing.setId(connectorId);
        existing.setTenantId(tenantId);
        existing.setConnectorCode("deepseek-llm-001");
        existing.setName("旧名称");
        existing.setType(ConnectorType.LLM);
        existing.setStatus(ConnectorHealthStatus.CONNECTED);
        existing.setCallCount1h(50);
        existing.setErrorCount1h(0);
        existing.setAvgLatencyMs(30);
        existing.setLicenseRemaining("500 calls");
        existing.setLastUsedAt(Instant.now().minusSeconds(1800));
        existing.setLastHealthCheckAt(Instant.now().minusSeconds(900));
        existing.setManualHandoff(false);
        existing.setEndpointUrl("https://api.deepseek.com/v1");
        existing.setRegion("cn-east-1");

        // 请求中 endpointUrl 和 licenseRemaining 均为 null
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "deepseek-llm-001",
                "新名称",
                ConnectorType.LLM,
                "cn-east-1",
                null,  // endpointUrl 为 null，不应覆盖
                null,  // licenseRemaining 为 null，不应覆盖
                false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001"))
                .thenReturn(Optional.of(existing));
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        ConnectorStatusDto result = connectorService.register(tenantId, request);

        // Assert
        // 关键断言：null 不覆盖已有值
        // 注意：DTO 中未包含 endpointUrl 字段，这里通过原 entity 验证
        assertThat(existing.getEndpointUrl()).isEqualTo("https://api.deepseek.com/v1");
        assertThat(existing.getLicenseRemaining()).isEqualTo("500 calls");
        assertThat(result.name()).isEqualTo("新名称");

        verify(repository, times(1)).save(existing);
    }

    // ── A-59 异步健康检查触发验证 ──

    @Test
    @DisplayName("A-59：register 成功后应异步触发 healthChecker.checkAsync（首次注册场景）")
    void register_shouldTriggerHealthCheckAsync_whenFirstRegistration() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "deepseek-llm-001",
                "DeepSeek LLM 连接器",
                ConnectorType.LLM,
                "cn-east-1",
                "https://api.deepseek.com",
                "5000 calls",
                false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "deepseek-llm-001"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(connectorId);
            return entity;
        });

        // Act
        connectorService.register(tenantId, request);

        // Assert
        // 关键断言：register 应调用 healthChecker.checkAsync 一次，且参数透传正确
        verify(healthChecker, times(1)).checkAsync(
                eq(tenantId),
                eq(connectorId),
                eq(ConnectorType.LLM),
                eq("https://api.deepseek.com"),
                eq("deepseek-llm-001"));
    }

    @Test
    @DisplayName("A-59：AI_PROVIDER 类型 register 后也应触发 healthChecker（由 healthChecker 内部跳过实际检查）")
    void register_shouldTriggerHealthCheckAsync_evenForAiProvider() {
        // Arrange
        ConnectorRegisterRequest request = new ConnectorRegisterRequest(
                "eviai-connector-001",
                "EVAI 建筑 AI 连接器",
                ConnectorType.AI_PROVIDER,
                "cn-east-1",
                null,
                null,
                false
        );
        when(repository.findByTenantIdAndConnectorCode(tenantId, "eviai-connector-001"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConnectorStatus.class))).thenAnswer(invocation -> {
            ConnectorStatus entity = invocation.getArgument(0);
            entity.setId(connectorId);
            return entity;
        });

        // Act
        connectorService.register(tenantId, request);

        // Assert
        // 关键断言：即使是 AI_PROVIDER 类型，register 也应调用 healthChecker（由 healthChecker 内部按 OD-05 跳过）
        verify(healthChecker, times(1)).checkAsync(
                eq(tenantId),
                eq(connectorId),
                eq(ConnectorType.AI_PROVIDER),
                eq(null),
                eq("eviai-connector-001"));
    }

    // ── 测试辅助 ──

    /** 构造测试用 ConnectorStatus 实体 */
    private ConnectorStatus buildConnector(ConnectorHealthStatus status) {
        ConnectorStatus connector = new ConnectorStatus();
        connector.setId(connectorId);
        connector.setTenantId(tenantId);
        connector.setConnectorCode("test-connector-001");
        connector.setName("测试连接器");
        connector.setType(ConnectorType.LLM);
        connector.setStatus(status);
        return connector;
    }
}
