"use client";

import { Alert, Button } from "antd";
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { DataErrorAlert } from "@/components/common/data-error-alert";

/**
 * Monitoring 顶部 Alerts 区域
 *
 * 包含：
 *  - V0 限制提示 + 全局刷新按钮
 *  - Retry Storm 告警
 *  - Unknown Job 告警
 *  - 健康检查错误提示
 */
export interface MonitoringAlertsProps {
  healthFetching: boolean;
  overviewFetching: boolean;
  slosFetching: boolean;
  queueFetching: boolean;
  workersFetching: boolean;
  connectorsFetching: boolean;
  onRefresh: () => void;
  hasRetryStorm: boolean;
  hasUnknownJobs: boolean;
  retryStormLoading: boolean;
  onRetryStormRecovery: () => void;
  healthError: unknown;
  onRetryHealth: () => void;
}

export function MonitoringAlerts(props: MonitoringAlertsProps) {
  const {
    healthFetching,
    overviewFetching,
    slosFetching,
    queueFetching,
    workersFetching,
    connectorsFetching,
    onRefresh,
    hasRetryStorm,
    hasUnknownJobs,
    retryStormLoading,
    onRetryStormRecovery,
    healthError,
    onRetryHealth,
  } = props;

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="Operations API 对接真实后端"
        description="服务健康状态来自 /api/v1/health；SLO / Queue / Worker / Connector 数据通过 /api/v1/operations/** 实时查询后端；返回 404/501 时显示空状态，不伪造数据。Retry Storm 恢复按钮已接入真实 OperationsAction API（cancel 动作，需 stepUpToken 二次认证）。"
        action={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={
              healthFetching ||
              overviewFetching ||
              slosFetching ||
              queueFetching ||
              workersFetching ||
              connectorsFetching
            }
            onClick={onRefresh}
          >
            刷新
          </Button>
        }
      />

      {hasRetryStorm && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message="检测到 Retry Storm"
          description="系统检测到大量任务重试，已暂停自动重试。请人工排查失败任务根因后再恢复。"
          action={
            <Button
              size="small"
              loading={retryStormLoading}
              onClick={onRetryStormRecovery}
            >
              恢复重试
            </Button>
          }
        />
      )}

      {hasUnknownJobs && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="存在 Unknown Job"
          description="系统检测到未知状态的任务，未并入 queued/running 统计。请人工核查任务状态。"
        />
      )}

      {healthError && (
        <DataErrorAlert
          error={healthError}
          context="系统健康状态"
          variant="inline"
          onRetry={onRetryHealth}
          retryLabel="重试"
        />
      )}
    </>
  );
}
