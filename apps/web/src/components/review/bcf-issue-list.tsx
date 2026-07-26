"use client";

import { useState, useCallback } from "react";
import {
  Table,
  Tag,
  Select,
  Button,
  Modal,
  Form,
  Input,
  App,
  Empty,
  Spin,
  Dropdown,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import { UserOutlined, MoreOutlined } from "@ant-design/icons";
import type {
  BcfIssue,
  BcfIssueStatus,
  BcfIssuePriority,
} from "@/hooks/use-review";

interface BcfIssueListProps {
  data: BcfIssue[];
  loading?: boolean;
  /** 更新问题状态 */
  onStatusChange?: (issueId: string, status: BcfIssueStatus) => void;
  /** 指派问题 */
  onAssign?: (issueId: string, assignee: string) => void;
}

/** 优先级配置 */
const PRIORITY_CONFIG: Record<
  BcfIssuePriority,
  { color: string; label: string }
> = {
  critical: { color: "red", label: "Critical" },
  high: { color: "orange", label: "High" },
  medium: { color: "gold", label: "Medium" },
  low: { color: "blue", label: "Low" },
};

/** 未知优先级兜底配置 */
const PRIORITY_FALLBACK = { color: "default", label: "未知" };

/**
 * 安全访问优先级配置
 * 未知枚举值返回兜底配置，避免后端返回新枚举值时渲染崩溃
 */
function getPriorityConfig(
  priority: BcfIssuePriority | string | undefined | null,
): { color: string; label: string } {
  return priority && priority in PRIORITY_CONFIG
    ? PRIORITY_CONFIG[priority as BcfIssuePriority]
    : PRIORITY_FALLBACK;
}

/** 判断是否为已知优先级 */
function isKnownPriority(
  priority: BcfIssuePriority | string | undefined | null,
): boolean {
  return !!priority && priority in PRIORITY_CONFIG;
}

/** 状态变更选项 */
const STATUS_OPTIONS: { label: string; value: BcfIssueStatus }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

export function BcfIssueList({
  data,
  loading,
  onStatusChange,
  onAssign,
}: BcfIssueListProps) {
  const { message } = App.useApp();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [assignForm] = Form.useForm<{ assignee: string }>();

  // 打开指派弹窗
  const handleOpenAssign = useCallback(
    (issueId: string) => {
      setActiveIssueId(issueId);
      assignForm.resetFields();
      setAssignModalOpen(true);
    },
    [assignForm],
  );

  // 提交指派
  const handleAssignSubmit = useCallback(async () => {
    try {
      const values = await assignForm.validateFields();
      if (activeIssueId && onAssign) {
        onAssign(activeIssueId, values.assignee);
        message.success("指派成功");
      }
      setAssignModalOpen(false);
    } catch {
      // 表单校验失败，无需处理
    }
  }, [activeIssueId, onAssign, assignForm, message]);

  // 构建操作菜单
  const buildActionItems = useCallback(
    (record: BcfIssue): MenuProps["items"] => {
      const items: MenuProps["items"] = [
        { key: "view", label: "查看详情" },
        {
          key: "assign",
          label: "指派处理人",
          onClick: () => handleOpenAssign(record.id),
        },
        { type: "divider" },
      ];

      // 根据当前状态提供可切换的目标状态
      const transitions: {
        key: string;
        label: string;
        status: BcfIssueStatus;
      }[] = [];
      if (record.status === "open") {
        transitions.push({
          key: "in_progress",
          label: "开始处理",
          status: "in_progress",
        });
      }
      if (record.status === "in_progress") {
        transitions.push({
          key: "resolved",
          label: "标记已解决",
          status: "resolved",
        });
      }
      if (record.status === "resolved") {
        transitions.push({
          key: "closed",
          label: "关闭问题",
          status: "closed",
        });
        transitions.push({ key: "open", label: "重新打开", status: "open" });
      }
      if (record.status === "closed") {
        transitions.push({ key: "open", label: "重新打开", status: "open" });
      }

      for (const t of transitions) {
        items.push({
          key: t.key,
          label: t.label,
          onClick: () => onStatusChange?.(record.id, t.status),
        });
      }

      return items;
    },
    [onStatusChange, handleOpenAssign],
  );

  const columns: ColumnsType<BcfIssue> = [
    {
      title: "ID",
      dataIndex: "issueIndex",
      key: "issueIndex",
      width: 60,
      render: (idx: number) => <Tag>#{idx}</Tag>,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      width: 200,
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (priority: BcfIssuePriority) => {
        const config = getPriorityConfig(priority);
        const isKnown = isKnownPriority(priority);
        if (isKnown || !priority) {
          return <Tag color={config.color}>{config.label}</Tag>;
        }
        return (
          <Tooltip title={`未知优先级：${priority}`}>
            <Tag color={config.color}>{config.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: BcfIssueStatus, record) => (
        <Select<BcfIssueStatus>
          value={status}
          size="small"
          style={{ width: 120 }}
          options={STATUS_OPTIONS}
          onChange={(value) => onStatusChange?.(record.id, value)}
          aria-label={`变更状态 - ${record.title}`}
        />
      ),
    },
    {
      title: "指派",
      dataIndex: "assignedTo",
      key: "assignedTo",
      width: 120,
      render: (assignedTo: string | null, record) => (
        <Button
          type="link"
          size="small"
          icon={<UserOutlined />}
          onClick={() => handleOpenAssign(record.id)}
          aria-label={assignedTo ? `指派给 ${assignedTo}` : "未指派"}
        >
          {assignedTo ?? "未指派"}
        </Button>
      ),
    },
    {
      title: "类型",
      dataIndex: "issueType",
      key: "issueType",
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: "发起人",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 100,
      ellipsis: true,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (iso: string) => {
        try {
          return new Date(iso).toLocaleString(undefined, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return iso;
        }
      },
    },
    {
      title: "操作",
      key: "action",
      width: 60,
      align: "center",
      render: (_: unknown, record: BcfIssue) => (
        <Dropdown menu={{ items: buildActionItems(record) }}>
          <MoreOutlined style={{ cursor: "pointer" }} aria-label="更多操作" />
        </Dropdown>
      ),
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <Spin />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Empty description="暂无协调问题" />;
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 1000 }}
      />

      {/* 指派弹窗 */}
      <Modal
        title="指派处理人"
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={handleAssignSubmit}
        okText="确认指派"
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="assignee"
            label="处理人"
            rules={[{ required: true, message: "请输入处理人姓名" }]}
          >
            <Input placeholder="输入处理人姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
