"use client";

import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Alert,
  Breadcrumb,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { z } from "zod";
import type {
  VerificationItemDto,
  CreateVerificationItemRequest,
  VerificationStatus,
  VerificationType,
  RiskLevel,
} from "@design-platform/shared";
import {
  TEVV_API_PATHS,
  verificationItemDtoSchema,
} from "@design-platform/shared";
import {
  RISK_OPTIONS,
  TYPE_OPTIONS,
} from "@/components/verification/verification-config";
import {
  RiskLevelBadge,
  VerificationStatusBadge,
  VerificationTypeBadge,
} from "@/components/verification/verification-badge";

const { Title, Text } = Typography;

/** Gate 代码选项（根据 D05 阶段门） */
const GATE_CODE_OPTIONS = [
  { value: "GATE-P1", label: "GATE-P1 方案准入" },
  { value: "GATE-P2", label: "GATE-P2 扩初准入" },
  { value: "GATE-P5", label: "GATE-P5 施工图交付" },
  { value: "GATE-P6", label: "GATE-P6 审批通过" },
  { value: "GATE-P7", label: "GATE-P7 归档完成" },
];

/**
 * 查询验证项列表
 *
 * 契约验证：软验证模式
 *  - 验证项列表结构错误不阻断展示，console.warn 记录便于排查
 *  - 后端返回未知 riskLevel/status/type 枚举值时由 Badge 组件兜底显示
 */
function useVerificationItems(datasetId: string) {
  return useQuery<VerificationItemDto[]>({
    queryKey: ["verification-items", datasetId],
    queryFn: () =>
      apiGet<VerificationItemDto[]>(
        `${TEVV_API_PATHS.VERIFICATION_ITEMS}?datasetId=${datasetId}`,
        {
          validate: {
            schema: z.array(verificationItemDtoSchema),
            context: "verification-items.list",
          },
        },
      ),
    enabled: !!datasetId,
  });
}

/**
 * 创建验证项
 *
 * 契约验证：软验证模式
 *  - 创建响应结构错误不阻断，console.warn 记录便于排查
 *  - 请求体由前端表单校验保证
 */
function useCreateVerificationItem() {
  const queryClient = useQueryClient();
  return useMutation<
    VerificationItemDto,
    Error,
    { datasetId: string; data: CreateVerificationItemRequest }
  >({
    mutationFn: ({ datasetId, data }) =>
      apiPost<VerificationItemDto>(
        TEVV_API_PATHS.VERIFICATION_ITEMS,
        { ...data, datasetId },
        {
          validate: {
            schema: verificationItemDtoSchema,
            context: "verification-items.create",
          },
        },
      ),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["verification-items", variables.datasetId],
      }),
  });
}

/**
 * 更新验证状态
 *
 * 契约验证：无（返回 void）
 *  - 状态更新走 query string，无响应体需要验证
 */
function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { itemId: string; status: VerificationStatus; waiverReason?: string }
  >({
    mutationFn: ({ itemId, status, waiverReason }) =>
      apiPatch<void>(
        `${TEVV_API_PATHS.ITEM_STATUS(itemId)}?status=${status}${waiverReason ? `&waiverReason=${encodeURIComponent(waiverReason)}` : ""}`,
        {},
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["verification-items"] }),
  });
}

export default function VerificationItemsPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = params.id as string;

  const [modalVisible, setModalVisible] = useState(false);
  const [waiveModalVisible, setWaiveModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VerificationItemDto | null>(
    null,
  );
  const [form] = Form.useForm<CreateVerificationItemRequest>();
  const [waiveForm] = Form.useForm<{ reason: string }>();

  const { data: items, isLoading, error } = useVerificationItems(datasetId);
  const createMutation = useCreateVerificationItem();
  const updateStatusMutation = useUpdateStatus();

  const handleCreate = (values: CreateVerificationItemRequest) => {
    createMutation.mutate(
      { datasetId, data: values },
      {
        onSuccess: () => {
          setModalVisible(false);
          form.resetFields();
        },
      },
    );
  };

  const handleUpdateStatus = (itemId: string, status: VerificationStatus) => {
    if (status === "WAIVED") {
      setSelectedItem(items?.find((i) => i.id === itemId) ?? null);
      setWaiveModalVisible(true);
      return;
    }
    updateStatusMutation.mutate({ itemId, status });
  };

  const handleWaive = (values: { reason: string }) => {
    if (selectedItem) {
      updateStatusMutation.mutate(
        {
          itemId: selectedItem.id,
          status: "WAIVED",
          waiverReason: values.reason,
        },
        {
          onSuccess: () => {
            setWaiveModalVisible(false);
            setSelectedItem(null);
            waiveForm.resetFields();
          },
        },
      );
    }
  };

  if (isLoading) {
    return <Spin tip="加载验证项..." />;
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
      title: "Gate 代码",
      dataIndex: "gateCode",
      key: "gateCode",
      width: 120,
    },
    {
      title: "验证类型",
      dataIndex: "verificationType",
      key: "verificationType",
      width: 100,
      render: (type: VerificationType | string | undefined | null) => (
        <VerificationTypeBadge value={type} />
      ),
    },
    {
      title: "风险等级",
      dataIndex: "riskLevel",
      key: "riskLevel",
      width: 80,
      render: (level: RiskLevel | string | undefined | null) => (
        <RiskLevelBadge value={level} />
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: VerificationStatus | string | undefined | null) => (
        <VerificationStatusBadge value={status} />
      ),
    },
    {
      title: "验证时间",
      dataIndex: "verifiedAt",
      key: "verifiedAt",
      width: 150,
      render: (date?: string) =>
        date ? new Date(date).toLocaleString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, record: VerificationItemDto) => (
        <Space>
          {record.status === "PENDING" && (
            <>
              <Button
                size="small"
                onClick={() => handleUpdateStatus(record.id, "PASSED")}
                loading={updateStatusMutation.isPending}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                onClick={() => handleUpdateStatus(record.id, "FAILED")}
                loading={updateStatusMutation.isPending}
              >
                未通过
              </Button>
              <Button
                size="small"
                type="dashed"
                onClick={() => handleUpdateStatus(record.id, "WAIVED")}
              >
                豁免
              </Button>
            </>
          )}
          {record.status === "WAIVED" && record.waiverReason && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              原因: {record.waiverReason}
            </Text>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          {
            title: "金样数据集",
            onClick: () => router.push("/golden-datasets"),
          },
          { title: `验证项管理 (${datasetId.slice(0, 8)}...)` },
        ]}
        style={{ marginBottom: 16 }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4}>验证项管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          loading={createMutation.isPending}
        >
          创建验证项
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>

      <Modal
        title="创建验证项"
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
          initialValues={{ verificationType: "MANUAL", riskLevel: "MEDIUM" }}
        >
          <Form.Item
            name="gateCode"
            label="Gate 代码"
            rules={[{ required: true, message: "请选择 Gate" }]}
          >
            <Select options={GATE_CODE_OPTIONS} placeholder="选择阶段门" />
          </Form.Item>

          <Form.Item
            name="verificationType"
            label="验证类型"
            rules={[{ required: true, message: "请选择验证类型" }]}
          >
            <Select options={TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="riskLevel"
            label="风险等级"
            rules={[{ required: true, message: "请选择风险等级" }]}
          >
            <Select options={RISK_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: "请输入描述" }]}
          >
            <Input.TextArea placeholder="验证项描述" />
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

      <Modal
        title="豁免验证项"
        open={waiveModalVisible}
        onCancel={() => {
          setWaiveModalVisible(false);
          setSelectedItem(null);
          waiveForm.resetFields();
        }}
        footer={null}
      >
        <Form form={waiveForm} layout="vertical" onFinish={handleWaive}>
          <Form.Item
            name="reason"
            label="豁免原因"
            rules={[{ required: true, message: "请输入豁免原因" }]}
          >
            <Input.TextArea placeholder="说明豁免原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setWaiveModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateStatusMutation.isPending}
              >
                确认豁免
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
