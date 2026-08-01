package com.platform.core.operations.action.service;

import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.connector.service.ConnectorService;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.queue.service.QueueTaskService;
import com.platform.core.operations.worker.service.WorkerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * OperationsActionService 单元测试（V1.10 新增）
 *
 * <p>聚焦 V1.10 新增的 DELETE 动作分发逻辑分支覆盖：
 * <ul>
 *   <li>{@code dispatchToWorker} DELETE 分支 → 调用 {@code workerService.deleteWorker}</li>
 *   <li>{@code dispatchToConnector} DELETE 分支 → 调用 {@code connectorService.deleteConnector}</li>
 * </ul>
 *
 * <p>测试方式：通过反射调用 private 方法，避免触发完整的 executeAction/approveReview2 复杂流程，
 * 聚焦验证 V1.10 新增的 switch case 分支路由正确性。
 *
 * <p>对齐 testing.md §4 Mock 规范：所有外部 Service 依赖使用 Mockito mock，避免真实数据库依赖。
 *
 * @design D37-关键界面-交互状态.md §D37.17 Operations 危险动作
 * @design D37-关键界面-交互状态.md §D37.23 不可逆/合规：二人审批
 */
@ExtendWith(MockitoExtension.class)
class OperationsActionServiceTest {

    @Mock
    private OperationsActionRepository repository;

    @Mock
    private WorkerService workerService;

    @Mock
    private ConnectorService connectorService;

    @Mock
    private QueueTaskService queueTaskService;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    private OperationsActionService operationsActionService;

    private UUID tenantId;
    private UUID targetId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        targetId = UUID.randomUUID();
        // A-61 P0-2 修复：构造器新增 stepUpTokenSalt 参数，使用测试专用盐值
        operationsActionService = new OperationsActionService(
                repository,
                workerService,
                connectorService,
                queueTaskService,
                jwtTokenProvider,
                "test-salt-for-unit-tests-only"
        );
    }

    // ── dispatchToWorker（private 方法，通过反射调用）──

    @Test
    @DisplayName("dispatchToWorker：DELETE 动作应正确路由到 workerService.deleteWorker")
    void dispatchToWorker_shouldRouteDelete_toDeleteWorker() throws Exception {
        // Arrange
        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.DELETE,
                OperationsActionTargetType.WORKER,
                targetId.toString(),
                "废弃 Worker 清理",
                null,
                true
        );

        // Act：通过反射调用 private dispatchToWorker 方法
        invokePrivateDispatch("dispatchToWorker", tenantId, request, targetId);

        // Assert：验证 workerService.deleteWorker 被调用 1 次，参数正确
        verify(workerService, times(1)).deleteWorker(tenantId, targetId, "废弃 Worker 清理");
    }

    @Test
    @DisplayName("dispatchToWorker：ISOLATE 动作应正确路由到 workerService.isolateWorker（回归测试）")
    void dispatchToWorker_shouldRouteIsolate_toIsolateWorker() throws Exception {
        // Arrange
        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                targetId.toString(),
                "隔离异常 Worker",
                "step-up-token",
                true
        );

        // Act
        invokePrivateDispatch("dispatchToWorker", tenantId, request, targetId);

        // Assert
        verify(workerService, times(1)).isolateWorker(tenantId, targetId, "隔离异常 Worker");
    }

    // ── dispatchToConnector（private 方法，通过反射调用）──

    @Test
    @DisplayName("dispatchToConnector：DELETE 动作应正确路由到 connectorService.deleteConnector")
    void dispatchToConnector_shouldRouteDelete_toDeleteConnector() throws Exception {
        // Arrange
        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.DELETE,
                OperationsActionTargetType.CONNECTOR,
                targetId.toString(),
                "废弃连接器清理",
                null,
                true
        );

        // Act：通过反射调用 private dispatchToConnector 方法
        invokePrivateDispatch("dispatchToConnector", tenantId, request, targetId);

        // Assert：验证 connectorService.deleteConnector 被调用 1 次
        verify(connectorService, times(1)).deleteConnector(tenantId, targetId, "废弃连接器清理");
    }

    @Test
    @DisplayName("dispatchToConnector：RECONCILE 动作应正确路由到 connectorService.reconcileConnector（回归测试）")
    void dispatchToConnector_shouldRouteReconcile_toReconcileConnector() throws Exception {
        // Arrange
        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RECONCILE,
                OperationsActionTargetType.CONNECTOR,
                targetId.toString(),
                "对账连接器状态",
                "step-up-token",
                true
        );

        // Act
        invokePrivateDispatch("dispatchToConnector", tenantId, request, targetId);

        // Assert
        verify(connectorService, times(1)).reconcileConnector(tenantId, targetId, "对账连接器状态");
    }

    // ── 测试辅助：反射调用 private dispatch 方法 ──

    /**
     * 通过反射调用 OperationsActionService 的 private dispatch 方法
     *
     * @param methodName 方法名："dispatchToWorker" 或 "dispatchToConnector"
     * @param tenantId   租户 ID
     * @param request     动作请求
     * @param targetId    目标对象 UUID
     */
    private void invokePrivateDispatch(
            String methodName, UUID tenantId, OperationsActionRequest request, UUID targetId
    ) throws Exception {
        Method method = OperationsActionService.class.getDeclaredMethod(
                methodName, UUID.class, OperationsActionRequest.class, UUID.class);
        method.setAccessible(true);
        method.invoke(operationsActionService, tenantId, request, targetId);
    }

    // ── hashToken（A-61 P0-2 修复：SHA-256 + 盐）──

    @Test
    @DisplayName("hashToken：应返回 64 字符 SHA-256 十六进制字符串（非可逆 hashCode）")
    void hashToken_shouldReturnSha256HexHash_notReversibleHashCode() throws Exception {
        // Arrange
        String token = "step-up-token-abc123";

        // Act：通过反射调用 private hashToken 方法
        Method method = OperationsActionService.class.getDeclaredMethod("hashToken", String.class);
        method.setAccessible(true);
        String hash = (String) method.invoke(operationsActionService, token);

        // Assert
        // 关键断言：SHA-256 输出为 64 字符十六进制字符串（256 bit / 4 bit per hex char）
        assertThat(hash).hasSize(64);
        // 关键断言：仅包含十六进制字符（非 "v0hash:" 前缀 + 数字 hashCode）
        assertThat(hash).matches("[0-9a-f]{64}");
        // 关键断言：不包含 "v0hash:" 前缀（A-61 修复前的占位实现特征）
        assertThat(hash).doesNotStartWith("v0hash:");
    }

    @Test
    @DisplayName("hashToken：相同 token + 相同盐应产生相同哈希（确定性）")
    void hashToken_shouldBeDeterministic_forSameTokenAndSalt() throws Exception {
        // Arrange
        String token = "deterministic-token-test";

        // Act
        Method method = OperationsActionService.class.getDeclaredMethod("hashToken", String.class);
        method.setAccessible(true);
        String hash1 = (String) method.invoke(operationsActionService, token);
        String hash2 = (String) method.invoke(operationsActionService, token);

        // Assert：相同 token + 相同盐应产生相同哈希
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("hashToken：不同 token 应产生不同哈希（抗碰撞）")
    void hashToken_shouldProduceDifferentHash_forDifferentTokens() throws Exception {
        // Arrange
        String token1 = "token-001";
        String token2 = "token-002";

        // Act
        Method method = OperationsActionService.class.getDeclaredMethod("hashToken", String.class);
        method.setAccessible(true);
        String hash1 = (String) method.invoke(operationsActionService, token1);
        String hash2 = (String) method.invoke(operationsActionService, token2);

        // Assert：不同 token 应产生不同哈希
        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("hashToken：相同 token + 不同盐应产生不同哈希（盐隔离）")
    void hashToken_shouldProduceDifferentHash_forDifferentSalts() throws Exception {
        // Arrange：构造两个使用不同盐的 service 实例
        OperationsActionService serviceWithSalt1 = new OperationsActionService(
                repository, workerService, connectorService, queueTaskService, jwtTokenProvider, "salt-A");
        OperationsActionService serviceWithSalt2 = new OperationsActionService(
                repository, workerService, connectorService, queueTaskService, jwtTokenProvider, "salt-B");
        String token = "same-token-different-salt-test";

        // Act
        Method method = OperationsActionService.class.getDeclaredMethod("hashToken", String.class);
        method.setAccessible(true);
        String hash1 = (String) method.invoke(serviceWithSalt1, token);
        String hash2 = (String) method.invoke(serviceWithSalt2, token);

        // Assert：相同 token + 不同盐应产生不同哈希（防止彩虹表攻击）
        assertThat(hash1).isNotEqualTo(hash2);
    }
}
