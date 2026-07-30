package com.platform.core.operations.overview.dto;

import java.time.Instant;
import java.util.List;

/**
 * Operations 概览 DTO（对齐前端 OperationsOverviewDto 契约）
 *
 * <p>聚合 4 个子域统计：
 * <ul>
 *   <li>Queue：runningTasks/queuedTasks/failedTasks/pausedTasks/completedTasks24h</li>
 *   <li>Worker：runningWorkers/errorWorkers/stoppedWorkers</li>
 *   <li>Connector：connectedConnectors/degradedConnectors/disconnectedConnectors</li>
 *   <li>SLO：criticalSlos/warningSlos</li>
 *   <li>特殊状态：hasRetryStorm/hasUnknownJobs/dataResidencyRegions</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record OperationsOverviewDto(
        Instant timestamp,
        String overallStatus,
        long runningTasks,
        long queuedTasks,
        long failedTasks,
        long pausedTasks,
        long completedTasks24h,
        long runningWorkers,
        long errorWorkers,
        long stoppedWorkers,
        long connectedConnectors,
        long degradedConnectors,
        long disconnectedConnectors,
        long criticalSlos,
        long warningSlos,
        boolean hasRetryStorm,
        boolean hasUnknownJobs,
        List<String> dataResidencyRegions
) {
}
