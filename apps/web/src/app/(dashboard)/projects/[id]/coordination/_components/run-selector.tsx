"use client";

import {
  Alert,
  Badge,
  Button,
  Empty,
  List,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type {
  ClashRunDto,
  ClashRunStatus,
  CoordinationCheckType,
} from "@design-platform/shared";
import { useClashRuns } from "@/hooks/use-coordination";

const { Text } = Typography;

/**
 * P07 协调工作台左侧 RunSelector
 * 对齐 D37.11 §布局「Run/规则选择」
 *
 * 功能：
 *  - 列出项目下所有 ClashRun
 *  - 选中 Run 后触发 onRunChange 回调（驱动中部 DataGrid 与右侧 Context rail）
 *  - 显示运行状态、Finding 统计、Cluster 统计
 *  - 支持「创建 Run」入口（D37.11 §主动作：主动作触发 Run 生成）
 *
 * V0：后端 Coordination API 未就位时显示空状态，不伪造数据
 */

const RUN_STATUS_COLOR: Record<ClashRunStatus, string> = {
  PENDING: "default",
  RUNNING: "processing",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "warning",
};

const RUN_STATUS_LABEL: Record<ClashRunStatus, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const CHECK_TYPE_LABEL: Record<CoordinationCheckType, string> = {
  CLASH: "碰撞检测",
  CLEARANCE: "间距检查",
  CONSISTENCY: "一致性",
  CODE_CHECK: "规范合规",
};

const STATUS_ICON: Record<ClashRunStatus, React.ReactNode> = {
  PENDING: <ClockCircleOutlined />,
  RUNNING: <ThunderboltOutlined />,
  COMPLETED: <CheckCircleOutlined />,
  FAILED: <ExclamationCircleOutlined />,
  CANCELLED: <StopOutlined />,
};

interface RunSelectorProps {
  projectId: string;
  selectedRunId: string | null;
  onRunChange: (run: ClashRunDto) => void;
  onCreateRun?: () => void;
}

export function RunSelector({
  projectId,
  selectedRunId,
  onRunChange,
  onCreateRun,
}: RunSelectorProps) {
  const { data, isLoading, isError, error } = useClashRuns(projectId);

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin tip="加载协调运行列表..." />
      </div>
    );
  }

  if (isError) {
    const status = (error as { status?: number })?.status;
    const isNotImplemented = status === 404 || status === 501;
    return (
      <Alert
        type={isNotImplemented ? "info" : "error"}
        showIcon
        message={isNotImplemented ? "协调 API 待 V1 实现" : "加载运行列表失败"}
        description={
          isNotImplemented
            ? "后端 Coordination API（D11）尚未接入，V0 阶段展示空状态。点击「新建 Run」可预览创建表单。"
            : "请稍后重试或联系管理员"
        }
        style={{ margin: 12 }}
      />
    );
  }

  const runs = data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong>协调运行</Text>
        <Button
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={onCreateRun}
        >
          新建 Run
        </Button>
      </div>
      {runs.length === 0 ? (
        <div style={{ padding: 24, flex: 1 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12 }}>
                暂无协调运行
                <br />
                点击「新建 Run」开始检测
              </span>
            }
          />
        </div>
      ) : (
        <List
          dataSource={runs}
          renderItem={(run) => (
            <List.Item
              key={run.id}
              onClick={() => onRunChange(run)}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderLeft:
                  selectedRunId === run.id
                    ? "3px solid #1677ff"
                    : "3px solid transparent",
                background:
                  selectedRunId === run.id ? "#e6f4ff" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text strong style={{ fontSize: 13 }}>
                    {STATUS_ICON[run.status]} #{run.runIndex} {run.name}
                  </Text>
                  <Tag
                    color={RUN_STATUS_COLOR[run.status]}
                    style={{ fontSize: 11 }}
                  >
                    {RUN_STATUS_LABEL[run.status]}
                  </Tag>
                </div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                  {CHECK_TYPE_LABEL[run.checkType]} · 规则 {run.ruleIds.length}{" "}
                  项
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {run.criticalCount > 0 && (
                    <Tooltip title="严重 Finding">
                      <Badge
                        count={run.criticalCount}
                        size="small"
                        color="red"
                      />
                    </Tooltip>
                  )}
                  {run.highCount > 0 && (
                    <Tooltip title="高严重 Finding">
                      <Badge
                        count={run.highCount}
                        size="small"
                        color="orange"
                      />
                    </Tooltip>
                  )}
                  {run.clusterCount > 0 && (
                    <Tooltip title="Cluster 数">
                      <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                        聚类 {run.clusterCount}
                      </Tag>
                    </Tooltip>
                  )}
                  {run.linkedIssueCount > 0 && (
                    <Tooltip title="已关联 Issue">
                      <Tag color="green" style={{ fontSize: 11, margin: 0 }}>
                        Issue {run.linkedIssueCount}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
