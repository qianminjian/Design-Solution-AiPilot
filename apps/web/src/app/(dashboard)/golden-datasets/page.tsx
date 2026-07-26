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
} from "antd";
import {
  PlusOutlined,
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { z } from "zod";
import type {
  GoldenDatasetDto,
  CreateGoldenDatasetRequest,
  DatasetCategory,
  DatasetStatus,
} from "@design-platform/shared";
import {
  TEVV_API_PATHS,
  goldenDatasetDtoSchema,
} from "@design-platform/shared";

const { Title } = Typography;

/** 分类显示映射（含兜底，避免未知枚举值渲染崩溃） */
const CATEGORY_LABELS: Partial<Record<DatasetCategory, string>> = {
  ARCHITECTURE: "建筑",
  STRUCTURE: "结构",
  MEP: "机电",
  INTERIOR: "室内",
  LANDSCAPE: "景观",
};

/** 状态标签配置（含兜底） */
const STATUS_CONFIG: Partial<
  Record<DatasetStatus, { label: string; color: string; icon: React.ReactNode }>
> = {
  DRAFT: { label: "草稿", color: "default", icon: <CloseCircleOutlined /> },
  FROZEN: { label: "已冻结", color: "success", icon: <LockOutlined /> },
  DEPRECATED: {
    label: "已废弃",
    color: "error",
    icon: <CloseCircleOutlined />,
  },
};

/** 建筑类型选项 */
const BUILDING_TYPE_OPTIONS = [
  { value: "OFFICE_SMALL", label: "小型办公（5-8层）" },
  { value: "OFFICE_MEDIUM", label: "中型办公（9-12层）" },
  { value: "OFFICE_LARGE", label: "大型办公（13-15层）" },
];

/** 分类选项（与 shared DatasetCategory 枚举对齐） */
const CATEGORY_OPTIONS: { value: DatasetCategory; label: string }[] = [
  { value: "ARCHITECTURE", label: "建筑" },
  { value: "STRUCTURE", label: "结构" },
  { value: "MEP", label: "机电" },
  { value: "INTERIOR", label: "室内" },
  { value: "LANDSCAPE", label: "景观" },
];

/**
 * 查询数据集列表
 *
 * 契约验证：软验证模式
 *  - 数据集列表结构错误不阻断展示，console.warn 记录便于排查
 *  - 后端返回未知 category/status 枚举值时由 UI 兜底显示
 */
function useDatasets() {
  return useQuery<GoldenDatasetDto[]>({
    queryKey: ["golden-datasets"],
    queryFn: () =>
      apiGet<GoldenDatasetDto[]>(TEVV_API_PATHS.DATASETS, {
        validate: {
          schema: z.array(goldenDatasetDtoSchema),
          context: "golden-datasets.list",
        },
      }),
  });
}

/**
 * 创建数据集
 *
 * 契约验证：软验证模式（请求体由前端表单校验保证）
 *  - 创建响应结构错误不阻断，console.warn 记录便于排查
 */
function useCreateDataset() {
  const queryClient = useQueryClient();
  return useMutation<GoldenDatasetDto, Error, CreateGoldenDatasetRequest>({
    mutationFn: (data) =>
      apiPost<GoldenDatasetDto>(TEVV_API_PATHS.DATASETS, data, {
        validate: {
          schema: goldenDatasetDtoSchema,
          context: "golden-datasets.create",
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["golden-datasets"] }),
  });
}

/**
 * 冻结数据集
 *
 * 契约验证：软验证模式
 *  - 冻结响应结构错误不阻断，console.warn 记录便于排查
 */
function useFreezeDataset() {
  const queryClient = useQueryClient();
  return useMutation<GoldenDatasetDto, Error, string>({
    mutationFn: (datasetId) =>
      apiPost<GoldenDatasetDto>(
        TEVV_API_PATHS.DATASET_FREEZE(datasetId),
        {},
        {
          validate: {
            schema: goldenDatasetDtoSchema,
            context: "golden-datasets.freeze",
          },
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["golden-datasets"] }),
  });
}

export default function GoldenDatasetsPage() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<CreateGoldenDatasetRequest>();

  const { data: datasets, isLoading, error } = useDatasets();
  const createMutation = useCreateDataset();
  const freezeMutation = useFreezeDataset();

  const handleCreate = (values: CreateGoldenDatasetRequest) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        setModalVisible(false);
        form.resetFields();
      },
    });
  };

  const handleFreeze = (datasetId: string) => {
    freezeMutation.mutate(datasetId);
  };

  if (isLoading) {
    return <Spin tip="加载数据集..." />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        description={(error as Error).message}
      />
    );
  }

  const columns = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 200,
      ellipsis: true,
    },
    {
      title: "分类",
      dataIndex: "category",
      key: "category",
      width: 80,
      // 兜底：未知枚举值显示原始值，避免渲染崩溃
      render: (category: DatasetCategory) => (
        <Tag>{CATEGORY_LABELS[category] ?? category}</Tag>
      ),
    },
    {
      title: "建筑类型",
      dataIndex: "buildingType",
      key: "buildingType",
      width: 120,
      render: (type: string) =>
        BUILDING_TYPE_OPTIONS.find((o) => o.value === type)?.label || type,
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 70,
    },
    {
      title: "文件数",
      dataIndex: "fileCount",
      key: "fileCount",
      width: 70,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      // 兜底：未知状态枚举值显示原始值
      render: (status: DatasetStatus) => {
        const config = STATUS_CONFIG[status];
        if (!config) {
          return <Tag>{status}</Tag>;
        }
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, record: GoldenDatasetDto) => (
        <Space>
          <Button
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => router.push(`/golden-datasets/${record.id}`)}
          >
            验证项
          </Button>
          {record.status === "DRAFT" && (
            <Button
              type="primary"
              size="small"
              icon={<LockOutlined />}
              loading={
                freezeMutation.isPending &&
                freezeMutation.variables === record.id
              }
              onClick={() => handleFreeze(record.id)}
            >
              冻结
            </Button>
          )}
          {record.status === "FROZEN" && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              已冻结
            </Tag>
          )}
        </Space>
      ),
    },
  ];

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
        <Title level={4}>金样数据集管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          loading={createMutation.isPending}
        >
          创建数据集
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={datasets}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>

      <Modal
        title="创建金样数据集"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            category: "ARCHITECTURE",
            buildingType: "OFFICE_MEDIUM",
          }}
        >
          <Form.Item
            name="name"
            label="数据集名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="如：办公楼金样 v1" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="数据集描述" />
          </Form.Item>

          <Form.Item
            name="category"
            label="专业分类"
            rules={[{ required: true, message: "请选择分类" }]}
          >
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="buildingType"
            label="建筑类型"
            rules={[{ required: true, message: "请选择建筑类型" }]}
          >
            <Select options={BUILDING_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="storageKey"
            label="存储路径"
            rules={[{ required: true, message: "请输入存储路径" }]}
          >
            <Input placeholder="如：golden-datasets/office-medium-001" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
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
    </div>
  );
}
