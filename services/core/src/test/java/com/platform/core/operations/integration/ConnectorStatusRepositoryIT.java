package com.platform.core.operations.integration;

import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ConnectorStatus Repository 集成测试
 *
 * <p>验证 ConnectorStatus 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 OD-05 ManualHandoff 字段、Hybrid-Site region 字段）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndType：按类型分页查询（LLM/AI_PROVIDER/MINIO/REVIT/RHINO/SKETCHUP）</li>
 *   <li>findByTenantIdAndStatus：按健康状态分页查询（CONNECTED/DEGRADED/DISCONNECTED/UNKNOWN）</li>
 *   <li>findByTenantIdAndConnectorCode：按 connectorCode 查询（唯一约束）</li>
 *   <li>countByTenantIdAndStatus：状态统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的连接器</li>
 *   <li>OD-05 ManualHandoff 持久化（建筑 AI Provider 强制 isManualHandoff=true）</li>
 *   <li>Hybrid-Site region 字段持久化（跨境数据传输约束）</li>
 *   <li>connector_code 唯一约束（uq_connector_status_code）</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D29-可观测性-合规性-指标.md（RED / USE 指标）
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@DisplayName("ConnectorStatus Repository 集成测试")
class ConnectorStatusRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private ConnectorStatusRepository connectorStatusRepository;

    /**
     * 应该成功保存 ConnectorStatus 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 ConnectorStatus 并返回生成的 ID")
    void shouldSaveConnectorStatusAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-save-" + UUID.randomUUID());
        ConnectorStatus connector = buildSampleConnector(tenantId, "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED);

        // Act（执行）
        ConnectorStatus saved = connectorStatusRepository.save(connector);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals("deepseek-llm-001", saved.getConnectorCode()),
                () -> assertEquals("DeepSeek LLM Connector", saved.getName()),
                () -> assertEquals(ConnectorType.LLM, saved.getType()),
                () -> assertEquals(ConnectorHealthStatus.CONNECTED, saved.getStatus()),
                () -> assertEquals(1000L, saved.getCallCount1h()),
                () -> assertEquals(2L, saved.getErrorCount1h()),
                () -> assertEquals(350, saved.getAvgLatencyMs()),
                () -> assertEquals("30 days", saved.getLicenseRemaining()),
                () -> assertNotNull(saved.getLastUsedAt(), "lastUsedAt 不应为 null"),
                () -> assertFalse(saved.isManualHandoff(),
                        "is_manual_handoff 默认应为 false（LLM API 非 ManualHandoff）"),
                () -> assertNull(saved.getLastHealthCheckAt(),
                        "lastHealthCheckAt 默认应为 null（尚未健康检查）"),
                () -> assertNotNull(saved.getRowVersion(), "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询连接器
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询连接器")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-find-" + UUID.randomUUID());
        ConnectorStatus saved = connectorStatusRepository.save(
                buildSampleConnector(tenantId, "minio-001",
                        ConnectorType.MINIO, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        Optional<ConnectorStatus> found = connectorStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能找到连接器"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(tenantId, found.get().getTenantId()),
                () -> assertEquals("minio-001", found.get().getConnectorCode()),
                () -> assertEquals(ConnectorType.MINIO, found.get().getType())
        );
    }

    /**
     * 应该强制租户隔离（跨租户查询返回 empty）
     */
    @Test
    @DisplayName("应该强制租户隔离（跨租户查询返回 empty）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-cs-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-cs-iso-b-" + UUID.randomUUID());
        ConnectorStatus savedInA = connectorStatusRepository.save(
                buildSampleConnector(tenantA, "deepseek-001",
                        ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        Optional<ConnectorStatus> foundInB = connectorStatusRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(foundInB.isPresent(), "租户 B 不应能查询租户 A 的连接器");
    }

    /**
     * 应该按 tenantId 分页查询连接器列表
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询连接器列表")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            connectorStatusRepository.save(buildSampleConnector(tenantId, "llm-" + i,
                    ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        }

        // Act（执行）
        Page<ConnectorStatus> page = connectorStatusRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements()),
                () -> assertEquals(1, page.getTotalPages()),
                () -> assertEquals(5, page.getContent().size())
        );
    }

    /**
     * 应该按 tenantId + type 分页查询（区分 LLM/AI_PROVIDER/MINIO/REVIT/RHINO/SKETCHUP）
     */
    @Test
    @DisplayName("应该按 tenantId + type 分页查询")
    void shouldFindByTenantIdAndTypeWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-type-" + UUID.randomUUID());
        connectorStatusRepository.save(buildSampleConnector(tenantId, "llm-1",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "llm-2",
                ConnectorType.LLM, ConnectorHealthStatus.DEGRADED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "ai-prov-1",
                ConnectorType.AI_PROVIDER, ConnectorHealthStatus.UNKNOWN));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "minio-1",
                ConnectorType.MINIO, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "revit-1",
                ConnectorType.REVIT, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        Page<ConnectorStatus> llm = connectorStatusRepository.findByTenantIdAndType(
                tenantId, ConnectorType.LLM, PageRequest.of(0, 10));
        Page<ConnectorStatus> aiProvider = connectorStatusRepository.findByTenantIdAndType(
                tenantId, ConnectorType.AI_PROVIDER, PageRequest.of(0, 10));
        Page<ConnectorStatus> minio = connectorStatusRepository.findByTenantIdAndType(
                tenantId, ConnectorType.MINIO, PageRequest.of(0, 10));
        Page<ConnectorStatus> revit = connectorStatusRepository.findByTenantIdAndType(
                tenantId, ConnectorType.REVIT, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, llm.getTotalElements(), "LLM 应有 2 个"),
                () -> assertEquals(1, aiProvider.getTotalElements(), "AI_PROVIDER 应有 1 个"),
                () -> assertEquals(1, minio.getTotalElements(), "MINIO 应有 1 个"),
                () -> assertEquals(1, revit.getTotalElements(), "REVIT 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + status 分页查询（区分 CONNECTED/DEGRADED/DISCONNECTED/UNKNOWN）
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-status-" + UUID.randomUUID());
        // 3 个 CONNECTED + 2 个 DEGRADED + 1 个 DISCONNECTED + 1 个 UNKNOWN
        for (int i = 0; i < 3; i++) {
            connectorStatusRepository.save(buildSampleConnector(tenantId, "conn-" + i,
                    ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        }
        for (int i = 0; i < 2; i++) {
            connectorStatusRepository.save(buildSampleConnector(tenantId, "deg-" + i,
                    ConnectorType.LLM, ConnectorHealthStatus.DEGRADED));
        }
        connectorStatusRepository.save(buildSampleConnector(tenantId, "disc-1",
                ConnectorType.LLM, ConnectorHealthStatus.DISCONNECTED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "unk-1",
                ConnectorType.LLM, ConnectorHealthStatus.UNKNOWN));

        // Act（执行）
        Page<ConnectorStatus> connected = connectorStatusRepository.findByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.CONNECTED, PageRequest.of(0, 10));
        Page<ConnectorStatus> degraded = connectorStatusRepository.findByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.DEGRADED, PageRequest.of(0, 10));
        Page<ConnectorStatus> disconnected = connectorStatusRepository.findByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.DISCONNECTED, PageRequest.of(0, 10));
        Page<ConnectorStatus> unknown = connectorStatusRepository.findByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.UNKNOWN, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, connected.getTotalElements(), "CONNECTED 应有 3 个"),
                () -> assertEquals(2, degraded.getTotalElements(), "DEGRADED 应有 2 个"),
                () -> assertEquals(1, disconnected.getTotalElements(), "DISCONNECTED 应有 1 个"),
                () -> assertEquals(1, unknown.getTotalElements(), "UNKNOWN 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + connectorCode 查询（唯一约束）
     */
    @Test
    @DisplayName("应该按 tenantId + connectorCode 查询")
    void shouldFindByTenantIdAndConnectorCode() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-code-" + UUID.randomUUID());
        connectorStatusRepository.save(buildSampleConnector(tenantId, "eviai-special-001",
                ConnectorType.AI_PROVIDER, ConnectorHealthStatus.UNKNOWN));

        // Act（执行）
        Optional<ConnectorStatus> found = connectorStatusRepository.findByTenantIdAndConnectorCode(
                tenantId, "eviai-special-001");

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应按 connectorCode 查询到连接器"),
                () -> assertEquals("eviai-special-001", found.get().getConnectorCode())
        );
    }

    /**
     * 应该按 tenantId + status 统计
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-count-" + UUID.randomUUID());
        connectorStatusRepository.save(buildSampleConnector(tenantId, "c-1",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "c-2",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "d-1",
                ConnectorType.LLM, ConnectorHealthStatus.DEGRADED));
        connectorStatusRepository.save(buildSampleConnector(tenantId, "u-1",
                ConnectorType.LLM, ConnectorHealthStatus.UNKNOWN));

        // Act（执行）
        long connectedCount = connectorStatusRepository.countByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.CONNECTED);
        long degradedCount = connectorStatusRepository.countByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.DEGRADED);
        long disconnectedCount = connectorStatusRepository.countByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.DISCONNECTED);
        long unknownCount = connectorStatusRepository.countByTenantIdAndStatus(
                tenantId, ConnectorHealthStatus.UNKNOWN);

        // Assert（断言）
        assertAll(
                () -> assertEquals(2L, connectedCount, "CONNECTED 应有 2 个"),
                () -> assertEquals(1L, degradedCount, "DEGRADED 应有 1 个"),
                () -> assertEquals(0L, disconnectedCount, "DISCONNECTED 应有 0 个"),
                () -> assertEquals(1L, unknownCount, "UNKNOWN 应有 1 个")
        );
    }

    /**
     * 应该持久化 OD-05 ManualHandoff 字段（建筑 AI Provider 强制 isManualHandoff=true）
     */
    @Test
    @DisplayName("应该持久化 OD-05 ManualHandoff（建筑 AI Provider isManualHandoff=true）")
    void shouldPersistManualHandoffForAiProvider() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-mh-" + UUID.randomUUID());
        ConnectorStatus aiProviderConnector = buildSampleConnector(tenantId, "eviai-001",
                ConnectorType.AI_PROVIDER, ConnectorHealthStatus.UNKNOWN);
        // OD-05 外部 AI V1 约束：建筑 AI Provider（EVAI/小库 AI/建筑学长）强制 ManualHandoff
        aiProviderConnector.setManualHandoff(true);
        aiProviderConnector.setLicenseRemaining("ManualHandoff: 未获正式 API/许可");
        aiProviderConnector.setEndpointUrl(null);  // 无 API 端点（ManualHandoff 模式）

        // Act（执行）
        ConnectorStatus saved = connectorStatusRepository.save(aiProviderConnector);
        Optional<ConnectorStatus> found = connectorStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— OD-05 ManualHandoff 红线验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertTrue(found.get().isManualHandoff(),
                        "建筑 AI Provider 应强制 isManualHandoff=true（OD-05 约束）"),
                () -> assertEquals("ManualHandoff: 未获正式 API/许可",
                        found.get().getLicenseRemaining(),
                        "licenseRemaining 应描述 ManualHandoff 状态"),
                () -> assertNull(found.get().getEndpointUrl(),
                        "ManualHandoff 模式下 endpointUrl 应为 null（无 API 端点）"),
                () -> assertEquals(ConnectorHealthStatus.UNKNOWN, found.get().getStatus(),
                        "建筑 AI Provider 状态应为 UNKNOWN（未接入）")
        );
    }

    /**
     * 应该持久化 Hybrid-Site region 字段（跨境数据传输约束）
     */
    @Test
    @DisplayName("应该持久化 Hybrid-Site region 字段（cn-beijing-1）")
    void shouldPersistHybridSiteRegionField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-region-" + UUID.randomUUID());
        ConnectorStatus crossRegionConnector = buildSampleConnector(tenantId, "minio-bj-001",
                ConnectorType.MINIO, ConnectorHealthStatus.CONNECTED);
        crossRegionConnector.setRegion("cn-beijing-1");
        crossRegionConnector.setEndpointUrl("https://minio.cn-beijing-1.example.com");

        // Act（执行）
        ConnectorStatus saved = connectorStatusRepository.save(crossRegionConnector);
        Optional<ConnectorStatus> found = connectorStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— Hybrid-Site 数据驻留约束验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals("cn-beijing-1", found.get().getRegion(),
                        "region 应持久化为 cn-beijing-1（Hybrid-Site 跨境数据传输约束）"),
                () -> assertEquals("https://minio.cn-beijing-1.example.com",
                        found.get().getEndpointUrl(),
                        "endpointUrl 应记录跨境 Region 端点（PII: L3）")
        );
    }

    /**
     * 应该持久化 DISCONNECTED 状态场景（错误率高/超时/鉴权失败）
     */
    @Test
    @DisplayName("应该持久化 DISCONNECTED 状态场景（错误率高/超时）")
    void shouldPersistDisconnectedScenario() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-disc-" + UUID.randomUUID());
        ConnectorStatus disconnected = buildSampleConnector(tenantId, "rhino-disc-001",
                ConnectorType.RHINO, ConnectorHealthStatus.DISCONNECTED);
        // DISCONNECTED 场景：错误率高 + 高延迟 + 最近未使用
        disconnected.setErrorCount1h(150L);  // 1h 错误 150 次（错误率 15%）
        disconnected.setCallCount1h(1000L);
        disconnected.setAvgLatencyMs(5000);  // 平均延迟 5s（超时风险）
        disconnected.setLastHealthCheckAt(Instant.now());

        // Act（执行）
        ConnectorStatus saved = connectorStatusRepository.save(disconnected);
        Optional<ConnectorStatus> found = connectorStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— DISCONNECTED 场景验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(ConnectorHealthStatus.DISCONNECTED, found.get().getStatus(),
                        "状态应为 DISCONNECTED"),
                () -> assertEquals(150L, found.get().getErrorCount1h(),
                        "errorCount1h 应为 150（高错误率）"),
                () -> assertEquals(1000L, found.get().getCallCount1h(),
                        "callCount1h 应为 1000"),
                () -> assertEquals(5000, found.get().getAvgLatencyMs(),
                        "avgLatencyMs 应为 5000ms（超时风险）"),
                () -> assertNotNull(found.get().getLastHealthCheckAt(),
                        "lastHealthCheckAt 应记录最近健康检查时间")
        );
    }

    /**
     * 应该拒绝重复 connector_code（唯一约束 uq_connector_status_code）
     */
    @Test
    @DisplayName("应该拒绝重复 connector_code（唯一约束）")
    void shouldRejectDuplicateConnectorCode() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-dup-" + UUID.randomUUID());
        String duplicateCode = "llm-duplicate-001";
        connectorStatusRepository.save(buildSampleConnector(tenantId, duplicateCode,
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));

        // 第二次插入相同 connector_code 应抛异常
        ConnectorStatus duplicate = buildSampleConnector(tenantId, duplicateCode,
                ConnectorType.LLM, ConnectorHealthStatus.DEGRADED);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> connectorStatusRepository.save(duplicate),
                "重复 connector_code 应抛唯一约束异常");
    }

    /**
     * 应该拒绝缺少必填字段（connectorCode 为 null）
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（connectorCode 为 null）")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cs-missing-" + UUID.randomUUID());
        ConnectorStatus connector = buildSampleConnector(tenantId, "will-be-null",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED);
        connector.setConnectorCode(null);  // connectorCode 为 NOT NULL

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> connectorStatusRepository.save(connector),
                "connectorCode 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在的租户（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在的租户（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID fakeTenantId = UUID.randomUUID();  // 不存在的租户 ID
        ConnectorStatus connector = buildSampleConnector(fakeTenantId, "llm-fk-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> connectorStatusRepository.save(connector),
                "引用不存在的租户应抛外键约束异常");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 ConnectorStatus 实体（含必填字段）
     */
    private ConnectorStatus buildSampleConnector(UUID tenantId, String connectorCode,
                                                  ConnectorType type, ConnectorHealthStatus status) {
        ConnectorStatus connector = new ConnectorStatus();
        connector.setTenantId(tenantId);
        connector.setConnectorCode(connectorCode);
        connector.setName("DeepSeek LLM Connector");
        connector.setType(type);
        connector.setStatus(status);
        connector.setCallCount1h(1000L);
        connector.setErrorCount1h(2L);
        connector.setAvgLatencyMs(350);
        connector.setLicenseRemaining("30 days");
        connector.setLastUsedAt(Instant.now());
        connector.setManualHandoff(false);
        return connector;
    }
}
