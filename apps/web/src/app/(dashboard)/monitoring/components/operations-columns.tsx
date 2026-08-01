"use client";

import { Button, Space, Tag, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  DualApprovalStatus,
  OperationsActionResponseDto,
  QueueTaskDto,
  QueueTaskPriority,
  QueueTaskStatus,
  QueueTaskType,
} from "@design-platform/shared";
import {
  DUAL_APPROVAL_STATUS_COLOR,
  DUAL_APPROVAL_STATUS_LABEL,
  OPERATIONS_ACTION_LABEL,
  QUEUE_PRIORITY_COLOR,
  QUEUE_PRIORITY_LABEL,
  QUEUE_STATUS_COLOR,
  QUEUE_STATUS_LABEL,
  QUEUE_TYPE_LABEL,
} from "@design-platform/shared";

const { Text } = Typography;

/**
 * 任务队列列表的列定义（D37.17 §任务队列视图）
 *
 * 列：任务 ID / 类型 / 优先级 / 状态 / 负载 / Worker / 排队时间 / 耗时 / 重试 / Region
 *
 * 安全红线：
 *  - 重试列展示 n/maxRetries，达到阈值显示红色（DEAD_LETTER 触发条件）
 *  - Region 列展示数据驻留约束（Hybrid-Site）
 */
export const queueColumns: ColumnsType<QueueTaskDto> = [
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
        color={n >= record.maxRetries ? "error" : n > 0 ? "warning" : "default"}
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

/**
 * 风险等级颜色映射（D37.17 §危险动作）
 */
const RISK_COLOR_MAP: Record<string, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "warning",
  IRREVERSIBLE: "error",
};

/**
 * 风险等级中文标签映射
 */
const RISK_LABEL_MAP: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  IRREVERSIBLE: "不可逆",
};

/**
 * 待审批操作列表的列定义工厂函数（D37.23 §不可逆/合规：二人审批）
 *
 * 列：操作 ID / 动作 / 风险等级 / 目标对象 / 审批状态 / 发起人 / 发起时间 / 审计追踪 / 操作
 *
 * 由于"操作"列需要触发 setActiveActionId + openApprovalModal，
 * 通过 props 注入回调，避免组件耦合页面内部状态。
 */
export function buildPendingActionsColumns(options: {
  onSelectAction: (
    operationId: string,
    kind: "approve_review1" | "approve_review2",
  ) => void;
  onViewDetail: (operationId: string) => void;
}): ColumnsType<OperationsActionResponseDto> {
  const { onSelectAction, onViewDetail } = options;
  return [
    {
      title: "操作 ID",
      dataIndex: "operationId",
      key: "operationId",
      width: 140,
      fixed: "left",
      render: (id: string) => <Text code>{id.slice(0, 13)}</Text>,
    },
    {
      title: "动作",
      dataIndex: "actionType",
      key: "actionType",
      width: 110,
      render: (t: OperationsActionResponseDto["actionType"]) => (
        <Tag color="volcano">{OPERATIONS_ACTION_LABEL[t]}</Tag>
      ),
    },
    {
      title: "风险等级",
      dataIndex: "riskLevel",
      key: "riskLevel",
      width: 110,
      render: (r?: string | null) => {
        if (!r) return <Text type="secondary">—</Text>;
        return (
          <Tag color={RISK_COLOR_MAP[r] ?? "default"}>
            {RISK_LABEL_MAP[r] ?? r}
          </Tag>
        );
      },
    },
    {
      title: "目标对象",
      dataIndex: "targetId",
      key: "targetId",
      width: 180,
      render: (id: string) => <Text code>{id.slice(0, 13)}</Text>,
    },
    {
      title: "审批状态",
      dataIndex: "dualApprovalStatus",
      key: "dualApprovalStatus",
      width: 140,
      render: (s?: DualApprovalStatus | null) => {
        if (!s) return <Text type="secondary">—</Text>;
        return (
          <Tag color={DUAL_APPROVAL_STATUS_COLOR[s]}>
            {DUAL_APPROVAL_STATUS_LABEL[s]}
          </Tag>
        );
      },
    },
    {
      title: "发起人",
      dataIndex: "initiatedBy",
      key: "initiatedBy",
      width: 120,
      render: (v?: string | null) =>
        v ? <Text>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "发起时间",
      dataIndex: "initiatedAt",
      key: "initiatedAt",
      width: 160,
      render: (t?: string | null) =>
        t ? (
          <Tooltip title={t}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {new Date(t).toLocaleString("zh-CN")}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "审计追踪",
      dataIndex: "auditTraceId",
      key: "auditTraceId",
      width: 120,
      render: (id?: string | null) =>
        id ? (
          <Tooltip title={id}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {id.slice(0, 13)}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 140,
      fixed: "right",
      render: (_: unknown, record: OperationsActionResponseDto) => {
        const status = record.dualApprovalStatus;
        const isPendingReview1 = status === "pending_review1";
        const isPendingReview2 = status === "pending_review2";
        return (
          <Space size={4}>
            {(isPendingReview1 || isPendingReview2) && (
              <Button
                size="small"
                type="primary"
                onClick={() =>
                  onSelectAction(
                    record.operationId,
                    isPendingReview1 ? "approve_review1" : "approve_review2",
                  )
                }
              >
                审批
              </Button>
            )}
            <Button
              size="small"
              onClick={() => onViewDetail(record.operationId)}
            >
              详情
            </Button>
          </Space>
        );
      },
    },
  ];
}
