"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Select,
  Space,
  Spin,
  Typography,
  App,
  Tag,
  Empty,
  Modal,
  Form,
  Input,
  Row,
  Col,
  Badge,
} from "antd";
// 注意：错误态改用 DataErrorAlert 统一展示
import {
  ArrowLeftOutlined,
  PlusOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import type {
  DesignOptionDto,
  DesignOptionStatus,
  DesignDiscipline,
} from "@design-platform/shared";
import {
  useDesignOptions,
  useCreateDesignOption,
} from "@/hooks/use-design-options";
import { ApiError } from "@/lib/api-client";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 10;

/** 设计选项状态标签颜色 */
const STATUS_TAG_COLOR: Record<DesignOptionStatus, string> = {
  DRAFT: "default",
  CANDIDATE: "processing",
  SUBMITTED: "warning",
  ACCEPTED: "success",
  RETURNED: "error",
  ARCHIVED: "default",
};

/** 设计选项状态显示名 */
const STATUS_LABEL: Record<DesignOptionStatus, string> = {
  DRAFT: "草稿",
  CANDIDATE: "候选",
  SUBMITTED: "已提交",
  ACCEPTED: "已采纳",
  RETURNED: "已退回",
  ARCHIVED: "已归档",
};

/** 专业显示名 */
const DISCIPLINE_LABEL: Record<DesignDiscipline, string> = {
  ARCHITECTURE: "建筑",
  STRUCTURE: "结构",
  MEP: "机电",
  LANDSCAPE: "景观",
  INTERIOR: "室内",
};

/**
 * 设计选项列表页
 * - 选项卡片网格
 * - 状态 + 专业筛选
 * - 创建选项抽屉
 * - 点击卡片进入详情
 */
export default function ProjectDesignOptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  // 筛选与分页
  const [statusFilter, setStatusFilter] = useState<
    DesignOptionStatus | undefined
  >(undefined);
  const [disciplineFilter, setDisciplineFilter] = useState<
    DesignDiscipline | undefined
  >(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // 创建抽屉
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  const { data, isLoading, isError, error } = useDesignOptions(projectId, {
    page,
    pageSize,
    status: statusFilter,
    discipline: disciplineFilter,
  });

  const createMutation = useCreateDesignOption(projectId);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createMutation.mutateAsync({
        title: values.title,
        description: values.description,
        discipline: values.discipline,
      });
      message.success("创建设计选项成功");
      setCreateModalOpen(false);
      createForm.resetFields();
      setPage(1);
    } catch (err) {
      const tip =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "创建失败";
      message.error(tip);
    }
  };

  const openDetail = (option: DesignOptionDto) => {
    router.push(`/projects/${projectId}/design-options/${option.id}`);
  };

  // 加载态
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // 错误态：使用 DataErrorAlert 统一展示
  if (isError) {
    return (
      <DataErrorAlert
        error={error}
        context="设计选项"
        variant="result"
        onRetry={() => router.push("/projects")}
        retryLabel="返回项目列表"
      />
    );
  }

  const options = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/projects/${projectId}`)}
          style={{ paddingLeft: 0 }}
        >
          返回项目详情
        </Button>
        <Space>
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: "DRAFT", label: "草稿" },
              { value: "CANDIDATE", label: "候选" },
              { value: "SUBMITTED", label: "已提交" },
              { value: "ACCEPTED", label: "已采纳" },
              { value: "RETURNED", label: "已退回" },
            ]}
          />
          <Select
            placeholder="筛选专业"
            allowClear
            style={{ width: 120 }}
            value={disciplineFilter}
            onChange={(v) => {
              setDisciplineFilter(v);
              setPage(1);
            }}
            options={[
              { value: "ARCHITECTURE", label: "建筑" },
              { value: "STRUCTURE", label: "结构" },
              { value: "MEP", label: "机电" },
              { value: "LANDSCAPE", label: "景观" },
              { value: "INTERIOR", label: "室内" },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建设计选项
          </Button>
        </Space>
      </div>

      {/* 页面标题 */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          设计选项
        </Title>
        <Text type="secondary">方案候选轮管理 — 建筑纵向闭环 V0</Text>
      </Card>

      {/* 选项卡片网格 */}
      {options.length === 0 ? (
        <Card bordered={false}>
          <Empty description="暂无设计选项，点击右上角创建第一个方案" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {options.map((opt) => (
            <Col xs={24} sm={12} md={8} lg={6} key={opt.id}>
              <Card
                hoverable
                bordered={false}
                style={{ borderRadius: 12, height: "100%" }}
                onClick={() => openDetail(opt)}
                bodyStyle={{ padding: 16 }}
              >
                <Badge.Ribbon
                  text={STATUS_LABEL[opt.status]}
                  color={STATUS_TAG_COLOR[opt.status]}
                >
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <Title level={5} style={{ margin: 0 }}>
                      {opt.title}
                    </Title>
                    <Tag color="blue">{DISCIPLINE_LABEL[opt.discipline]}</Tag>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ margin: 0, color: "rgba(0,0,0,0.65)" }}
                    >
                      {opt.description || "暂无描述"}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      更新于 {new Date(opt.updatedAt).toLocaleDateString()}
                    </Text>
                  </Space>
                </Badge.Ribbon>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div style={{ textAlign: "center" }}>
          <Select
            value={pageSize}
            onChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
            style={{ marginRight: 12, width: 120 }}
            options={[
              { value: 10, label: "10 条/页" },
              { value: 20, label: "20 条/页" },
              { value: 50, label: "50 条/页" },
            ]}
          />
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Text style={{ margin: "0 12px" }}>
            第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
          </Text>
          <Button
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() =>
              setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))
            }
          >
            下一页
          </Button>
        </div>
      )}

      {/* 创建设计选项弹窗 */}
      <Modal
        title="创建设计选项"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="title"
            label="方案名称"
            rules={[{ required: true, message: "请输入方案名称" }]}
          >
            <Input placeholder="例如：方案 A-围合式中庭" maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label="方案描述">
            <TextArea
              rows={4}
              placeholder="简要描述方案特点、设计理念等"
              maxLength={4096}
            />
          </Form.Item>
          <Form.Item name="discipline" label="专业">
            <Select
              placeholder="选择专业"
              options={[
                { value: "ARCHITECTURE", label: "建筑" },
                { value: "STRUCTURE", label: "结构" },
                { value: "MEP", label: "机电" },
                { value: "LANDSCAPE", label: "景观" },
                { value: "INTERIOR", label: "室内" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
