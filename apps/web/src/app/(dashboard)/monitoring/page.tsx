"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  App,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  ApiOutlined,
  ClusterOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  DashboardOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  QueueTaskDto,
  QueueTaskPriority,
  QueueTaskStatus,
  QueueTaskType,
  SloTargetDto,
  WorkerStatusDto,
} from "@design-platform/shared";
import {
  CONNECTOR_STATUS_COLOR,
  CONNECTOR_STATUS_LABEL,
  CONNECTOR_TYPE_LABEL,
  QUEUE_PRIORITY_COLOR,
  QUEUE_PRIORITY_LABEL,
  QUEUE_STATUS_COLOR,
  QUEUE_STATUS_LABEL,
  QUEUE_TYPE_LABEL,
  SLO_STATUS_COLOR,
  SLO_STATUS_LABEL,
  WORKER_STATUS_COLOR,
  WORKER_STATUS_LABEL,
  WORKER_TYPE_LABEL,
} from "@design-platform/shared";
import { useHealth } from "@/hooks/use-monitoring";
import {
  useConnectors,
  useOperationsAction,
  useOperationsOverview,
  useQueueTasks,
  useSlos,
  useWorkers,
} from "@/hooks/use-monitoring-operations";
import { useStepUpToken } from "@/hooks/use-step-up";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

/**
 * 运营中心 / Monitoring 页面（D37.17）
 *
 * 路由：/monitoring
 *
 * 布局（对齐 D37.17 §Operations）：
 *  - 顶部页头 + V0 限制提示
 *  - Tabs: 概览 | SLO 影响 | 任务队列 | Worker | 连接器
 *  - 概览：整体状态 + 4 项关键统计（运行/排队/失败/异常 Worker）
 *  - SLO：SLO 卡片网格（含错误预算剩余进度条）
 *  - 队列：任务表格（含重试次数/优先级/状态）
 *  - Worker：Worker 卡片网格（含 CPU/内存/心跳/主动作）
 *  - 连接器：连接器列表（含调用数/错误数/延迟/许可证）
 *
 * 主动作约束（D37.17 §Operations 危险动作）：
 *  - isolate/retry/reconcile/failover 为危险动作，必须打开影响预览
 *  - 显示租户/项目/资源数量、不可逆性、替代方案、审批/Step-up 和审计引用
 *  - 不能在图表卡片上放无上下文"修复全部"
 *
 * 特殊状态（D37.17 §Operations）：
 *  - unknown job：未知任务显示明确文字/图标，不并入 queued/running
 *  - retry storm：重试风暴检测，超阈值时显示告警并暂停自动重试
 *  - 数据驻留限制：跨 Region 操作显示数据驻留约束
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 Operations API（/api/v1/operations/**）尚未实现
 *  - hook 返回 404/501 时显示空状态
 *  - 不伪造数据（对齐 D37 §空状态红线）
 *  - 主动作按钮（isolate/retry/reconcile/failover）V0 占位 disabled
 */

/** 服务状态卡片 */
function ServiceCard({
  label,
  icon,
  health,
}: {
  label: string;
  icon: React.ReactNode;
  health?:
    | {
        status: "UP" | "DOWN";
        error?: string;
        details?: Record<string, unknown>;
      }
    | undefined;
}) {
  const isUp = health?.status === "UP";
  return (
    <Card size="small" hoverable>
      <Statistic
        title={label}
        value={isUp ? "UP" : "DOWN"}
        prefix={icon}
        valueStyle={{
          color: isUp ? "#3f8600" : "#cf1322",
          fontSize: 20,
        }}
        suffix={
          isUp ? (
            <CheckCircleOutlined style={{ fontSize: 16 }} />
          ) : (
            <CloseCircleOutlined style={{ fontSize: 16 }} />
          )
        }
      />
      {health?.error && (
        <Tag color="red" style={{ marginTop: 8 }}>
          {health.error}
        </Tag>
      )}
      {health?.details?.durationMs !== undefined && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
          延迟: {health.details.durationMs as number}ms
        </div>
      )}
    </Card>
  );
}

/** SLO 卡片 */
function SloCard({ slo }: { slo: SloTargetDto }) {
  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <Text strong>{slo.name}</Text>
          <Tag color={SLO_STATUS_COLOR[slo.status]}>
            {SLO_STATUS_LABEL[slo.status]}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="可用率目标">
            {slo.availabilityTarget}%
          </Descriptions.Item>
          <Descriptions.Item label="当前可用率">
            <span
              style={{
                color:
                  slo.availabilityCurrent >= slo.availabilityTarget
                    ? "#52c41a"
                    : "#ff4d4f",
                fontWeight: 600,
              }}
            >
              {slo.availabilityCurrent}%
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="错误预算">
            {slo.errorBudgetRemaining >= 0 ? (
              <Text type="success">剩余 {slo.errorBudgetRemaining}%</Text>
            ) : (
              <Text type="danger">超支 {-slo.errorBudgetRemaining}%</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="24h 请求数">
            {slo.requestCount24h.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="24h 错误数">
            <span
              style={{
                color:
                  slo.errorCount24h > 1000
                    ? "#ff4d4f"
                    : slo.errorCount24h > 100
                      ? "#faad14"
                      : "#52c41a",
              }}
            >
              {slo.errorCount24h.toLocaleString()}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="p95 / p99 延迟">
            <Text>
              {slo.p95LatencyMs} / {slo.p99LatencyMs} ms
            </Text>
          </Descriptions.Item>
        </Descriptions>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            错误预算剩余
          </Text>
          <Progress
            percent={Math.max(0, slo.errorBudgetRemaining)}
            size="small"
            status={
              slo.errorBudgetRemaining < 0
                ? "exception"
                : slo.errorBudgetRemaining < 30
                  ? "active"
                  : "success"
            }
          />
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          最后更新: {new Date(slo.updatedAt).toLocaleString("zh-CN")}
        </Text>
      </Space>
    </Card>
  );
}

/** Worker 卡片 */
function WorkerCard({ worker }: { worker: WorkerStatusDto }) {
  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <Text code>{worker.id}</Text>
          <Tag color="geekblue">{WORKER_TYPE_LABEL[worker.type]}</Tag>
          <Tag color={WORKER_STATUS_COLOR[worker.status]}>
            {WORKER_STATUS_LABEL[worker.status]}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="当前任务">
            {worker.currentTaskId ? (
              <Space direction="vertical" size={0}>
                <Text code>{worker.currentTaskId}</Text>
                {worker.currentTaskPayload && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {worker.currentTaskPayload}
                  </Text>
                )}
              </Space>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="已处理 / 失败">
            <Space>
              <Tag color="blue">{worker.processedCount}</Tag>
              <Tag color={worker.failedCount > 10 ? "error" : "default"}>
                {worker.failedCount}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="平均耗时">
            {Math.floor(worker.avgDurationSec / 60)}m{" "}
            {worker.avgDurationSec % 60}s
          </Descriptions.Item>
          <Descriptions.Item label="心跳">
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(worker.lastHeartbeat).toLocaleString("zh-CN")}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        {/* CPU / Memory */}
        <Space size="middle" style={{ width: "100%" }}>
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              CPU
            </Text>
            <Progress
              percent={worker.cpuPercent}
              size="small"
              status={
                worker.cpuPercent > 90
                  ? "exception"
                  : worker.cpuPercent > 70
                    ? "active"
                    : "success"
              }
            />
          </div>
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              内存
            </Text>
            <Progress
              percent={worker.memoryPercent}
              size="small"
              status={
                worker.memoryPercent > 90
                  ? "exception"
                  : worker.memoryPercent > 70
                    ? "active"
                    : "success"
              }
            />
          </div>
        </Space>

        {/* Hybrid-Site Region 标记 */}
        {worker.region && (
          <Space size={4}>
            <GlobalOutlined style={{ fontSize: 11, color: "#722ed1" }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Region: {worker.region}
              {worker.isCustomerSiteWorker ? "（客户站点）" : ""}
            </Text>
          </Space>
        )}

        {/* Worker 主动作（V0 占位 disabled，对齐 D37.17 §危险动作） */}
        <Space size="small">
          <Tooltip title="V0：暂停功能待 V1（需 stepUpToken + 影响预览）">
            <Button size="small" icon={<PauseCircleOutlined />} disabled>
              暂停
            </Button>
          </Tooltip>
          <Tooltip title="V0：恢复功能待 V1">
            <Button size="small" icon={<PlayCircleOutlined />} disabled>
              恢复
            </Button>
          </Tooltip>
        </Space>
      </Space>
    </Card>
  );
}

export default function MonitoringPage() {
  const { message, modal } = App.useApp();
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useHealth();
  const [activeTab, setActiveTab] = useState("overview");

  // Operations 真实数据 hooks
  const overviewQuery = useOperationsOverview();
  const slosQuery = useSlos();
  const queueQuery = useQueueTasks({ page: 1, pageSize: 100 });
  const workersQuery = useWorkers({});
  const connectorsQuery = useConnectors({});

  // 主动作 mutation hooks（接入真实 API）
  const operationsActionMutation = useOperationsAction();
  const stepUpMutation = useStepUpToken();

  const overview = overviewQuery.data;
  const slos = useMemo(() => slosQuery.data ?? [], [slosQuery.data]);
  const queueData = queueQuery.data;
  const queueTasks = useMemo(() => queueData?.items ?? [], [queueData?.items]);
  const workers = useMemo(() => workersQuery.data ?? [], [workersQuery.data]);
  const connectors = useMemo(
    () => connectorsQuery.data ?? [],
    [connectorsQuery.data],
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

  // 队列表格列定义
  const queueColumns: ColumnsType<QueueTaskDto> = [
    {
      title: "任务 ID",
      dataIndex: "id",
      key: "id",
      width: 100,
      fixed: "left",
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (t: QueueTaskType) => (
        <Tag color="geekblue">{QUEUE_TYPE_LABEL[t]}</Tag>
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 80,
      render: (p: QueueTaskPriority) => (
        <Tag color={QUEUE_PRIORITY_COLOR[p]}>{QUEUE_PRIORITY_LABEL[p]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: QueueTaskStatus) => (
        <Tag
          color={QUEUE_STATUS_COLOR[s]}
          icon={
            s === "running" ? (
              <SyncOutlined spin />
            ) : s === "failed" ? (
              <CloseCircleOutlined />
            ) : s === "completed" ? (
              <CheckCircleOutlined />
            ) : null
          }
        >
          {QUEUE_STATUS_LABEL[s]}
        </Tag>
      ),
    },
    {
      title: "负载",
      dataIndex: "payload",
      key: "payload",
      ellipsis: true,
      render: (p: string) => <Text type="secondary">{p}</Text>,
    },
    {
      title: "Worker",
      dataIndex: "workerId",
      key: "workerId",
      width: 130,
      render: (id?: string | null) =>
        id ? <Text code>{id}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "排队时间",
      dataIndex: "queuedAt",
      key: "queuedAt",
      width: 150,
      render: (t: string) => (
        <Tooltip title={new Date(t).toISOString()}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(t).toLocaleString("zh-CN")}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "耗时",
      dataIndex: "durationSec",
      key: "durationSec",
      width: 90,
      align: "right",
      render: (s?: number | null) =>
        s ? (
          <Text>
            {Math.floor(s / 60)}m {s % 60}s
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "重试",
      dataIndex: "retryCount",
      key: "retryCount",
      width: 80,
      align: "center",
      render: (n: number, record) => (
        <Tag
          color={
            n >= record.maxRetries ? "error" : n > 0 ? "warning" : "default"
          }
        >
          {n} / {record.maxRetries}
        </Tag>
      ),
    },
    {
      title: "Region",
      dataIndex: "dataRegion",
      key: "dataRegion",
      width: 100,
      render: (region?: string | null) =>
        region ? (
          <Tag color="purple">
            <GlobalOutlined style={{ marginRight: 4 }} />
            {region}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  // Retry Storm 恢复：弹出 Modal 让用户选择失败任务进行 cancel 操作
  // （D37.17 §危险动作：cancel 属于高风险动作，需 stepUpToken + 影响预览确认）
  const handleRetryStormRecovery = async () => {
    const failedTasks = queueTasks.filter((t) => t.status === "failed");
    if (failedTasks.length === 0) {
      message.info("未发现失败任务，可能 retry storm 状态已自动恢复");
      return;
    }

    // 第 1 步：申请 stepUpToken
    let currentPassword = "";
    let stepUpToken: string | null = null;
    await new Promise<void>((resolve) => {
      modal.confirm({
        title: "二次认证（Step-up）",
        icon: <SafetyCertificateOutlined />,
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text>Retry Storm 恢复为高风险动作，需要二次认证。</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              用途：取消失败任务以解除 Retry Storm 状态
            </Text>
            <Input.Password
              placeholder="当前用户密码"
              onChange={(e) => {
                currentPassword = e.target.value;
              }}
              autoFocus
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Step-up token 5 分钟内有效，仅可用于本次操作。
            </Text>
          </Space>
        ),
        okText: "确认认证",
        cancelText: "取消",
        onOk: async () => {
          if (!currentPassword) {
            message.error("请输入当前用户密码");
            resolve();
            return;
          }
          try {
            const resp = await stepUpMutation.mutateAsync({
              currentPassword,
              purpose: "Retry Storm 恢复：取消失败任务",
            });
            stepUpToken = resp.stepUpToken;
            resolve();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "认证失败";
            message.error(errMsg);
            resolve();
          }
        },
        onCancel: () => resolve(),
      });
    });

    if (!stepUpToken) return;

    // 第 2 步：选择失败任务 + 输入原因
    let selectedTaskId = failedTasks[0]?.id ?? "";
    let reason = "";
    await new Promise<void>((resolve) => {
      modal.confirm({
        title: "取消失败任务（解除 Retry Storm）",
        icon: <WarningOutlined />,
        content: (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Alert
              type="warning"
              showIcon
              message="不可逆操作"
              description="取消失败任务将释放队列资源，任务不可恢复。建议先排查根因。"
            />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                失败任务（共 {failedTasks.length} 个）
              </Text>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={selectedTaskId}
                onChange={(v: string) => {
                  selectedTaskId = v;
                }}
                options={failedTasks.map((t) => ({
                  value: t.id,
                  label: `${t.id.slice(0, 8)} · ${QUEUE_TYPE_LABEL[t.type]} · 重试 ${t.retryCount}/${t.maxRetries}`,
                }))}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                取消原因（必填，进入审计日志）
              </Text>
              <Input.TextArea
                rows={3}
                placeholder="例如：排查发现 OpenAI API 429 限流，已切换 Provider，取消该失败任务"
                onChange={(e) => {
                  reason = e.target.value;
                }}
              />
            </div>
          </Space>
        ),
        okText: "确认取消任务",
        okType: "danger",
        okButtonProps: { loading: operationsActionMutation.isPending },
        cancelText: "取消",
        onOk: async () => {
          if (!selectedTaskId) {
            message.error("请选择失败任务");
            throw new Error("未选择任务");
          }
          if (!reason.trim()) {
            message.error("请填写取消原因");
            throw new Error("原因不能为空");
          }
          try {
            const resp = await operationsActionMutation.mutateAsync({
              actionType: "cancel",
              targetType: "queue_task",
              targetId: selectedTaskId,
              reason,
              stepUpToken: stepUpToken!,
              impactPreviewAcknowledged: true,
            });
            message.success(
              `任务 ${resp.targetId.slice(0, 8)} 已取消，操作 ID: ${resp.operationId.slice(0, 8)}`,
            );
            resolve();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "取消失败";
            message.error(errMsg);
            throw err;
          }
        },
        onCancel: () => resolve(),
      });
    });
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <ClusterOutlined style={{ marginRight: 8 }} />
            运营中心
          </Title>
          <Text type="secondary">
            Operations（D37.17）· SLO / Queue / Worker / Connector · 实时刷新
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
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
              overviewQuery.isFetching ||
              slosQuery.isFetching ||
              queueQuery.isFetching ||
              workersQuery.isFetching ||
              connectorsQuery.isFetching
            }
            onClick={() => {
              void refetchHealth();
              void overviewQuery.refetch();
              void slosQuery.refetch();
              void queueQuery.refetch();
              void workersQuery.refetch();
              void connectorsQuery.refetch();
            }}
          >
            刷新
          </Button>
        }
      />

      {/* retry storm 告警（D37.17 §特殊状态） */}
      {summary.hasRetryStorm && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message="检测到 Retry Storm"
          description="系统检测到大量任务重试，已暂停自动重试。请人工排查失败任务根因后再恢复。"
          action={
            <Button
              size="small"
              loading={operationsActionMutation.isPending}
              onClick={handleRetryStormRecovery}
            >
              恢复重试
            </Button>
          }
        />
      )}

      {/* unknown job 告警（D37.17 §特殊状态） */}
      {summary.hasUnknownJobs && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="存在 Unknown Job"
          description="系统检测到未知状态的任务，未并入 queued/running 统计。请人工核查任务状态。"
        />
      )}

      {/* 错误提示 */}
      {healthError && (
        <DataErrorAlert
          error={healthError}
          context="系统健康状态"
          variant="inline"
          onRetry={() => void refetchHealth()}
          retryLabel="重试"
        />
      )}

      <Spin spinning={healthLoading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "overview",
              label: (
                <span>
                  <DashboardOutlined /> 概览
                </span>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="middle"
                  style={{ width: "100%" }}
                >
                  {/* 整体状态 */}
                  <Card size="small">
                    <Descriptions column={4} size="small">
                      <Descriptions.Item label="整体状态">
                        <Tag
                          color={overallUp ? "green" : "red"}
                          style={{ fontSize: 14, padding: "2px 12px" }}
                        >
                          {overallUp ? "ALL UP" : "DEGRADED"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="检测时间">
                        {health?.timestamp
                          ? new Date(health.timestamp).toLocaleString("zh-CN")
                          : overview?.timestamp
                            ? new Date(overview.timestamp).toLocaleString(
                                "zh-CN",
                              )
                            : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="自动刷新">
                        <Tag color="blue">30s</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="关键 SLO 严重告警">
                        <Tag
                          color={summary.criticalSlos > 0 ? "error" : "success"}
                        >
                          {summary.criticalSlos}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>

                  {/* 服务状态卡 */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={8}>
                      <ServiceCard
                        label="BFF 服务"
                        icon={<DesktopOutlined />}
                        health={health?.services.bff}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <ServiceCard
                        label="核心服务"
                        icon={<CloudServerOutlined />}
                        health={health?.services.core}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <ServiceCard
                        label="AI 服务"
                        icon={<RobotOutlined />}
                        health={health?.services.ai}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <ServiceCard
                        label="PostgreSQL"
                        icon={<DatabaseOutlined />}
                        health={health?.services.postgresql}
                      />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <ServiceCard
                        label="MinIO (S3)"
                        icon={<CloudServerOutlined />}
                        health={health?.services.minio}
                      />
                    </Col>
                  </Row>

                  {/* 关键统计 */}
                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                      <Card size="small">
                        <Statistic
                          title="运行中任务"
                          value={summary.runningTasks}
                          prefix={
                            <ThunderboltOutlined style={{ color: "#1890ff" }} />
                          }
                          valueStyle={{ color: "#1890ff" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small">
                        <Statistic
                          title="排队任务"
                          value={summary.queuedTasks}
                          prefix={
                            <ClockCircleOutlined style={{ color: "#722ed1" }} />
                          }
                          valueStyle={{ color: "#722ed1" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small">
                        <Statistic
                          title="失败任务"
                          value={summary.failedTasks}
                          prefix={
                            <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                          }
                          valueStyle={{ color: "#ff4d4f" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small">
                        <Statistic
                          title="异常 Worker"
                          value={summary.errorWorkers}
                          prefix={
                            <WarningOutlined style={{ color: "#faad14" }} />
                          }
                          valueStyle={{ color: "#faad14" }}
                        />
                      </Card>
                    </Col>
                  </Row>
                </Space>
              ),
            },
            {
              key: "slo",
              label: (
                <span>
                  <SafetyCertificateOutlined /> SLO 影响
                </span>
              ),
              children: (
                <Card size="small">
                  <Spin spinning={slosQuery.isLoading}>
                    {slos.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">暂无 SLO 数据</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              后端 /api/v1/operations/slos 未实现时显示空状态
                            </Text>
                          </Space>
                        }
                        style={{ padding: 48 }}
                      />
                    ) : (
                      <Row gutter={[16, 16]}>
                        {slos.map((slo) => (
                          <Col xs={24} lg={12} key={slo.id}>
                            <SloCard slo={slo} />
                          </Col>
                        ))}
                      </Row>
                    )}
                  </Spin>
                </Card>
              ),
            },
            {
              key: "queue",
              label: (
                <span>
                  <NodeIndexOutlined /> 任务队列
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {queueData?.total ?? queueTasks.length}
                  </Tag>
                </span>
              ),
              children: (
                <Card size="small" bodyStyle={{ padding: 0 }}>
                  <Spin spinning={queueQuery.isLoading}>
                    {queueTasks.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">暂无队列任务</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              后端 /api/v1/operations/queue 未实现时显示空状态
                            </Text>
                          </Space>
                        }
                        style={{ padding: 48 }}
                      />
                    ) : (
                      <Table<QueueTaskDto>
                        rowKey="id"
                        columns={queueColumns}
                        dataSource={queueTasks}
                        size="small"
                        pagination={false}
                        scroll={{ x: 1300 }}
                      />
                    )}
                  </Spin>
                </Card>
              ),
            },
            {
              key: "worker",
              label: (
                <span>
                  <ApiOutlined /> Worker
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {workers.length}
                  </Tag>
                </span>
              ),
              children: (
                <Card size="small">
                  <Spin spinning={workersQuery.isLoading}>
                    {workers.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">暂无 Worker 数据</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              后端 /api/v1/operations/workers 未实现时显示空状态
                            </Text>
                          </Space>
                        }
                        style={{ padding: 48 }}
                      />
                    ) : (
                      <Row gutter={[16, 16]}>
                        {workers.map((w) => (
                          <Col xs={24} sm={12} lg={8} key={w.id}>
                            <WorkerCard worker={w} />
                          </Col>
                        ))}
                      </Row>
                    )}
                  </Spin>
                </Card>
              ),
            },
            {
              key: "connector",
              label: (
                <span>
                  <ApiOutlined /> 连接器
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {connectors.length}
                  </Tag>
                </span>
              ),
              children: (
                <Card size="small">
                  <Spin spinning={connectorsQuery.isLoading}>
                    {connectors.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">暂无连接器数据</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              后端 /api/v1/operations/connectors
                              未实现时显示空状态
                            </Text>
                          </Space>
                        }
                        style={{ padding: 48 }}
                      />
                    ) : (
                      <List
                        size="small"
                        dataSource={connectors}
                        renderItem={(c) => (
                          <List.Item>
                            <Space
                              style={{
                                width: "100%",
                                justifyContent: "space-between",
                              }}
                              wrap
                            >
                              <Space direction="vertical" size={0}>
                                <Space>
                                  <Badge
                                    status={
                                      c.status === "connected"
                                        ? "success"
                                        : c.status === "degraded"
                                          ? "warning"
                                          : c.status === "disconnected"
                                            ? "error"
                                            : "default"
                                    }
                                  />
                                  <Text strong>{c.name}</Text>
                                  <Tag color="geekblue">
                                    {CONNECTOR_TYPE_LABEL[c.type]}
                                  </Tag>
                                  <Tag color={CONNECTOR_STATUS_COLOR[c.status]}>
                                    {CONNECTOR_STATUS_LABEL[c.status]}
                                  </Tag>
                                  {c.isManualHandoff && (
                                    <Tooltip title="OD-05 外部 AI V1 约束：ManualHandoff">
                                      <Tag color="orange">ManualHandoff</Tag>
                                    </Tooltip>
                                  )}
                                </Space>
                                <Space size="middle">
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: 11 }}
                                  >
                                    最近 1h: 调用 {c.callCount1h} 次 / 错误{" "}
                                    {c.errorCount1h} 次 / 平均延迟{" "}
                                    {c.avgLatencyMs}ms
                                  </Text>
                                  {c.licenseRemaining && (
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: 11 }}
                                    >
                                      许可证: {c.licenseRemaining}
                                    </Text>
                                  )}
                                </Space>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  最近使用:{" "}
                                  {new Date(c.lastUsedAt).toLocaleString(
                                    "zh-CN",
                                  )}
                                </Text>
                              </Space>
                              <Space size="small">
                                <Tooltip title="V0：重试连接待 V1（需 stepUpToken + 影响预览）">
                                  <Button
                                    size="small"
                                    icon={<SyncOutlined />}
                                    disabled
                                  >
                                    重试
                                  </Button>
                                </Tooltip>
                              </Space>
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </Spin>
                </Card>
              ),
            },
          ]}
        />
      </Spin>
    </Space>
  );
}
