"use client";

import { useMemo, useState } from "react";
import { Form } from "antd";
import type {
  ConnectorType,
  OperationsActionResponseDto,
  QueueTaskDto,
  SloTargetDto,
  WorkerStatusDto,
  ConnectorStatusDto,
} from "@design-platform/shared";
import type { DualApprovalAction } from "@/components/operations/dual-approval-modal";
import { useHealth } from "@/hooks/use-monitoring";
import {
  useConnectors,
  useOperationsActionDetail,
  useOperationsOverview,
  usePendingOperationsActions,
  useQueueTasks,
  useSlos,
  useWorkers,
} from "@/hooks/use-monitoring-operations";

/**
 * Monitoring 页面状态聚合 hook
 *
 * 聚合以下状态：
 *  - 健康检查 + 5 个 TanStack Query 数据源
 *  - 双人审批 Modal 状态
 *  - Connector 注册 Modal 状态
 *  - 派生的 summary 统计（V1 优先用 overview，V0 fallback 从查询结果派生）
 */
export function useMonitoringState() {
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useHealth();
  const [activeTab, setActiveTab] = useState("overview");

  // 双人审批状态（D37.23 §不可逆/合规：二人审批）
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalModalAction, setApprovalModalAction] =
    useState<DualApprovalAction | null>(null);
  const actionDetailQuery = useOperationsActionDetail(activeActionId);

  // V1.10.3 Connector 注册 Modal 状态
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerForm] = Form.useForm<{
    connectorCode: string;
    name: string;
    type: ConnectorType;
    region?: string;
    endpointUrl?: string;
    licenseRemaining?: string;
    isManualHandoff: boolean;
  }>();

  // Operations 真实数据 hooks
  const overviewQuery = useOperationsOverview();
  const slosQuery = useSlos();
  const queueQuery = useQueueTasks({ page: 1, pageSize: 100 });
  const workersQuery = useWorkers({});
  const connectorsQuery = useConnectors({});
  // V1.9.1 待审批操作列表（D37.23 §不可逆/合规：二人审批）
  const pendingActionsQuery = usePendingOperationsActions({ pageSize: 50 });

  const overview = overviewQuery.data;
  const slos = useMemo<SloTargetDto[]>(
    () => slosQuery.data ?? [],
    [slosQuery.data],
  );
  const queueData = queueQuery.data;
  const queueTasks = useMemo<QueueTaskDto[]>(
    () => queueData?.items ?? [],
    [queueData?.items],
  );
  const workers = useMemo<WorkerStatusDto[]>(
    () => workersQuery.data ?? [],
    [workersQuery.data],
  );
  const connectors = useMemo<ConnectorStatusDto[]>(
    () => connectorsQuery.data ?? [],
    [connectorsQuery.data],
  );
  const pendingActionsData = pendingActionsQuery.data;
  const pendingActions = useMemo<OperationsActionResponseDto[]>(
    () => pendingActionsData?.items ?? [],
    [pendingActionsData?.items],
  );

  const overallUp = health?.status === "UP";

  // 计算统计汇总（V1 接入后用 overview 数据；V0 显示查询结果派生统计）
  const summary = useMemo(() => {
    if (overview) {
      return {
        runningTasks: overview.runningTasks,
        queuedTasks: overview.queuedTasks,
        failedTasks: overview.failedTasks,
        runningWorkers: overview.runningWorkers,
        errorWorkers: overview.errorWorkers,
        connectedConnectors: overview.connectedConnectors,
        degradedConnectors:
          overview.degradedConnectors + overview.disconnectedConnectors,
        criticalSlos: overview.criticalSlos,
        hasRetryStorm: overview.hasRetryStorm,
        hasUnknownJobs: overview.hasUnknownJobs,
      };
    }
    // V0 fallback：从查询结果派生
    return {
      runningTasks: queueTasks.filter((t) => t.status === "running").length,
      queuedTasks: queueTasks.filter((t) => t.status === "queued").length,
      failedTasks: queueTasks.filter((t) => t.status === "failed").length,
      runningWorkers: workers.filter((w) => w.status === "running").length,
      errorWorkers: workers.filter((w) => w.status === "error").length,
      connectedConnectors: connectors.filter((c) => c.status === "connected")
        .length,
      degradedConnectors: connectors.filter(
        (c) => c.status === "degraded" || c.status === "disconnected",
      ).length,
      criticalSlos: slos.filter((s) => s.status === "critical").length,
      hasRetryStorm: false,
      hasUnknownJobs: false,
    };
  }, [overview, queueTasks, workers, connectors, slos]);

  // Modal 控制回调
  const openApprovalModal = (kind: DualApprovalAction) => {
    setApprovalModalAction(kind);
    setApprovalModalOpen(true);
  };

  const closeApprovalModal = () => {
    setApprovalModalOpen(false);
    setApprovalModalAction(null);
  };

  const openRegisterModal = () => {
    registerForm.resetFields();
    setRegisterModalOpen(true);
  };

  return {
    // 健康状态
    health,
    healthLoading,
    healthError,
    refetchHealth,
    healthFetching,
    overallUp,
    // Tab 状态
    activeTab,
    setActiveTab,
    // 双人审批
    activeActionId,
    setActiveActionId,
    approvalModalOpen,
    approvalModalAction,
    openApprovalModal,
    closeApprovalModal,
    actionDetailQuery,
    // Connector 注册
    registerModalOpen,
    setRegisterModalOpen,
    registerForm,
    openRegisterModal,
    // 查询结果
    overviewQuery,
    slosQuery,
    queueQuery,
    workersQuery,
    connectorsQuery,
    pendingActionsQuery,
    overview,
    slos,
    queueData,
    queueTasks,
    workers,
    connectors,
    pendingActionsData,
    pendingActions,
    // 派生数据
    summary,
  };
}
