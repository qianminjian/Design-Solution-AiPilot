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
  Alert,
  Popconfirm,
  App,
  Descriptions,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  ImportOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import type {
  ComplianceRuleDto,
  RuleRevisionDto,
  CreateRuleRequest,
  CreateRuleRevisionRequest,
  IdsImportRequest,
} from "@design-platform/shared";
import {
  RULE_STATUS_LABEL,
  RULE_STATUS_TAG_COLOR,
} from "@design-platform/shared";
import {
  useComplianceRules,
  useCreateComplianceRule,
  useUpdateComplianceRule,
  useDeleteComplianceRule,
  useRuleRevisions,
  useCreateRuleRevision,
  useActivateRuleRevision,
  useImportIds,
  type UpdateRuleRequest,
} from "@/hooks/use-compliance";

const { Title, Text, Paragraph } = Typography;

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

/** 规则状态选项（用于筛选） */
const STATUS_OPTIONS = Object.entries(RULE_STATUS_LABEL).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

/** 修订状态标签配置 */
const REVISION_STATUS_CONFIG: Record<string, { label: string; color: string }> =
  {
    DRAFT: { label: "草稿", color: "default" },
    ACTIVE: { label: "已激活", color: "success" },
    SUPERSEDED: { label: "已替代", color: "default" },
    ARCHIVED: { label: "已归档", color: "default" },
  };

export default function ComplianceRulesPage() {
  const { message } = App.useApp();

  // 列表查询参数
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 弹窗状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [revisionsModalVisible, setRevisionsModalVisible] = useState(false);
  const [revisionCreateModalVisible, setRevisionCreateModalVisible] =
    useState(false);
  const [selectedRule, setSelectedRule] = useState<ComplianceRuleDto | null>(
    null,
  );

  // 表单
  const [createForm] = Form.useForm<CreateRuleRequest>();
  const [editForm] = Form.useForm<UpdateRuleRequest>();
  const [importForm] = Form.useForm<IdsImportRequest>();
  const [revisionForm] = Form.useForm<CreateRuleRevisionRequest>();

  // 数据查询与变更
  const { data, isLoading, error } = useComplianceRules({
    page,
    pageSize,
    category: categoryFilter,
    status: statusFilter,
  });
  const createMutation = useCreateComplianceRule();
  const updateMutation = useUpdateComplianceRule();
  const deleteMutation = useDeleteComplianceRule();
  const importMutation = useImportIds();

  // 规则修订
  const { data: revisionsData, isLoading: revisionsLoading } = useRuleRevisions(
    selectedRule?.id ?? null,
    { page: 1, pageSize: 50, order: "desc" },
  );
  const createRevisionMutation = useCreateRuleRevision(selectedRule?.id ?? "");
  const activateRevisionMutation = useActivateRuleRevision();

  const handleCreate = (values: CreateRuleRequest) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success("规则创建成功");
        setCreateModalVisible(false);
        createForm.resetFields();
      },
      onError: (err: Error) => message.error(`创建失败: ${err.message}`),
    });
  };

  const handleUpdate = (values: UpdateRuleRequest) => {
    if (!selectedRule) return;
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
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success("规则已删除"),
      onError: (err: Error) => message.error(`删除失败: ${err.message}`),
    });
  };

  const handleImportIds = (values: IdsImportRequest) => {
    importMutation.mutate(values, {
      onSuccess: (resp) => {
        message.success(
          `IDS 导入完成：成功 ${resp.importedCount} 条，失败 ${resp.failedCount} 条`,
        );
        if (resp.errors.length > 0) {
          message.warning(
            `失败详情：${resp.errors.slice(0, 3).join("; ")}${resp.errors.length > 3 ? "..." : ""}`,
          );
        }
        setImportModalVisible(false);
        importForm.resetFields();
      },
      onError: (err: Error) => message.error(`导入失败: ${err.message}`),
    });
  };

  const handleCreateRevision = (values: CreateRuleRevisionRequest) => {
    if (!selectedRule) return;
    createRevisionMutation.mutate(values, {
      onSuccess: () => {
        message.success("规则修订已创建");
        setRevisionCreateModalVisible(false);
        revisionForm.resetFields();
      },
      onError: (err: Error) => message.error(`创建修订失败: ${err.message}`),
    });
  };

  const handleActivateRevision = (revisionId: string) => {
    activateRevisionMutation.mutate(revisionId, {
      onSuccess: () => message.success("规则修订已激活"),
      onError: (err: Error) => message.error(`激活失败: ${err.message}`),
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
      width: 90,
      render: (status: string) => {
        const label = RULE_STATUS_LABEL[status] ?? status;
        const color = RULE_STATUS_TAG_COLOR[status] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "负责人",
      dataIndex: "owner",
      key: "owner",
      width: 120,
      render: (owner?: string | null) => owner || "-",
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      render: (_: unknown, record: ComplianceRuleDto) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedRule(record);
              editForm.setFieldsValue({
                name: record.name,
                description: record.description ?? undefined,
              });
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => {
              setSelectedRule(record);
              setRevisionsModalVisible(true);
            }}
          >
            修订
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
    return (
      <Alert
        type="error"
        message="加载失败"
        description={(error as Error).message}
      />
    );
  }

  const revisions = revisionsData?.items ?? [];

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
            onClick={() => setCreateModalVisible(true)}
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
            onChange={(v) => {
              setCategoryFilter(v);
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
              showTotal: (total) => `共 ${total} 条规则`,
            }}
            bordered
          />
        </Spin>
      </Card>

      {/* 创建规则弹窗 */}
      <Modal
        title="创建合规规则"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ category: "BUILDING_CODE" }}
        >
          <Form.Item
            name="ruleCode"
            label="规则编码"
            rules={[{ required: true, message: "请输入规则编码" }]}
          >
            <Input placeholder="如 BC-FIRE-001" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: "请输入规则名称" }]}
          >
            <Input placeholder="如 防火分区面积校验" maxLength={255} />
          </Form.Item>
          <Form.Item
            name="category"
            label="规则类别"
            rules={[{ required: true, message: "请选择类别" }]}
          >
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="owner" label="负责人（可选）">
            <Input placeholder="如 张工" maxLength={64} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea
              placeholder="规则描述与适用范围"
              maxLength={2000}
              showCount
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
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
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedRule(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        {selectedRule && (
          <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
            <Form.Item label="规则编码">
              <Input value={selectedRule.ruleCode} disabled />
            </Form.Item>
            <Form.Item
              name="name"
              label="规则名称"
              rules={[{ required: true, message: "请输入规则名称" }]}
            >
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea maxLength={2000} showCount />
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

      {/* 导入 IDS 弹窗 */}
      <Modal
        title="导入 buildingSMART IDS 规则"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          importForm.resetFields();
        }}
        footer={null}
        width={640}
      >
        <Paragraph type="secondary">
          粘贴 IDS 1.0 XML 内容，系统将解析并自动创建对应规则。
        </Paragraph>
        <Form
          form={importForm}
          layout="vertical"
          onFinish={handleImportIds}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="xmlContent"
            label="IDS XML 内容"
            rules={[{ required: true, message: "请粘贴 IDS XML" }]}
          >
            <Input.TextArea
              rows={10}
              placeholder="<?xml version='1.0' encoding='UTF-8'?>..."
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setImportModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={importMutation.isPending}
              >
                解析并导入
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则修订管理弹窗 */}
      <Modal
        title={`规则修订管理 - ${selectedRule?.ruleCode ?? ""}`}
        open={revisionsModalVisible}
        onCancel={() => {
          setRevisionsModalVisible(false);
          setSelectedRule(null);
        }}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setRevisionCreateModalVisible(true)}
            >
              新建修订
            </Button>
            <Button
              onClick={() => {
                setRevisionsModalVisible(false);
                setSelectedRule(null);
              }}
            >
              关闭
            </Button>
          </Space>
        }
        width={900}
      >
        {selectedRule && (
          <>
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="规则编码">
                {selectedRule.ruleCode}
              </Descriptions.Item>
              <Descriptions.Item label="名称">
                {selectedRule.name}
              </Descriptions.Item>
              <Descriptions.Item label="类别" span={2}>
                {CATEGORY_OPTIONS.find((o) => o.value === selectedRule.category)
                  ?.label ?? selectedRule.category}
              </Descriptions.Item>
            </Descriptions>

            <Table
              size="small"
              loading={revisionsLoading}
              dataSource={revisions}
              rowKey="id"
              pagination={false}
              bordered
              columns={[
                {
                  title: "修订号",
                  dataIndex: "revisionNo",
                  key: "revisionNo",
                  width: 80,
                  render: (n: number) => <Text code>v{n}</Text>,
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  key: "status",
                  width: 100,
                  render: (status: string) => {
                    const config = REVISION_STATUS_CONFIG[status] ?? {
                      label: status,
                      color: "default",
                    };
                    return <Tag color={config.color}>{config.label}</Tag>;
                  },
                },
                {
                  title: "引擎配置",
                  dataIndex: "engineProfile",
                  key: "engineProfile",
                  width: 120,
                  render: (p?: string | null) => p || "-",
                },
                {
                  title: "依据",
                  dataIndex: "basis",
                  key: "basis",
                  ellipsis: true,
                  render: (b?: string | null) => b || "-",
                },
                {
                  title: "创建时间",
                  dataIndex: "createdAt",
                  key: "createdAt",
                  width: 150,
                  render: (date: string) =>
                    new Date(date).toLocaleString("zh-CN"),
                },
                {
                  title: "操作",
                  key: "actions",
                  width: 120,
                  render: (_: unknown, record: RuleRevisionDto) =>
                    record.status === "DRAFT" ? (
                      <Popconfirm
                        title="确认激活此修订？"
                        description="激活后原激活修订将被替代。"
                        onConfirm={() => handleActivateRevision(record.id)}
                        okText="激活"
                        cancelText="取消"
                      >
                        <Button
                          size="small"
                          type="link"
                          icon={<CheckCircleOutlined />}
                          loading={
                            activateRevisionMutation.isPending &&
                            activateRevisionMutation.variables === record.id
                          }
                        >
                          激活
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                },
              ]}
            />
          </>
        )}
      </Modal>

      {/* 新建规则修订弹窗 */}
      <Modal
        title="新建规则修订"
        open={revisionCreateModalVisible}
        onCancel={() => {
          setRevisionCreateModalVisible(false);
          revisionForm.resetFields();
        }}
        footer={null}
        width={680}
      >
        <Form
          form={revisionForm}
          layout="vertical"
          onFinish={handleCreateRevision}
        >
          <Paragraph type="secondary">
            修订创建后默认进入草稿态，需手动激活后生效。
          </Paragraph>
          <Form.Item name="engineProfile" label="引擎配置（可选）">
            <Select
              allowClear
              placeholder="选择规则引擎 profile"
              options={[
                { value: "DEFAULT", label: "默认" },
                { value: "STRICT", label: "严格" },
                { value: "LENIENT", label: "宽松" },
              ]}
            />
          </Form.Item>
          <Form.Item name="basis" label="依据（可选）">
            <Input placeholder="如 GB 50016-2014 第 5.3.1 条" maxLength={255} />
          </Form.Item>
          <Form.Item name="dslJson" label="DSL JSON（可选）">
            <Input.TextArea
              rows={6}
              placeholder='{"rule":"...","predicate":"..."}'
            />
          </Form.Item>
          <Form.Item name="parametersJson" label="参数 JSON（可选）">
            <Input.TextArea rows={4} placeholder='{"threshold":0.8}' />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setRevisionCreateModalVisible(false)}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createRevisionMutation.isPending}
              >
                创建修订
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
