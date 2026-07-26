"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Space,
  Spin,
  Typography,
  App,
  Tag,
  Empty,
  Card,
  Descriptions,
  Alert,
  Input,
  Form,
  Rate,
  List,
  Avatar,
  Divider,
  Collapse,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  MessageOutlined,
  RobotOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type {
  DesignOptionStatus,
  DesignDiscipline,
  DesignFeedbackDto,
} from "@design-platform/shared";
import {
  useDesignOption,
  useDesignFeedback,
  useSubmitDesignFeedback,
} from "@/hooks/use-design-options";
import { useAiGenerationRecordsByDesignOption } from "@/hooks/use-ai-generation-records";
import { MarkdownRenderer } from "@/components/ai-solution/markdown-renderer";
import { ApiError } from "@/lib/api-client";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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

/** 风险等级标签颜色 */
const RISK_TAG_COLOR: Record<string, string> = {
  low: "success",
  medium: "processing",
  high: "warning",
  critical: "error",
};

/** 风险等级显示名 */
const RISK_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "极高",
};

/** AI 来源元数据结构 */
interface AiSourceMetadata {
  source?: string;
  risks?: string[];
  feasibilityNotes?: string;
  reviewer?: string;
  reviewComment?: string;
  reviewedAt?: string;
  aiGenerationRecordId?: string;
}

/**
 * 解析 designOption.metadata（JSON 字符串或对象）为 AiSourceMetadata
 */
function parseMetadata(metadata: unknown): AiSourceMetadata | null {
  if (!metadata) return null;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as AiSourceMetadata;
      return parsed?.source === "ai-generation" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === "object" && metadata !== null) {
    const meta = metadata as AiSourceMetadata;
    return meta.source === "ai-generation" ? meta : null;
  }
  return null;
}

/**
 * 设计选项详情页
 *
 * 展示内容：
 * 1. 设计选项基本信息（标题、状态、专业、描述、审计字段）
 * 2. AI 来源元数据（若来源 AI，展示复核人、批注、风险点、可行性注记）
 * 3. AI 生成记录（候选内容、Prompt 模板、模型、Token 用量、Guardrails、traceId）
 * 4. 反馈历史 + 提交反馈表单
 */
export default function DesignOptionDetailPage({
  params,
}: {
  params: Promise<{ id: string; optionId: string }>;
}) {
  const { id: projectId, optionId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  const { data: option, isLoading, isError, error } = useDesignOption(optionId);
  const { data: aiRecords, isLoading: aiRecordsLoading } =
    useAiGenerationRecordsByDesignOption(optionId);
  const { data: feedbacks, isLoading: feedbackLoading } =
    useDesignFeedback(optionId);
  const submitMutation = useSubmitDesignFeedback();
  const [feedbackForm] = Form.useForm();

  const handleSubmitFeedback = async () => {
    try {
      const values = await feedbackForm.validateFields();
      await submitMutation.mutateAsync({
        optionId,
        comment: values.comment,
        rating: values.rating,
      });
      message.success("反馈提交成功");
      feedbackForm.resetFields();
    } catch (err) {
      const tip =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "提交失败";
      message.error(tip);
    }
  };

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

  // 错误态：使用 DataErrorAlert 统一展示，404/403/500/schema 校验失败均通过该组件处理
  if (isError || !option) {
    return (
      <DataErrorAlert
        error={error}
        context="设计选项详情"
        variant="result"
        onRetry={() => router.push(`/projects/${projectId}/design-options`)}
        retryLabel="返回设计选项列表"
      />
    );
  }

  const aiMetadata = parseMetadata(option.metadata);
  const primaryAiRecord = aiRecords?.[0];

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
          onClick={() => router.push(`/projects/${projectId}/design-options`)}
          style={{ paddingLeft: 0 }}
        >
          返回设计选项列表
        </Button>
        <Button
          icon={<ExperimentOutlined />}
          onClick={() => router.push(`/projects/${projectId}/ai-generation`)}
        >
          生成新方案
        </Button>
      </div>

      {/* 基本信息 */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Space align="center" wrap>
            <Title level={3} style={{ margin: 0 }}>
              {option.title}
            </Title>
            <Tag color={STATUS_TAG_COLOR[option.status]}>
              {STATUS_LABEL[option.status]}
            </Tag>
            <Tag color="blue">{DISCIPLINE_LABEL[option.discipline]}</Tag>
          </Space>

          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            style={{ marginTop: 8 }}
          >
            <Descriptions.Item label="设计选项 ID">
              <Text code copyable>
                {option.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(option.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(option.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: "8px 0" }} />

          <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {option.description || "暂无描述"}
          </Paragraph>
        </Space>
      </Card>

      {/* AI 来源元数据 */}
      {aiMetadata && (
        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          title={
            <Space>
              <RobotOutlined />
              <span>AI 来源元数据</span>
              <Tag color="purple">AI 辅助</Tag>
            </Space>
          }
        >
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="此设计选项来源于 AI 生成，需经过注册建筑师/工程师专业复核后方可采纳"
            style={{ marginBottom: 12 }}
          />
          <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="来源">
              <Tag color="purple">{aiMetadata.source}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="复核人">
              {aiMetadata.reviewer || "未填写"}
            </Descriptions.Item>
            <Descriptions.Item label="复核时间">
              {aiMetadata.reviewedAt
                ? new Date(aiMetadata.reviewedAt).toLocaleString()
                : "未填写"}
            </Descriptions.Item>
            <Descriptions.Item label="AI 记录 ID">
              {aiMetadata.aiGenerationRecordId ? (
                <Text code copyable>
                  {aiMetadata.aiGenerationRecordId}
                </Text>
              ) : (
                <Text type="secondary">未关联</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {aiMetadata.reviewComment && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                复核批注:
              </Text>
              <Paragraph
                style={{
                  margin: "4px 0 0",
                  padding: 8,
                  background: "#fafafa",
                  borderRadius: 4,
                }}
              >
                {aiMetadata.reviewComment}
              </Paragraph>
            </div>
          )}

          {aiMetadata.risks && aiMetadata.risks.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                风险点:
              </Text>
              <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                {aiMetadata.risks.map((risk, i) => (
                  <li key={i} style={{ color: "#d4380d", fontSize: 13 }}>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiMetadata.feasibilityNotes && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                可行性注记:
              </Text>
              <Paragraph style={{ margin: "4px 0 0", fontSize: 13 }}>
                {aiMetadata.feasibilityNotes}
              </Paragraph>
            </div>
          )}
        </Card>
      )}

      {/* AI 生成记录（审计追溯） */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={
          <Space>
            <ThunderboltOutlined />
            <span>AI 生成记录</span>
            {primaryAiRecord && (
              <Tag color={RISK_TAG_COLOR[primaryAiRecord.riskLevel]}>
                风险: {RISK_LABEL[primaryAiRecord.riskLevel]}
              </Tag>
            )}
          </Space>
        }
      >
        <Spin spinning={aiRecordsLoading}>
          {!primaryAiRecord ? (
            <Empty description="此设计选项未关联 AI 生成记录" />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {/* 基本信息与模型 */}
              <Descriptions
                size="small"
                column={{ xs: 1, sm: 2, md: 3 }}
                bordered
              >
                <Descriptions.Item label="Prompt 模板">
                  <Tag color="blue">{primaryAiRecord.promptTemplate}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="模型">
                  {primaryAiRecord.model}
                </Descriptions.Item>
                <Descriptions.Item label="耗时">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {primaryAiRecord.latencyMs} ms
                </Descriptions.Item>
                <Descriptions.Item label="Token 用量">
                  <Space size="small">
                    <Tag>
                      Prompt:{" "}
                      {(primaryAiRecord.tokenUsage as { promptTokens?: number })
                        ?.promptTokens ?? "-"}
                    </Tag>
                    <Tag>
                      Completion:{" "}
                      {(
                        primaryAiRecord.tokenUsage as {
                          completionTokens?: number;
                        }
                      )?.completionTokens ?? "-"}
                    </Tag>
                    <Tag color="purple">
                      Total:{" "}
                      {(primaryAiRecord.tokenUsage as { totalTokens?: number })
                        ?.totalTokens ?? "-"}
                    </Tag>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="需人工复核">
                  {primaryAiRecord.requiresHumanReview ? (
                    <Tag color="warning">是</Tag>
                  ) : (
                    <Tag color="success">否</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Trace ID">
                  {primaryAiRecord.traceId ? (
                    <Text code copyable>
                      {primaryAiRecord.traceId}
                    </Text>
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              {/* Guardrails 结果 */}
              <div>
                <Text strong>
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  Guardrails 校验
                </Text>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ marginTop: 8, width: "100%" }}
                >
                  <Space>
                    {primaryAiRecord.guardrailResult.passed ? (
                      <Tag color="success">校验通过</Tag>
                    ) : (
                      <Tag color="error">校验失败</Tag>
                    )}
                    {primaryAiRecord.guardrailResult.escalatedReview && (
                      <Tag color="warning">已升级人工复核</Tag>
                    )}
                  </Space>
                  {primaryAiRecord.guardrailResult.warnings.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        警告:
                      </Text>
                      <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                        {primaryAiRecord.guardrailResult.warnings.map(
                          (w: string, i: number) => (
                            <li
                              key={i}
                              style={{ fontSize: 13, color: "#fa8c16" }}
                            >
                              {w}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </Space>
              </div>

              {/* 候选内容（Markdown 渲染） */}
              <div>
                <Text strong>
                  <RobotOutlined style={{ marginRight: 6 }} />
                  生成候选内容
                </Text>
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: "#fafafa",
                    borderRadius: 6,
                  }}
                >
                  <MarkdownRenderer content={primaryAiRecord.rawContent} />
                </div>
              </div>

              {/* 渲染后的 Prompt（折叠） */}
              <Collapse
                ghost
                items={[
                  {
                    key: "rendered-prompt",
                    label: (
                      <Tooltip title="展开查看渲染后的完整 Prompt（含变量替换）">
                        <Text type="secondary">
                          渲染后的 Prompt（审计追溯用）
                        </Text>
                      </Tooltip>
                    ),
                    children: (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          background: "#f6f8fa",
                          padding: 12,
                          borderRadius: 6,
                          margin: 0,
                        }}
                      >
                        {primaryAiRecord.renderedPrompt}
                      </pre>
                    ),
                  },
                ]}
              />
            </Space>
          )}
        </Spin>
      </Card>

      {/* 反馈历史 */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={
          <Space>
            <MessageOutlined />
            <span>设计反馈</span>
            {feedbacks && feedbacks.length > 0 && (
              <Tag color="blue">{feedbacks.length}</Tag>
            )}
          </Space>
        }
      >
        <Spin spinning={feedbackLoading}>
          {feedbacks && feedbacks.length > 0 ? (
            <List
              dataSource={feedbacks}
              renderItem={(item: DesignFeedbackDto) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: "#1677ff" }}>
                        {item.authorId.slice(0, 2).toUpperCase()}
                      </Avatar>
                    }
                    title={
                      <Space wrap>
                        <Text strong>评审意见</Text>
                        {item.rating && (
                          <Rate
                            disabled
                            value={item.rating}
                            style={{ fontSize: 14 }}
                          />
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                    description={item.comment}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无反馈" style={{ padding: "24px 0" }} />
          )}
        </Spin>

        <Divider style={{ margin: "12px 0" }} />

        {/* 提交反馈表单 */}
        <Form form={feedbackForm} layout="vertical">
          <Form.Item
            name="comment"
            label="反馈意见"
            rules={[{ required: true, message: "请输入反馈意见" }]}
          >
            <TextArea
              rows={3}
              placeholder="请输入您的评审意见和建议"
              maxLength={4096}
            />
          </Form.Item>
          <Form.Item name="rating" label="评分（可选）">
            <Rate />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button
              type="primary"
              onClick={handleSubmitFeedback}
              loading={submitMutation.isPending}
            >
              提交反馈
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
