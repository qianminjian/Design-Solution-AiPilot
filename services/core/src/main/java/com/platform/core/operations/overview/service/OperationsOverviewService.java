package com.platform.core.operations.overview.service;

import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.overview.dto.OperationsOverviewDto;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
import com.platform.core.operations.queue.service.QueueTaskService;
import com.platform.core.operations.slo.repository.SloTargetRepository;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Operations 概览聚合服务（D37.17 运营中心）
 *
 * <p>聚合 4 个子域统计返回 OperationsOverviewDto。
 *
 * <p>V0 简化：
 * <ul>
 *   <li>completedTasks24h：V0 不分时间窗口，返回 COMPLETED 总数</li>
 *   <li>hasRetryStorm/hasUnknownJobs：V0 占位 false，V1 接入指标计算</li>
 *   <li>dataResidencyRegions：V0 返回空列表，V1 从 worker_status.region 聚合</li>
 *   <li>overallStatus：DEGRADED 当 errorWorkers>0 或 failedTasks>0 或 criticalSlos>0 或 disconnectedConnectors>0</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Service
public class OperationsOverviewService {

    private final QueueTaskRepository queueTaskRepository;
    private final WorkerStatusRepository workerStatusRepository;
    private final ConnectorStatusRepository connectorStatusRepository;
    private final SloTargetRepository sloTargetRepository;
    private final QueueTaskService queueTaskService;

    public OperationsOverviewService(
            QueueTaskRepository queueTaskRepository,
            WorkerStatusRepository workerStatusRepository,
            ConnectorStatusRepository connectorStatusRepository,
            SloTargetRepository sloTargetRepository,
            QueueTaskService queueTaskService
    ) {
        this.queueTaskRepository = queueTaskRepository;
        this.workerStatusRepository = workerStatusRepository;
        this.connectorStatusRepository = connectorStatusRepository;
        this.sloTargetRepository = sloTargetRepository;
        this.queueTaskService = queueTaskService;
    }

    @Transactional(readOnly = true)
    public OperationsOverviewDto getOverview(UUID tenantId) {
        // Queue 统计
        long runningTasks = queueTaskRepository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.RUNNING);
        long queuedTasks = queueTaskRepository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.QUEUED);
        long failedTasks = queueTaskRepository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.FAILED);
        long pausedTasks = queueTaskRepository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.PAUSED);
        // V0 简化：completedTasks24h 返回 COMPLETED 总数，V1 接入时间窗口过滤
        long completedTasks24h = queueTaskRepository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.COMPLETED);

        // Worker 统计
        long runningWorkers = workerStatusRepository.countByTenantIdAndStatus(tenantId, WorkerRuntimeStatus.RUNNING);
        long errorWorkers = workerStatusRepository.countByTenantIdAndStatus(tenantId, WorkerRuntimeStatus.ERROR);
        long stoppedWorkers = workerStatusRepository.countByTenantIdAndStatus(tenantId, WorkerRuntimeStatus.STOPPED);

        // Connector 统计
        long connectedConnectors = connectorStatusRepository.countByTenantIdAndStatus(tenantId, ConnectorHealthStatus.CONNECTED);
        long degradedConnectors = connectorStatusRepository.countByTenantIdAndStatus(tenantId, ConnectorHealthStatus.DEGRADED);
        long disconnectedConnectors = connectorStatusRepository.countByTenantIdAndStatus(tenantId, ConnectorHealthStatus.DISCONNECTED);

        // SLO 统计
        long criticalSlos = sloTargetRepository.countByTenantIdAndStatus(tenantId, SloStatus.CRITICAL);
        long warningSlos = sloTargetRepository.countByTenantIdAndStatus(tenantId, SloStatus.WARNING);

        // 特殊状态（V0 占位）
        boolean hasRetryStorm = queueTaskService.hasRetryStorm(tenantId);
        boolean hasUnknownJobs = queueTaskService.hasUnknownJobs(tenantId);
        List<String> dataResidencyRegions = List.of(); // V1 从 worker_status.region 聚合

        // 整体状态判定
        String overallStatus = (errorWorkers > 0 || failedTasks > 0
                || criticalSlos > 0 || disconnectedConnectors > 0)
                ? "degraded" : "up";

        return new OperationsOverviewDto(
                Instant.now(),
                overallStatus,
                runningTasks,
                queuedTasks,
                failedTasks,
                pausedTasks,
                completedTasks24h,
                runningWorkers,
                errorWorkers,
                stoppedWorkers,
                connectedConnectors,
                degradedConnectors,
                disconnectedConnectors,
                criticalSlos,
                warningSlos,
                hasRetryStorm,
                hasUnknownJobs,
                dataResidencyRegions
        );
    }
}
