"use client";

import { useState } from "react";
import { Input, Button, Card, Typography, Tag, Spin, Alert } from "antd";
import { SendOutlined, FileTextOutlined, LinkOutlined } from "@ant-design/icons";
import type { RagQueryResponse, RagQueryRequest } from "@/hooks/use-review";

interface RagPanelProps {
  projectId: string;
  onQuery: (payload: RagQueryRequest) => Promise<RagQueryResponse>;
  isLoading?: boolean;
}

const { Title, Text, Paragraph } = Typography;

export function RagPanel({ projectId, onQuery, isLoading }: RagPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!question.trim() || !projectId) return;

    setError(null);
    setAnswer(null);

    try {
      const response = await onQuery({ projectId, question: question.trim() });
      setAnswer(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败，请重试");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextOutlined />
          <Title level={4} style={{ margin: 0 }}>
            AI 辅助审查
          </Title>
        </div>
      }
      size="small"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Text type="secondary">输入问题，AI 将基于项目文档和规范进行检索回答</Text>
        </div>

        <Input.TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="例如：防火分区的面积限制是多少？"
          rows={4}
          disabled={isLoading}
        />

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          disabled={!question.trim() || isLoading}
          loading={isLoading}
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
          />
        )}

        {isLoading && (
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

        {answer && !isLoading && (
          <div
            style={{
              border: "1px solid #e8e8e8",
              borderRadius: 6,
              padding: 16,
              marginTop: 8,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue">问题</Tag>
              <Paragraph style={{ marginBottom: 0 }}>{answer.question}</Paragraph>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Tag color="green">回答</Tag>
              <Paragraph style={{ marginBottom: 0 }}>{answer.answer}</Paragraph>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <Tag color="default">
                置信度: {Math.round(answer.confidence * 100)}%
              </Tag>
              <Tag color={answer.requiresHumanReview ? "orange" : "green"}>
                {answer.requiresHumanReview ? "需人工复核" : "AI 辅助"}
              </Tag>
              <Tag>耗时: {answer.latencyMs}ms</Tag>
            </div>

            {answer.sources && answer.sources.length > 0 && (
              <div>
                <Text strong style={{ marginBottom: 8, display: "block" }}>
                  引用来源
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {answer.sources.map((source) => (
                    <div
                      key={source.id}
                      style={{
                        borderLeft: "3px solid #1890ff",
                        paddingLeft: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Text strong>{source.title}</Text>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12 }}
                          >
                            <LinkOutlined />
                          </a>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {source.snippet}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}