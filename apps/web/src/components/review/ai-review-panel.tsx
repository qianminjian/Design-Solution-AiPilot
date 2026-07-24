"use client";

import { useMemo, useState } from "react";
import {
  Card,
  List,
  Tag,
  Typography,
  Empty,
  Spin,
  Button,
  Modal,
  Form,
  Input,
  Radio,
  Space,
  Alert,
  Descriptions,
  App,
  Badge,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UndoOutlined,
  WarningOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type {
  AiGenerationRecordDto,
  AiReviewDecision,
} from "@design-platform/shared";
import {
  usePendingAiReviews,
  useSubmitAiReview,
} from "@/hooks/use-ai-generation-records";

const { Paragraph, Text } = Typography;

/** 风险等级展示配置 */
const RISK_CONFIG: Record<
  AiGenerationRecordDto["riskLevel"],
  { color: string; label: string }
> = {
  low: { color: "green", label: "低风险" },
  medium: { color: "gold", label: "中风险" },
  high: { color: "orange", label: "高风险" },
  critical: { color: "red", label: "极高风险" },
};

/** 决策展示配置 */
const DECISION_CONFIG: Record<
  AiReviewDecision,
  { color: string; label: string; icon: typeof CheckCircleOutlined }
> = {
  APPROVED: { color: "green", label: "通过", icon: CheckCircleOutlined },
  REJECTED: { color: "red", label: "驳回", icon: CloseCircleOutlined },
  RETURNED: { color: "orange", label: "退回重生成", icon: UndoOutlined },
};

interface AiReviewPanelProps {
  /** 项目 ID */
  projectId: string;
}

/**
 * AI 生成记录人工复核面板
 *
 * AI 安全红线闭环（security.md §12）：
 * - requiresHumanReview=true 的 AI 输出必须经人工复核才能采纳
 * - 风险等级 high/critical 须双人复核 + 注册师签章
 */
export function AiReviewPanel({ projectId }: AiReviewPanelProps) {
  const { message } = App.useApp();
  const { data, isLoading, isError, refetch } = usePendingAiReviews(projectId);
  const submitReview = useSubmitAiReview();
  const [selectedRecord, setSelectedRecord] =
    useState<AiGenerationRecordDto | null>(null);
  const [form] = Form.useForm();

  const pendingRecords = useMemo(() => data ?? [], [data]);
  const isHighRisk = useMemo(() => {
    if (!selectedRecord) return false;
    return (
      selectedRecord.riskLevel === "high" ||
      selectedRecord.riskLevel === "critical"
    );
  }, [selectedRecord]);

  const handleSubmitReview = async () => {
    if (!selectedRecord) return;
    try {
      const values = await form.validateFields();
      const payload = {
        decision: values.decision as AiReviewDecision,
        comment: values.comment?.trim() || undefined,
        decisionContext: isHighRisk
          ? {
              secondReviewer: values.secondReviewer,
              signer: {
                name: values.signerName,
                certificateNo: values.signerCertificateNo,
              },
            }
          : undefined,
      };
      await submitReview.mutateAsync({ id: selectedRecord.id, payload });
      message.success("复核决策已提交");
      setSelectedRecord(null);
      form.resetFields();
    } catch (error) {
      // 表单校验失败不弹错误提示
      if (error instanceof Error && error.message) {
        message.error(`提交失败: ${error.message}`);
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedRecord(null);
    form.resetFields();
  };

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SafetyCertificateOutlined style={{ color: "#2563eb" }} />
          <span>AI 生成记录人工复核</span>
          {pendingRecords.length > 0 && (
            <Badge
              count={pendingRecords.length}
              style={{ backgroundColor: "#faad14" }}
            />
          )}
        </div>
      }
      extra={
        <Button size="small" onClick={() => void refetch()} loading={isLoading}>
          刷新
        </Button>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description="待复核 AI 生成记录加载失败，请稍后重试"
        />
      ) : pendingRecords.length === 0 ? (
        <Empty description="暂无待复核的 AI 生成记录" />
      ) : (
        <List
          dataSource={pendingRecords}
          renderItem={(record) => {
            const risk = RISK_CONFIG[record.riskLevel];
            const hasEscalated =
              record.guardrailResult?.escalatedReview === true;
            return (
              <List.Item
                key={record.id}
                actions={[
                  <Button
                    key="review"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => setSelectedRecord(record)}
                  >
                    复核
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size="small" wrap>
                      <Tag color={risk.color}>{risk.label}</Tag>
                      <Text strong>{record.promptTemplate}</Text>
                      <Text type="secondary">·</Text>
                      <Text type="secondary">{record.model}</Text>
                      {hasEscalated && (
                        <Tag color="red" icon={<WarningOutlined />}>
                          升级复核
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space size="middle" wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        生成时间:{" "}
                        {new Date(record.createdAt).toLocaleString("zh-CN")}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        延迟: {record.latencyMs}ms
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Tokens: {record.tokenUsage.totalTokens}
                      </Text>
                      {record.traceId && (
                        <Text type="secondary" style={{ fontSize: 12 }} code>
                          trace: {record.traceId.slice(0, 12)}…
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      <Modal
        title="AI 生成记录复核"
        open={selectedRecord !== null}
        onOk={handleSubmitReview}
        onCancel={handleCloseModal}
        confirmLoading={submitReview.isPending}
        okText="提交复核决策"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        {selectedRecord && (
          <>
            {isHighRisk && (
              <Alert
                type="warning"
                showIcon
                message={`${RISK_CONFIG[selectedRecord.riskLevel].label}记录须双人复核 + 注册师签章`}
                description="请在下方填写第二复核人与注册师签章信息（security.md §12 AI 安全红线）"
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions
              size="small"
              column={2}
              bordered
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="风险等级">
                <Tag color={RISK_CONFIG[selectedRecord.riskLevel].color}>
                  {RISK_CONFIG[selectedRecord.riskLevel].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="模型">
                {selectedRecord.model}
              </Descriptions.Item>
              <Descriptions.Item label="Prompt 模板" span={2}>
                {selectedRecord.promptTemplate}
              </Descriptions.Item>
              <Descriptions.Item label="生成时间" span={2}>
                {new Date(selectedRecord.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
              <Descriptions.Item label="Guardrails" span={2}>
                <Space size="small">
                  <Tag
                    color={
                      selectedRecord.guardrailResult.passed ? "green" : "red"
                    }
                  >
                    {selectedRecord.guardrailResult.passed ? "通过" : "未通过"}
                  </Tag>
                  {selectedRecord.guardrailResult.escalatedReview && (
                    <Tag color="red">升级复核</Tag>
                  )}
                  {selectedRecord.guardrailResult.warnings.length > 0 && (
                    <Text type="warning" style={{ fontSize: 12 }}>
                      {selectedRecord.guardrailResult.warnings.length} 条警告
                    </Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="原始输出" span={2}>
                <Paragraph
                  ellipsis={{ rows: 4, expandable: true, symbol: "展开" }}
                  style={{ margin: 0, maxHeight: 160, overflow: "auto" }}
                >
                  {selectedRecord.rawContent}
                </Paragraph>
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item
                name="decision"
                label="复核决策"
                rules={[{ required: true, message: "请选择复核决策" }]}
              >
                <Radio.Group>
                  {(["APPROVED", "REJECTED", "RETURNED"] as const).map((d) => {
                    const cfg = DECISION_CONFIG[d];
                    const Icon = cfg.icon;
                    return (
                      <Radio key={d} value={d}>
                        <Space size="small">
                          <Icon style={{ color: cfg.color }} />
                          {cfg.label}
                        </Space>
                      </Radio>
                    );
                  })}
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="comment"
                label="复核意见"
                rules={[{ max: 2000, message: "意见不超过 2000 字符" }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="说明复核依据、修改建议或驳回原因"
                  showCount
                  maxLength={2000}
                />
              </Form.Item>

              {isHighRisk && (
                <>
                  <Form.Item
                    name="secondReviewer"
                    label="第二复核人 ID"
                    rules={[
                      { required: true, message: "高风险记录须填写第二复核人" },
                    ]}
                  >
                    <Input placeholder="如 user-uuid-002" />
                  </Form.Item>
                  <Form.Item
                    name="signerName"
                    label="注册师姓名"
                    rules={[
                      { required: true, message: "高风险记录须填写注册师姓名" },
                    ]}
                  >
                    <Input placeholder="注册建筑师/工程师姓名" />
                  </Form.Item>
                  <Form.Item
                    name="signerCertificateNo"
                    label="注册师证书号"
                    rules={[
                      {
                        required: true,
                        message: "高风险记录须填写注册师证书号",
                      },
                    ]}
                  >
                    <Input placeholder="注册师执业证书编号" />
                  </Form.Item>
                </>
              )}
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
}
