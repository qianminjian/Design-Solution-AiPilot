"use client";

import {
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  GlobalOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import type { WorkerStatusDto } from "@design-platform/shared";
import {
  WORKER_STATUS_COLOR,
  WORKER_STATUS_LABEL,
  WORKER_TYPE_LABEL,
} from "@design-platform/shared";

const { Text } = Typography;

/**
 * Worker 卡片（D37.17 Worker 视图）
 *
 * 展示单个 Worker 的实时状态：
 *  - 当前任务 + 已处理/失败计数 + 平均耗时 + 心跳
 *  - CPU/内存使用率进度条（>90% 红 / >70% 黄 / 其他绿）
 *  - Hybrid-Site Region 标记（客户站点 Worker 高亮）
 *  - 主动作按钮（V1.10+ PAUSE/RESUME/DELETE）
 *
 * 安全红线：
 *  - DELETE 仅 STOPPED/ERROR 状态可用（对齐后端 WorkerService.deleteWorker）
 *  - PAUSE 仅 RUNNING/IDLE 状态可用（对齐 WorkerService.pauseWorker）
 *  - RESUME 仅 STOPPED 状态可用（对齐 WorkerService.resumeWorker）
 */
export function WorkerCard({
  worker,
  onDelete,
  onPause,
  onResume,
}: {
  worker: WorkerStatusDto;
  onDelete?: (workerId: string, workerLabel: string) => void;
  onPause?: (workerId: string, workerLabel: string) => void;
  onResume?: (workerId: string, workerLabel: string) => void;
}) {
  // V1.10: 仅 STOPPED/ERROR 状态的 Worker 允许删除（对齐后端 WorkerService.deleteWorker 校验）
  const canDelete = worker.status === "stopped" || worker.status === "error";
  // V1.10.1: 仅 RUNNING/IDLE 状态的 Worker 允许暂停（对齐后端 WorkerService.pauseWorker 校验）
  const canPause = worker.status === "running" || worker.status === "idle";
  // V1.10.1: 仅 STOPPED 状态的 Worker 允许恢复（对齐后端 WorkerService.resumeWorker 校验）
  const canResume = worker.status === "stopped";
  const workerLabel = `${WORKER_TYPE_LABEL[worker.type]} · ${worker.id.slice(0, 8)}`;
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

        {/* Worker 主动作（V1.10.1 PAUSE/RESUME V1 接入，对齐 D37.17 §危险动作） */}
        <Space size="small">
          {canPause ? (
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => onPause?.(worker.id, workerLabel)}
            >
              暂停
            </Button>
          ) : (
            <Tooltip title="V1.10.1：仅 RUNNING/IDLE 状态的 Worker 允许暂停">
              <Button size="small" icon={<PauseCircleOutlined />} disabled>
                暂停
              </Button>
            </Tooltip>
          )}
          {canResume ? (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onResume?.(worker.id, workerLabel)}
            >
              恢复
            </Button>
          ) : (
            <Tooltip title="V1.10.1：仅 STOPPED 状态的 Worker 允许恢复">
              <Button size="small" icon={<PlayCircleOutlined />} disabled>
                恢复
              </Button>
            </Tooltip>
          )}
          {canDelete ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete?.(worker.id, workerLabel)}
            >
              删除
            </Button>
          ) : (
            <Tooltip title="V1.10：仅 STOPPED/ERROR 状态的 Worker 允许删除，请先 isolate 或 pause">
              <Button size="small" icon={<DeleteOutlined />} disabled>
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      </Space>
    </Card>
  );
}
