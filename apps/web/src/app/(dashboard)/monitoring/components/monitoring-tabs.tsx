"use client";

import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ApiOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DesktopOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  ConnectorStatusDto,
  HealthCheckResult,
  OperationsActionResponseDto,
  OperationsOverviewDto,
  QueueTaskDto,
  SloTargetDto,
  WorkerStatusDto,
} from "@design-platform/shared";
import {
  CONNECTOR_STATUS_COLOR,
  CONNECTOR_STATUS_LABEL,
  CONNECTOR_TYPE_LABEL,
} from "@design-platform/shared";
import type { UseQueryResult } from "@tanstack/react-query";
import { ServiceCard } from "./service-card";
import { SloCard } from "./slo-card";
import { WorkerCard } from "./worker-card";

const { Text } = Typography;

/**
 * Monitoring 页面 Tabs 容器（D37.17 §Operations 6 大视图）
 *
 * 6 个 Tab：
 *  - overview：整体状态 + 5 个服务状态卡 + 4 项关键统计
 *  - slo：SLO 卡片网格（含错误预算剩余进度条）
 *  - queue：任务表格（含重试次数/优先级/状态）
 *  - worker：Worker 卡片网格（含 CPU/内存/心跳/主动作）
 *  - connector：连接器列表（含调用数/错误数/延迟/许可证）
 *  - pending_actions：待审批操作表格（IRREVERSIBLE 动作双人审批入口）
 */
export interface MonitoringTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // 概览数据
  health: HealthCheckResult | undefined;
  healthLoading: boolean;
  overview: UseQueryResult<OperationsOverviewDto>["data"] | undefined;
  summary: {
    runningTasks: number;
    queuedTasks: number;
    failedTasks: number;
    errorWorkers: number;
    criticalSlos: number;
    hasRetryStorm: boolean;
    hasUnknownJobs: boolean;
  };
  overallUp: boolean;

  // SLO
  slos: SloTargetDto[];
  slosQuery: UseQueryResult<SloTargetDto[]>;

  // 队列
  queueData: { total?: number; items?: QueueTaskDto[] } | undefined;
  queueTasks: QueueTaskDto[];
  queueQuery: UseQueryResult<unknown>;
  queueColumns: ColumnsType<QueueTaskDto>;

  // Worker
  workers: WorkerStatusDto[];
  workersQuery: UseQueryResult<unknown>;
  handlePauseResource: (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => void;
  handleResumeResource: (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => void;
  handleDeleteResource: (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => void;

  // 连接器
  connectors: ConnectorStatusDto[];
  connectorsQuery: UseQueryResult<unknown>;
  registerConnectorPending: boolean;
  openRegisterModal: () => void;

  // 待审批
  pendingActions: OperationsActionResponseDto[];
  pendingActionsQuery: UseQueryResult<unknown>;
  pendingActionsData:
    { total?: number; items?: OperationsActionResponseDto[] } | undefined;
  pendingActionsColumns: ColumnsType<OperationsActionResponseDto>;
}

export function MonitoringTabs(props: MonitoringTabsProps) {
  const {
    activeTab,
    setActiveTab,
    health,
    summary,
    overallUp,
    slos,
    slosQuery,
    queueData,
    queueTasks,
    queueQuery,
    queueColumns,
    workers,
    workersQuery,
    handlePauseResource,
    handleResumeResource,
    handleDeleteResource,
    connectors,
    connectorsQuery,
    registerConnectorPending,
    openRegisterModal,
    pendingActions,
    pendingActionsQuery,
    pendingActionsData,
    pendingActionsColumns,
    overview,
  } = props;

  return (
    <Spin spinning={false}>
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
                          ? new Date(overview.timestamp).toLocaleString("zh-CN")
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
                          <WorkerCard
                            worker={w}
                            onDelete={(workerId, workerLabel) =>
                              handleDeleteResource(
                                "worker",
                                workerId,
                                workerLabel,
                              )
                            }
                            onPause={(workerId, workerLabel) =>
                              handlePauseResource(
                                "worker",
                                workerId,
                                workerLabel,
                              )
                            }
                            onResume={(workerId, workerLabel) =>
                              handleResumeResource(
                                "worker",
                                workerId,
                                workerLabel,
                              )
                            }
                          />
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
              <Card
                size="small"
                title={
                  <Space>
                    <ApiOutlined />
                    <Text strong>连接器列表</Text>
                    <Tooltip title="V1.10.3：注册新连接器（幂等，对齐 Worker register 模式）">
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        loading={registerConnectorPending}
                        onClick={openRegisterModal}
                      >
                        注册新连接器
                      </Button>
                    </Tooltip>
                  </Space>
                }
              >
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
                          <Button
                            size="small"
                            type="link"
                            icon={<PlusOutlined />}
                            onClick={openRegisterModal}
                          >
                            注册第一个连接器
                          </Button>
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
                                <Text type="secondary" style={{ fontSize: 11 }}>
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
                                {new Date(c.lastUsedAt).toLocaleString("zh-CN")}
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
                              {c.status === "disconnected" ? (
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() =>
                                    handleDeleteResource(
                                      "connector",
                                      c.id,
                                      c.name,
                                    )
                                  }
                                >
                                  删除
                                </Button>
                              ) : (
                                <Tooltip title="V1.10：仅 DISCONNECTED 状态的连接器允许删除，请先 isolate 或 failover">
                                  <Button
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    disabled
                                  >
                                    删除
                                  </Button>
                                </Tooltip>
                              )}
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
          {
            key: "pending_actions",
            label: (
              <span>
                <SafetyCertificateOutlined /> 待审批
                {pendingActions.length > 0 && (
                  <Tag color="warning" style={{ marginLeft: 4 }}>
                    {pendingActions.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <Card size="small" bodyStyle={{ padding: 0 }}>
                <Spin spinning={pendingActionsQuery.isLoading}>
                  {pendingActions.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">暂无待审批操作</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            IRREVERSIBLE 动作（如 cancel）发起后将进入待审批列表
                          </Text>
                        </Space>
                      }
                      style={{ padding: 48 }}
                    />
                  ) : (
                    <Table<OperationsActionResponseDto>
                      rowKey="operationId"
                      columns={pendingActionsColumns}
                      dataSource={pendingActions}
                      size="small"
                      pagination={{
                        total:
                          pendingActionsData?.total ?? pendingActions.length,
                        pageSize: 20,
                        showSizeChanger: false,
                        showTotal: (total) => `共 ${total} 条待审批`,
                      }}
                      scroll={{ x: 1300 }}
                    />
                  )}
                </Spin>
              </Card>
            ),
          },
        ]}
      />
    </Spin>
  );
}
