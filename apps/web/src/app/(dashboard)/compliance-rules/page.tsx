"use client";

import { Card, Table, Tag, Button, Space, Typography, Modal, Form, Input, Select, Spin, Alert, Popconfirm, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, ImportOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 合规规则 DTO */
interface ComplianceRuleDto {
  id: string;
  tenantId: string;
  ruleCode: string;
  name: string;
  category: string;
  owner?: string;
  status: string;
  description?: string;
  basis?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  rowVersion: number;
}

/** 创建规则请求 */
interface CreateRuleRequest {
  ruleCode: string;
  name: string;
  category: string;
  description?: string;
}

/** 更新规则请求 */
interface UpdateRuleRequest {
  name?: string;
  description?: string;
}

/** 规则状态标签配置 */
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "default" },
  ACTIVE: { label: "启用", color: "success" },
  DEPRECATED: { label: "废弃", color: "warning" },
  ARCHIVED: { label: "归档", color: "default" },
};

/** 规则类别选项 */
const CATEGORY_OPTIONS = [
  { value: "BUILDING_CODE", label: "建筑规范" },
  { value: "FIRE_SAFETY", label: "消防规范" },
  { value: "ACCESSIBILITY", label: "无障碍规范" },
  { value: "ENERGY", label: "节能规范" },
  { value: "STRUCTURE", label: "结构规范" },
  { value: "MEP", label: "机电规范" },
  { value: "ZONING", label: "规划规范" },
];

/**
 * 查询规则列表
 */
function useRules(params: { page: number; pageSize: number; category?: string; status?: string }) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.category) query.set("category", params.category);
  if (params.status) query.set("status", params.status);

  return useQuery<{ items: ComplianceRuleDto[]; total: number }>({
    queryKey: ["compliance-rules", params],
    queryFn: () => apiGet(`/api/v1/compliance-rules?${query.toString()}`),
  });
}

/** 创建规则 */
function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRuleRequest) => apiPost("/api/v1/compliance-rules", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-rules"] }),
  });
}

/** 更新规则 */
function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRuleRequest }) =>
      apiPatch(`/api/v1/compliance-rules/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-rules"] }),
  });
}

/** 删除规则 */
function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/compliance-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-rules"] }),
  });
}

export default function ComplianceRulesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ComplianceRuleDto | null>(null);
  const [form] = Form.useForm<CreateRuleRequest>();
  const [editForm] = Form.useForm<UpdateRuleRequest>();
  const [importForm] = Form.useForm<{ xmlContent: string }>();

  const { data, isLoading, error } = useRules({ page, pageSize, category: categoryFilter, status: statusFilter });
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();

  const handleCreate = (values: CreateRuleRequest) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success("规则创建成功");
        setModalVisible(false);
        form.resetFields();
      },
      onError: (err: Error) => message.error(`创建失败: ${err.message}`),
    });
  };

  const handleUpdate = (values: UpdateRuleRequest) => {
    if (selectedRule) {
      updateMutation.mutate(
        { id: selectedRule.id, data: values },
        {
          onSuccess: () => {
            message.success("规则更新成功");
            setEditModalVisible(false);
            setSelectedRule(null);
            editForm.resetFields();
          },
          onError: (err: Error) => message.error(`更新失败: ${err.message}`),
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success("规则已删除"),
      onError: (err: Error) => message.error(`删除失败: ${err.message}`),
    });
  };

  const columns = [
    { title: "规则编码", dataIndex: "ruleCode", key: "ruleCode", width: 150 },
    { title: "名称", dataIndex: "name", key: "name", ellipsis: true },
    {
      title: "类别",
      dataIndex: "category",
      key: "category",
      width: 120,
      render: (cat: string) => {
        const opt = CATEGORY_OPTIONS.find((o) => o.value === cat);
        return opt ? <Tag>{opt.label}</Tag> : <Tag>{cat}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: string) => {
        const config = STATUS_CONFIG[status] ?? { label: status, color: "default" };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, record: ComplianceRuleDto) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedRule(record);
              editForm.setFieldsValue({ name: record.name, description: record.description });
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => {
              // 跳转到版本管理页（后续可扩展）
              message.info(`规则 ${record.ruleCode} 的版本管理功能开发中`);
            }}
          >
            版本
          </Button>
          <Popconfirm
            title="确认删除此规则？"
            description="删除后不可恢复，已关联的检查记录将保留。"
            onConfirm={() => handleDelete(record.id)}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return <Alert type="error" message="加载失败" description={(error as Error).message} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4}>合规规则管理</Title>
        <Space>
          <Button
            icon={<ImportOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            导入 IDS
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            创建规则
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="按类别筛选"
            allowClear
            style={{ width: 150 }}
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(v) => { setCategoryFilter(v); setPage(1); }}
          />
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 120 }}
            options={Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }))}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
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
              onChange: (p, s) => { setPage(p); setPageSize(s); },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条规则`,
            }}
            bordered
          />
        </Spin>
      </Card>

      {/* 创建规则弹窗 */}
      <Modal
        title="创建合规规则"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ category: "BUILDING_CODE" }}
        >
          <Form.Item name="ruleCode" label="规则编码" rules={[{ required: true, message: "请输入规则编码" }]}>
            <Input placeholder="如 BC-FIRE-001" maxLength={100} />
          </Form.Item>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="如 防火分区面积校验" maxLength={255} />
          </Form.Item>
          <Form.Item name="category" label="规则类别" rules={[{ required: true, message: "请选择类别" }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="规则描述与适用范围" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑规则弹窗 */}
      <Modal
        title="编辑合规规则"
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setSelectedRule(null); editForm.resetFields(); }}
        footer={null}
      >
        {selectedRule && (
          <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
            <Form.Item label="规则编码">
              <Input value={selectedRule.ruleCode} disabled />
            </Form.Item>
            <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea maxLength={2000} showCount />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button onClick={() => setEditModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                  保存
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 导入 IDS 弹窗 */}
      <Modal
        title="导入 buildingSMART IDS 规则"
        open={importModalVisible}
        onCancel={() => { setImportModalVisible(false); importForm.resetFields(); }}
        footer={null}
        width={640}
      >
        <Text type="secondary">
          粘贴 IDS 1.0 XML 内容，系统将解析并自动创建对应规则。
        </Text>
        <Form form={importForm} layout="vertical" onFinish={(v) => {
          apiPost("/api/v1/compliance-rules/import-ids", v).then(() => {
            message.success("IDS 导入成功");
            setImportModalVisible(false);
            importForm.resetFields();
            window.location.reload();
          }).catch((err: Error) => message.error(`导入失败: ${err.message}`));
        }} style={{ marginTop: 16 }}>
          <Form.Item name="xmlContent" label="IDS XML 内容" rules={[{ required: true, message: "请粘贴 IDS XML" }]}>
            <Input.TextArea rows={10} placeholder="<?xml version='1.0' encoding='UTF-8'?>..." />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setImportModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">解析并导入</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
