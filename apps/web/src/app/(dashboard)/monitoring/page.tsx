"use client";

import { useMemo } from "react";
import { App, Spin, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { OperationsActionResponseDto } from "@design-platform/shared";
import {
  useOperationsAction,
  useRegisterConnector,
} from "@/hooks/use-monitoring-operations";
import { useStepUpToken } from "@/hooks/use-step-up";
import {
  DualApprovalModal,
  type DualApprovalAction,
} from "@/components/operations/dual-approval-modal";
import { DualApprovalProgressPanel } from "@/components/operations/dual-approval-progress-panel";
import { MonitoringHeader } from "./components/monitoring-header";
import { MonitoringAlerts } from "./components/monitoring-alerts";
import { MonitoringTabs } from "./components/monitoring-tabs";
import {
  queueColumns,
  buildPendingActionsColumns,
} from "./components/operations-columns";
import { ConnectorRegisterModal } from "./components/connector-register-modal";
import { useMonitoringHandlers } from "./hooks/use-monitoring-handlers";
import { useMonitoringState } from "./hooks/use-monitoring-state";

/**
 * 运营中心 / Monitoring 页面（D37.17）
 *
 * 主动作约束（D37.17 §Operations 危险动作）：
 *  - isolate/retry/reconcile/failover 为危险动作，必须打开影响预览
 *  - 显示租户/项目/资源数量、不可逆性、替代方案、审批/Step-up 和审计引用
 *
 * 双人审批（D37.23 §不可逆/合规：二人审批）：
 *  - IRREVERSIBLE 动作需双人审批 + stepUpToken + 审批意见 + 审批间隔≥5秒
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 Operations API（/api/v1/operations/**）尚未实现时显示空状态
 *  - 不伪造数据（对齐 D37 §空状态红线）
 */
export default function MonitoringPage() {
  const { message, modal } = App.useApp();
  const state = useMonitoringState();
  const {
    health,
    healthLoading,
    healthError,
    refetchHealth,
    healthFetching,
    overallUp,
    activeTab,
    setActiveTab,
    setActiveActionId,
    approvalModalOpen,
    approvalModalAction,
    openApprovalModal,
    closeApprovalModal,
    actionDetailQuery,
    registerModalOpen,
    setRegisterModalOpen,
    registerForm,
    openRegisterModal,
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
    summary,
  } = state;

  // 主动作 mutation hooks（接入真实 API）
  const operationsActionMutation = useOperationsAction();
  const stepUpMutation = useStepUpToken();
  const registerConnectorMutation = useRegisterConnector();

  // 待审批操作列表列定义（通过工厂函数注入回调，避免列定义耦合页面状态）
  const pendingActionsColumns = useMemo<
    ColumnsType<OperationsActionResponseDto>
  >(
    () =>
      buildPendingActionsColumns({
        onSelectAction: (operationId, kind: DualApprovalAction) => {
          setActiveActionId(operationId);
          openApprovalModal(kind);
        },
        onViewDetail: (operationId) => setActiveActionId(operationId),
      }),
    // 列定义稳定，不依赖响应式状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 业务处理器（D37.17 §Operations 危险动作 + D37.23 §二人审批）
  const {
    handleRetryStormRecovery,
    handlePauseResource,
    handleResumeResource,
    handleDeleteResource,
    handleRegisterConnector,
  } = useMonitoringHandlers({
    message,
    modal,
    queueTasks,
    operationsActionMutation,
    stepUpMutation,
    registerConnectorMutation,
    setActiveActionId,
    openApprovalModal,
    registerForm,
    setRegisterModalOpen,
  });

  const handleRefreshAll = () => {
    void refetchHealth();
    void overviewQuery.refetch();
    void slosQuery.refetch();
    void queueQuery.refetch();
    void workersQuery.refetch();
    void connectorsQuery.refetch();
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <MonitoringHeader />

      <MonitoringAlerts
        healthFetching={healthFetching}
        overviewFetching={overviewQuery.isFetching}
        slosFetching={slosQuery.isFetching}
        queueFetching={queueQuery.isFetching}
        workersFetching={workersQuery.isFetching}
        connectorsFetching={connectorsQuery.isFetching}
        onRefresh={handleRefreshAll}
        hasRetryStorm={summary.hasRetryStorm}
        hasUnknownJobs={summary.hasUnknownJobs}
        retryStormLoading={operationsActionMutation.isPending}
        onRetryStormRecovery={handleRetryStormRecovery}
        healthError={healthError}
        onRetryHealth={() => void refetchHealth()}
      />

      {/* 双人审批进度面板（D37.23 §不可逆/合规：二人审批） */}
      {actionDetailQuery.data && (
        <DualApprovalProgressPanel
          action={actionDetailQuery.data as OperationsActionResponseDto}
          onApproveReview1={() => openApprovalModal("approve_review1")}
          onRejectReview1={() => openApprovalModal("reject_review1")}
          onApproveReview2={() => openApprovalModal("approve_review2")}
          onRejectReview2={() => openApprovalModal("reject_review2")}
        />
      )}

      <Spin spinning={healthLoading}>
        <MonitoringTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          health={health}
          healthLoading={healthLoading}
          overview={overview}
          summary={summary}
          overallUp={overallUp}
          slos={slos}
          slosQuery={slosQuery}
          queueData={queueData}
          queueTasks={queueTasks}
          queueQuery={queueQuery}
          queueColumns={queueColumns}
          workers={workers}
          workersQuery={workersQuery}
          handlePauseResource={handlePauseResource}
          handleResumeResource={handleResumeResource}
          handleDeleteResource={handleDeleteResource}
          connectors={connectors}
          connectorsQuery={connectorsQuery}
          registerConnectorPending={registerConnectorMutation.isPending}
          openRegisterModal={openRegisterModal}
          pendingActions={pendingActions}
          pendingActionsQuery={pendingActionsQuery}
          pendingActionsData={pendingActionsData}
          pendingActionsColumns={pendingActionsColumns}
        />
      </Spin>

      {/* 双人审批操作模态框（D37.23 §不可逆/合规：二人审批） */}
      <DualApprovalModal
        open={approvalModalOpen}
        action={(actionDetailQuery.data as OperationsActionResponseDto) ?? null}
        actionKind={approvalModalAction}
        onClose={closeApprovalModal}
        onSuccess={() => void actionDetailQuery.refetch()}
      />

      {/* V1.10.3 Connector 注册模态框 */}
      <ConnectorRegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        form={registerForm}
        onSubmit={handleRegisterConnector}
        registerMutation={registerConnectorMutation}
      />
    </Space>
  );
}
