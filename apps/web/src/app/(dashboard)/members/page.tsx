"use client";

import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Popconfirm,
  App,
  Tooltip,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { MembershipDto, MembershipStatus } from "@design-platform/shared";
import {
  useMemberships,
  useCreateMembership,
  useUpdateMembership,
  useDeleteMembership,
  usePrincipals,
  useOrganizations,
} from "@/hooks/use-iam";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

/** 成员状态标签配置（未知值降级显示"未知"灰标签 + 原值 tooltip） */
const MEMBERSHIP_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  active: { label: "在职", color: "success" },
  suspended: { label: "暂停", color: "warning" },
  expired: { label: "已过期", color: "default" },
};

/** 成员状态选项（用于筛选/编辑） */
const STATUS_OPTIONS = Object.entries(MEMBERSHIP_STATUS_CONFIG).map(
  ([value, config]) => ({ value, label: config.label }),
);

/** 角色选项（V1 内置角色，后续可改为从后端拉取） */
const ROLE_OPTIONS = [
  { value: "owner", label: "项目负责人" },
  { value: "architect", label: "建筑师" },
  { value: "engineer", label: "工程师" },
  { value: "reviewer", label: "审阅人" },
  { value: "observer", label: "观察者" },
];

/** 角色标签字典 */
const ROLE_LABEL: Record<string, string> = ROLE_OPTIONS.reduce(
  (acc, { value, label }) => {
    acc[value] = label;
    return acc;
  },
  {} as Record<string, string>,
);

/** 截断 UUID 显示（保留前 8 位 + 省略号） */
function truncateUuid(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…` : id;
}

export default function MembersPage() {
  const { message } = App.useApp();

  // 列表查询参数
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 弹窗状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedMembership, setSelectedMembership] =
    useState<MembershipDto | null>(null);

  // 表单
  const [createForm] = Form.useForm<{
    principalId: string;
    organizationId: string;
    role: string;
  }>();
  const [editForm] = Form.useForm<{
    role: string;
    status: MembershipStatus;
  }>();

  // 数据查询与变更
  const { data, isLoading, error } = useMemberships({
    page,
    pageSize,
    role: roleFilter,
    status: statusFilter as MembershipStatus | undefined,
  });
  const createMutation = useCreateMembership();
  const updateMutation = useUpdateMembership();
  const deleteMutation = useDeleteMembership();

  // 创建成员时需要选择主体和组织
  const { data: principalsData, isLoading: principalsLoading } = usePrincipals({
    page: 1,
    pageSize: 100,
  });
  const { data: organizationsData, isLoading: organizationsLoading } =
    useOrganizations({ page: 1, pageSize: 50 });

  const handleCreate = (values: {
    principalId: string;
    organizationId: string;
    role: string;
  }) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success("成员添加成功");
        setCreateModalVisible(false);
        createForm.resetFields();
      },
      onError: (err: Error) => message.error(`添加失败: ${err.message}`),
    });
  };

  const handleUpdate = (values: { role: string; status: MembershipStatus }) => {
    if (!selectedMembership) return;
    updateMutation.mutate(
      {
        id: selectedMembership.id,
        rowVersion: selectedMembership.rowVersion,
        payload: values,
      },
      {
        onSuccess: () => {
          message.success("成员更新成功");
          setEditModalVisible(false);
          setSelectedMembership(null);
          editForm.resetFields();
        },
        onError: (err: Error) => message.error(`更新失败: ${err.message}`),
      },
    );
  };

  const handleDelete = (record: MembershipDto) => {
    deleteMutation.mutate(
      { id: record.id, rowVersion: record.rowVersion },
      {
        onSuccess: () => message.success("成员已移除"),
        onError: (err: Error) => message.error(`移除失败: ${err.message}`),
      },
    );
  };

  const columns = [
    {
      title: "主体 ID",
      dataIndex: "principalId",
      key: "principalId",
      width: 130,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code>{truncateUuid(id)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "组织 ID",
      dataIndex: "organizationId",
      key: "organizationId",
      width: 130,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code>{truncateUuid(id)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      width: 130,
      render: (role: string) => {
        const label = ROLE_LABEL[role];
        if (!label) {
          // 未知枚举值兜底：显示"未知"灰标签 + 原值 tooltip
          return (
            <Tooltip title={role}>
              <Tag color="default">未知</Tag>
            </Tooltip>
          );
        }
        return <Tag color="blue">{label}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const config = MEMBERSHIP_STATUS_CONFIG[status];
        if (!config) {
          return (
            <Tooltip title={status}>
              <Tag color="default">未知</Tag>
            </Tooltip>
          );
        }
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "加入时间",
      dataIndex: "joinedAt",
      key: "joinedAt",
      width: 160,
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_: unknown, record: MembershipDto) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedMembership(record);
              editForm.setFieldsValue({
                role: record.role,
                status: record.status,
              });
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认移除此成员？"
            description="移除后该主体将不再属于此组织，可重新添加。"
            onConfirm={() => handleDelete(record)}
            okText="确认移除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return <DataErrorAlert error={error} context="成员列表" />;
  }

  const principalOptions = (principalsData?.items ?? []).map((p) => ({
    value: p.id,
    label: `${p.displayName} (${p.email})`,
  }));

  const organizationOptions = (organizationsData?.items ?? []).map((o) => ({
    value: o.id,
    label: o.name,
  }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4}>成员管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          添加成员
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="按角色筛选"
            allowClear
            style={{ width: 150 }}
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
          />
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 120 }}
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card>
        <Spin spinning={isLoading}>
          <Table
            columns={columns}
            dataSource={data?.items}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total: data?.total ?? 0,
              onChange: (p, s) => {
                setPage(p);
                setPageSize(s);
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条成员关系`,
            }}
            bordered
          />
        </Spin>
      </Card>

      {/* 添加成员弹窗 */}
      <Modal
        title="添加成员"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ role: "observer" }}
        >
          <Form.Item
            name="principalId"
            label="主体"
            rules={[{ required: true, message: "请选择主体" }]}
          >
            <Select
              showSearch
              placeholder="选择主体（用户/服务）"
              options={principalOptions}
              loading={principalsLoading}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toString()
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="organizationId"
            label="组织"
            rules={[{ required: true, message: "请选择组织" }]}
          >
            <Select
              showSearch
              placeholder="选择目标组织"
              options={organizationOptions}
              loading={organizationsLoading}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toString()
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: "请选择角色" }]}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑成员角色/状态弹窗 */}
      <Modal
        title="编辑成员"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedMembership(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        {selectedMembership && (
          <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
            <Form.Item label="主体 ID">
              <Input value={selectedMembership.principalId} disabled />
            </Form.Item>
            <Form.Item label="组织 ID">
              <Input value={selectedMembership.organizationId} disabled />
            </Form.Item>
            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: "请选择角色" }]}
            >
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: "请选择状态" }]}
            >
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button onClick={() => setEditModalVisible(false)}>取消</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={updateMutation.isPending}
                >
                  保存
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
