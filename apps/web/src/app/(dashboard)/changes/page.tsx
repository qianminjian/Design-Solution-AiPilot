"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  BranchesOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  CHANGE_PRIORITY_COLOR,
  CHANGE_PRIORITY_LABEL,
  CHANGE_STATUS_COLOR,
  CHANGE_STATUS_LABEL,
  CHANGE_TYPE_LABEL,
  type ChangePriority,
  type ChangeRequestDto,
  type ChangeStatus,
  type ChangeType,
} from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { useChangeRequests } from "@/hooks/use-changes";

const { Title, Text } = Typography;

/**
 * P12 变更影响与闭环工作台 — 列表页（D37.16）
 *
 * 路由：/changes
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 ChangeRequest API 未实现，hook 返回 404/501 时显示空状态
 *  - 不伪造数据（对齐 D37 §空状态红线）
 *  - "新建变更请求"按钮 disabled，V1 实现
 *  - 点击行进入 /changes/{changeId} 查看详情
 *
 * 对齐 D37.16：
 *  - 显示变更编号、标题、类型、优先级、状态、影响项数量、处置进度
 *  - 空状态：引导用户创建变更请求
 *  - 错误态：使用 DataErrorAlert 统一展示
 *
 * 安全红线（design-constraints.md）：
 *  - 所有变更必须可追溯（影响版本、水位、Owner）
 *  - AI 辅助影响分析结果须人工确认
 */

export default function ChangesListPage() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<ChangeType | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<
    ChangePriority | undefined
  >();

  const { data, isLoading, error, refetch, isFetching } = useChangeRequests({
    keyword: keyword || undefined,
    status: statusFilter,
    type: typeFilter,
    priority: priorityFilter,
    page: 1,
    pageSize: 50,
  });

  const changes = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: ColumnsType<ChangeRequestDto> = [
    {
      title: "编号",
      dataIndex: "code",
      key: "code",
      width: 110,
      fixed: "left",
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            发起: {record.requesterName ?? record.requesterId}
            {record.approverName ? ` · 批准: ${record.approverName}` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 90,
      render: (type: ChangeType) => (
        <Tag color="geekblue">{CHANGE_TYPE_LABEL[type]}</Tag>
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      render: (priority: ChangePriority) => (
        <Tag color={CHANGE_PRIORITY_COLOR[priority]}>
          {CHANGE_PRIORITY_LABEL[priority]}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: ChangeStatus) => (
        <Tag color={CHANGE_STATUS_COLOR[status]}>
          {CHANGE_STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: "影响项",
      dataIndex: "affectedItemCount",
      key: "affectedItemCount",
      width: 80,
      align: "center",
      render: (count: number) => (
        <Tooltip title="受影响的需求/模型/图纸/规则等对象数量">
          <Tag color={count === 0 ? "default" : "orange"}>{count}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "处置进度",
      key: "progress",
      width: 130,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip
            title={record.hasTaskPlan ? "已生成处置任务" : "未生成处置任务"}
          >
            <Tag color={record.hasTaskPlan ? "green" : "default"}>任务</Tag>
          </Tooltip>
          <Tooltip
            title={
              record.hasClosureEvidence ? "已收集关闭证据" : "未收集关闭证据"
            }
          >
            <Tag color={record.hasClosureEvidence ? "green" : "default"}>
              证据
            </Tag>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(val).toLocaleString()}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/changes/${record.id}`);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/dashboard")}
          style={{ paddingLeft: 0 }}
        >
          返回首页
        </Button>
        <Tooltip title="V0 阶段：新建变更请求功能待 V1 实现">
          <Button type="primary" icon={<PlusOutlined />} disabled>
            新建变更请求
          </Button>
        </Tooltip>
      </div>

      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <BranchesOutlined style={{ marginRight: 8 }} />
            变更影响与闭环工作台
          </Title>
          <Text type="secondary">
            Change Impact &amp; Closure（D37.16 P12）· V0 阶段：后端 API
            未实现时显示空状态
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="变更管理 API 待 V1 实现"
        description="后端 ChangeRequest / ImpactGraph / TaskPlan / ClosureEvidence API 尚未实现，下方列表实时查询后端；返回 404/501 时显示空状态，不伪造数据。"
      />

      {/* 错误态 */}
      {error ? (
        <DataErrorAlert
          error={error}
          context="变更请求列表"
          variant="inline"
          onRetry={() => void refetch()}
          retryLabel="重试"
        />
      ) : null}

      {/* 过滤栏 */}
      <Card size="small">
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索编号 / 标题 / 发起人..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            aria-label="搜索变更请求"
          />
          <Select<ChangeStatus>
            allowClear
            placeholder="按状态筛选"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(CHANGE_STATUS_LABEL).map(
              ([value, label]) => ({
                value: value as ChangeStatus,
                label,
              }),
            )}
          />
          <Select<ChangeType>
            allowClear
            placeholder="按类型筛选"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(CHANGE_TYPE_LABEL).map(
              ([value, label]) => ({
                value: value as ChangeType,
                label,
              }),
            )}
          />
          <Select<ChangePriority>
            allowClear
            placeholder="按优先级筛选"
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(CHANGE_PRIORITY_LABEL).map(
              ([value, label]) => ({
                value: value as ChangePriority,
                label,
              }),
            )}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {total} 条变更请求
          </Text>
          <Tooltip title="刷新列表">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => void refetch()}
              loading={isFetching}
            >
              刷新
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* 列表 */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Spin spinning={isLoading}>
          {changes.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">暂无变更请求</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    后端未实现时显示空状态；新建变更请求功能待 V1 实现
                  </Text>
                </Space>
              }
              style={{ padding: 48 }}
            />
          ) : (
            <Table<ChangeRequestDto>
              rowKey="id"
              columns={columns}
              dataSource={changes}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                total,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: 1200 }}
              size="small"
              onRow={(record) => ({
                onClick: () => router.push(`/changes/${record.id}`),
                style: { cursor: "pointer" },
              })}
            />
          )}
        </Spin>
      </Card>
    </Space>
  );
}
