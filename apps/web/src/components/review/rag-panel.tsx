"use client";

import { useMemo, useState } from "react";
import {
  Input,
  Button,
  Card,
  Typography,
  Tag,
  Spin,
  Alert,
  Select,
  Empty,
  Tooltip,
} from "antd";
import {
  SendOutlined,
  FileTextOutlined,
  LinkOutlined,
  DatabaseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { RagQueryResponse, RagCitation } from "@design-platform/shared";
import { useKnowledgeBases, useRagQuery } from "@/hooks/use-rag";

interface RagPanelProps {
  /**
   * 项目 ID（保留兼容签名，V1 后端不再要求 projectId 作为查询参数，
   * 知识库选择改为显式下拉框，由 useKnowledgeBases 提供选项）
   */
  projectId?: string;
  /** 外部强制传入的查询回调（保留兼容，未传时使用内部 useRagQuery） */
  onQuery?: (payload: {
    knowledgeBaseId: string;
    question: string;
  }) => Promise<RagQueryResponse>;
  /** 外部 loading 状态（与 onQuery 配合使用） */
  isLoading?: boolean;
}

const { Title, Text, Paragraph } = Typography;

/**
 * RAG 知识库检索面板
 *
 * V1 升级说明（对齐 services/ai/src/rag/router.py）：
 *  - 显式选择知识库（下拉框），替代旧的 projectId 隐式绑定
 *  - 检索响应展示 conclusion（结论）+ citations（引用片段）+ uncertainty（不确定性）
 *  - 引用片段包含 chunkId / documentId / section / score，可定位到具体文本块
 *  - 保留 isAiAssisted 与 requiresHumanReview 标记（security.md §12 AI 安全红线）
 */
export function RagPanel({
  projectId: _projectId,
  onQuery,
  isLoading,
}: RagPanelProps) {
  const [selectedKbId, setSelectedKbId] = useState<string | undefined>();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 知识库列表
  const {
    data: knowledgeBases,
    isLoading: kbLoading,
    isError: kbError,
    refetch: refetchKb,
  } = useKnowledgeBases();

  // 检索问答（内部 hook，外部传入 onQuery 时优先使用外部回调）
  const internalQuery = useRagQuery();

  const handleSubmit = async () => {
    if (!question.trim() || !selectedKbId) return;

    setError(null);
    setAnswer(null);

    try {
      const payload = {
        knowledgeBaseId: selectedKbId,
        question: question.trim(),
      };
      const response = onQuery
        ? await onQuery(payload)
        : await internalQuery.mutateAsync(payload);
      setAnswer(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "查询失败，请重试";
      setError(message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const loading = isLoading ?? internalQuery.isPending;
  const canSubmit = Boolean(question.trim() && selectedKbId && !loading);

  const kbOptions = useMemo(
    () =>
      (knowledgeBases ?? []).map((kb) => ({
        label: `${kb.id} (${kb.documentCount} 篇)`,
        value: kb.id,
      })),
    [knowledgeBases],
  );

  return (
    <Card
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextOutlined />
          <Title level={4} style={{ margin: 0 }}>
            AI 辅助检索
          </Title>
        </div>
      }
      size="small"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* 知识库选择 */}
        <div>
          <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
            <DatabaseOutlined /> 选择知识库
          </Text>
          {kbError ? (
            <Alert
              type="error"
              showIcon
              message="知识库列表加载失败"
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => void refetchKb()}
                >
                  重试
                </Button>
              }
            />
          ) : (
            <Select
              value={selectedKbId}
              onChange={(value: string) => setSelectedKbId(value)}
              placeholder="请选择知识库"
              loading={kbLoading}
              style={{ width: "100%" }}
              options={kbOptions}
              notFoundContent={
                kbLoading ? (
                  <Spin size="small" />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无知识库"
                  />
                )
              }
              allowClear
              showSearch
              optionFilterProp="label"
              aria-label="选择知识库"
            />
          )}
        </div>

        <div>
          <Text type="secondary">
            输入问题，AI 将基于所选知识库进行检索回答
          </Text>
        </div>

        <Input.TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="例如：防火分区的面积限制是多少？"
          rows={4}
          disabled={loading || !selectedKbId}
        />

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={loading}
          style={{ alignSelf: "flex-end" }}
        >
          检索
        </Button>

        {error && (
          <Alert
            message="查询失败"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 0",
            }}
          >
            <Spin tip="AI 正在检索..." size="large" />
          </div>
        )}

        {answer && !loading && <RagAnswerView answer={answer} />}
      </div>
    </Card>
  );
}

/**
 * 检索答案展示视图
 * 包含结论、引用片段、不确定性、人工复核标记
 */
function RagAnswerView({ answer }: { answer: RagQueryResponse }) {
  const confidencePercent = Math.round((1 - answer.uncertainty) * 100);

  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 6,
        padding: 16,
        marginTop: 8,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Tag color="green">结论</Tag>
        <Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
          {answer.conclusion}
        </Paragraph>
      </div>

      <div
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        <Tooltip title="基于不确定性换算，越高越确定">
          <Tag
            color={
              confidencePercent >= 70
                ? "green"
                : confidencePercent >= 40
                  ? "orange"
                  : "red"
            }
          >
            置信度: {confidencePercent}%
          </Tag>
        </Tooltip>
        <Tag color={answer.requiresHumanReview ? "orange" : "green"}>
          {answer.requiresHumanReview ? "需人工复核" : "AI 辅助"}
        </Tag>
        <Tag>耗时: {answer.retrievalTimeMs}ms</Tag>
        <Tag color="blue">模型: {answer.modelVersion}</Tag>
      </div>

      {answer.citations.length > 0 && (
        <div>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            引用片段（{answer.citations.length}）
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {answer.citations.map((citation) => (
              <CitationCard key={citation.chunkId} citation={citation} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 单条引用片段卡片
 * 展示标题、章节、相关性评分、内容片段
 */
function CitationCard({ citation }: { citation: RagCitation }) {
  const scorePercent = Math.round(citation.score * 100);
  const scoreColor =
    citation.score >= 0.8 ? "green" : citation.score >= 0.5 ? "orange" : "red";

  return (
    <div
      style={{
        borderLeft: "3px solid #1890ff",
        paddingLeft: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Text strong>{citation.title}</Text>
        {citation.section && <Tag>§{citation.section}</Tag>}
        <Tag color={scoreColor}>相关度: {scorePercent}%</Tag>
        <Tooltip
          title={`chunkId: ${citation.chunkId} / documentId: ${citation.documentId}`}
        >
          <LinkOutlined style={{ fontSize: 12, color: "#1890ff" }} />
        </Tooltip>
      </div>
      <Text
        type="secondary"
        style={{ fontSize: 12, display: "block", marginTop: 4 }}
      >
        {citation.content}
      </Text>
    </div>
  );
}
