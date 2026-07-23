"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  App,
  Divider,
  Collapse,
} from "antd";
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import type {
  GenerateSolutionResponse,
  SolutionCandidate,
} from "@design-platform/shared";
import {
  useGenerateSolution,
  PROMPT_TEMPLATE_OPTIONS,
  getTemplateVariables,
  getTemplateLabel,
} from "@/hooks/use-solutions";
import { MarkdownRenderer } from "@/components/ai-solution/markdown-renderer";
import { CandidateReviewPanel } from "@/components/ai-solution/candidate-review-panel";

const { Title, Text, Paragraph } = Typography;

/**
 * AI 方案生成工作台
 * 对齐 V1 业务"境外主创草图到方案深化"（OD-03 决策 12）
 *
 * 工作流：
 * 1. 选择 prompt 模板（concept-generation / scheme-deepening / design-option-comparison / design-summary）
 * 2. 填写模板变量
 * 3. 调用 /api/v1/solutions/generate 生成方案候选
 * 4. 查看 Guardrails 校验结果与人工复核提示
 * 5. 候选可接受/驳回/批注（Commit 4 接入 Design 模块反馈）
 *
 * 所有 AI 输出强制 isAiAssisted=true，按风险等级进入人工复核（security.md §12）
 */
export default function AiGenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [selectedTemplate, setSelectedTemplate] =
    useState<string>("concept-generation");
  const [response, setResponse] = useState<GenerateSolutionResponse | null>(
    null,
  );

  const generate = useGenerateSolution();

  const variables = useMemo(
    () => getTemplateVariables(selectedTemplate),
    [selectedTemplate],
  );

  /** 提交生成请求 */
  async function handleGenerate(): Promise<void> {
    try {
      const values = await form.validateFields();
      const variablesPayload = variables.map((v) => ({
        key: v.key,
        value: String(values[v.key] ?? ""),
      }));

      const result = await generate.mutateAsync({
        promptTemplate: selectedTemplate,
        variables: variablesPayload,
        projectId,
        temperature: values.temperature ?? 0.7,
        maxTokens: values.maxTokens ?? 2048,
      });

      setResponse(result);
      message.success(`生成完成，共 ${result.candidates.length} 个候选`);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  /** 重置表单与结果 */
  function handleReset(): void {
    form.resetFields();
    setResponse(null);
  }

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
          onClick={() => router.push(`/projects/${projectId}`)}
          style={{ paddingLeft: 0 }}
        >
          返回项目
        </Button>
        <Space size="middle">
          <Tooltip title="AI 安全红线">
            <Tag icon={<WarningOutlined />} color="orange">
              AI 辅助 · 需人工复核
            </Tag>
          </Tooltip>
        </Space>
      </div>

      {/* 标题区 */}
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          AI 方案生成
        </Title>
        <Text type="secondary">
          选择 Prompt 模板 · 填写变量 · 生成方案候选 · 人工复核
        </Text>
      </div>

      {/* AI 安全红线提示 */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="所有 AI 输出标记为 AI 辅助，不替代注册建筑师/工程师的专业审签"
        description="按风险等级进入人工复核：低风险抽检，中风险逐项复核，高风险强制专业复核，极高风险双人复核 + 注册师签章"
      />

      {/* 左侧表单 + 右侧结果 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 左侧：Prompt 模板与变量表单 */}
        <Card
          title="生成参数"
          style={{ width: 380, flexShrink: 0 }}
          extra={
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={generate.isPending}
              onClick={handleGenerate}
            >
              生成方案
            </Button>
          }
        >
          <Form form={form} layout="vertical" size="small">
            <Form.Item label="Prompt 模板" required>
              <Select
                value={selectedTemplate}
                onChange={(v) => {
                  setSelectedTemplate(v);
                  form.resetFields();
                }}
                options={PROMPT_TEMPLATE_OPTIONS.map((t) => ({
                  value: t.name,
                  label: t.label,
                }))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {
                  PROMPT_TEMPLATE_OPTIONS.find(
                    (t) => t.name === selectedTemplate,
                  )?.description
                }
              </Text>
            </Form.Item>

            <Divider style={{ margin: "8px 0" }}>模板变量</Divider>

            {variables.map((v) => (
              <Form.Item
                key={v.key}
                name={v.key}
                label={v.label}
                rules={
                  v.required
                    ? [{ required: true, message: `${v.label}不能为空` }]
                    : []
                }
              >
                <Input.TextArea
                  placeholder={v.placeholder}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                />
              </Form.Item>
            ))}

            <Divider style={{ margin: "8px 0" }}>生成参数</Divider>

            <Space size="middle" style={{ width: "100%" }}>
              <Form.Item name="temperature" label="采样温度" initialValue={0.7}>
                <Input type="number" step={0.1} min={0} max={2} />
              </Form.Item>
              <Form.Item
                name="maxTokens"
                label="最大 Token"
                initialValue={2048}
              >
                <Input type="number" min={1} max={8192} />
              </Form.Item>
            </Space>

            <Button onClick={handleReset} block>
              重置
            </Button>
          </Form>
        </Card>

        {/* 右侧：结果展示 */}
        <div style={{ flex: 1, minWidth: 400 }}>
          {generate.isPending && (
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 300,
                }}
              >
                <Spin tip="AI 生成中..." size="large">
                  <div style={{ padding: 50 }} />
                </Spin>
              </div>
            </Card>
          )}

          {!generate.isPending && !response && (
            <Card>
              <Empty description="填写参数后点击「生成方案」查看结果" />
            </Card>
          )}

          {response && (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {/* 元信息卡 */}
              <Card size="small">
                <Space size="middle" wrap>
                  <Tag icon={<RobotOutlined />} color="blue">
                    {response.model}
                  </Tag>
                  <Tag color="cyan">
                    模板: {getTemplateLabel(response.promptTemplateUsed)}
                  </Tag>
                  <Tag
                    color={
                      response.riskLevel === "critical"
                        ? "red"
                        : response.riskLevel === "high"
                          ? "orange"
                          : response.riskLevel === "medium"
                            ? "gold"
                            : "green"
                    }
                  >
                    风险: {response.riskLevel}
                  </Tag>
                  <Tag>耗时: {response.latencyMs}ms</Tag>
                  <Tag>
                    Token: {response.usage.totalTokens}（prompt{" "}
                    {response.usage.promptTokens} + completion{" "}
                    {response.usage.completionTokens}）
                  </Tag>
                  {response.requiresHumanReview ? (
                    <Tag icon={<WarningOutlined />} color="red">
                      需人工复核
                    </Tag>
                  ) : (
                    <Tag icon={<CheckCircleOutlined />} color="green">
                      无需强制复核
                    </Tag>
                  )}
                </Space>
              </Card>

              {/* Guardrails 校验结果 */}
              {!response.guardrail.passed && (
                <Alert
                  type="error"
                  showIcon
                  icon={<ExclamationCircleOutlined />}
                  message="Guardrails 校验未通过"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {response.guardrail.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  }
                />
              )}

              {response.guardrail.escalatedReview && (
                <Alert
                  type="warning"
                  showIcon
                  message="检测到安全升级关键词，已强制升级人工复核"
                  description="AI 输出中包含「最终施工图」「已审签」等专业审签级词汇，须由注册建筑师双人复核 + 签章"
                />
              )}

              {/* 候选列表 */}
              {response.candidates.map((candidate, idx) => (
                <CandidateCard
                  key={idx}
                  projectId={projectId}
                  candidate={candidate}
                  index={idx}
                  requiresHumanReview={response.requiresHumanReview}
                />
              ))}

              {/* 原始输出（折叠，用于审计追溯） */}
              <Collapse
                size="small"
                items={[
                  {
                    key: "raw",
                    label: "LLM 原始输出（审计追溯）",
                    children: (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          maxHeight: 300,
                          overflow: "auto",
                        }}
                      >
                        {response.rawContent}
                      </pre>
                    ),
                  },
                ]}
              />
            </Space>
          )}
        </div>
      </div>
    </Space>
  );
}

/**
 * 候选卡片
 * 展示候选名称、Markdown 渲染内容、风险点、可行性注记与人工复核面板
 */
function CandidateCard({
  projectId,
  candidate,
  index,
  requiresHumanReview,
}: {
  projectId: string;
  candidate: SolutionCandidate;
  index: number;
  requiresHumanReview: boolean;
}) {
  return (
    <Card
      title={
        <Space>
          <Tag color="blue">候选 {index + 1}</Tag>
          <Text strong>{candidate.name}</Text>
        </Space>
      }
      size="small"
    >
      {/* 候选内容（Markdown 渲染） */}
      <MarkdownRenderer content={candidate.content} />

      {/* 风险点 */}
      {candidate.risks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            风险点:
          </Text>
          <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
            {candidate.risks.map((risk, i) => (
              <li key={i} style={{ fontSize: 13, color: "#d4380d" }}>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 可行性注记 */}
      {candidate.feasibilityNotes && (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            可行性注记:
          </Text>
          <Paragraph style={{ margin: "4px 0 0", fontSize: 13 }}>
            {candidate.feasibilityNotes}
          </Paragraph>
        </div>
      )}

      {/* 复核提示 */}
      {requiresHumanReview && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="此候选需人工复核后方可采纳"
          description="AI 输出标记为「AI 辅助」，不替代注册建筑师专业判断。复核通过后可转入设计选项库。"
          style={{ marginTop: 8 }}
        />
      )}

      {/* 人工复核面板：接受 / 驳回 / 批注 */}
      <CandidateReviewPanel projectId={projectId} candidate={candidate} />
    </Card>
  );
}
