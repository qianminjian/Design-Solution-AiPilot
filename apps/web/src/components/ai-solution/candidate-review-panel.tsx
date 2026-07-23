"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Input,
  Space,
  Tag,
  Typography,
  App,
  Divider,
  Result,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  CommentOutlined,
  FileAddOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { SolutionCandidate } from "@design-platform/shared";
import { useCreateDesignOption } from "@/hooks/use-design-options";

const { Text, Paragraph } = Typography;

/**
 * 候选复核决策
 * - pending: 未决策
 * - accepting: 接受中（创建设计选项中）
 * - accepted: 已接受为设计选项
 * - rejected: 已驳回
 */
type ReviewDecision = "pending" | "accepting" | "accepted" | "rejected";

/**
 * 人工复核面板
 *
 * 接受 AI 候选时，将其转为 DesignOption（设计选项）落入项目设计选项库，
 * 后续可在 /projects/{id}/design-options 页面继续追踪与反馈。
 *
 * 安全红线（design-constraints.md）：
 * - AI 输出标记为「AI 辅助」，不替代注册建筑师专业审签
 * - 接受仅表示"作为设计选项候选纳入人工评审"，不构成最终专业判断
 */
export function CandidateReviewPanel({
  projectId,
  candidate,
}: {
  projectId: string;
  candidate: SolutionCandidate;
}) {
  const { message } = App.useApp();
  const createOption = useCreateDesignOption(projectId);
  const [decision, setDecision] = useState<ReviewDecision>("pending");
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");
  const [createdOptionId, setCreatedOptionId] = useState<string | null>(null);

  /** 接受：将候选转为设计选项 */
  async function handleAccept(): Promise<void> {
    setDecision("accepting");
    try {
      const created = await createOption.mutateAsync({
        title: candidate.name || `AI 候选方案 ${new Date().toLocaleString()}`,
        description: candidate.content,
        metadata: {
          source: "ai-generation",
          risks: candidate.risks,
          feasibilityNotes: candidate.feasibilityNotes,
          reviewer: reviewer || "anonymous",
          reviewComment: comment,
          reviewedAt: new Date().toISOString(),
        },
      });
      setCreatedOptionId(created.id);
      setDecision("accepted");
      message.success(`已转入设计选项库（ID: ${created.id.slice(0, 8)}...）`);
    } catch (error) {
      setDecision("pending");
      const errorMsg =
        error instanceof Error ? error.message : "接受失败，请重试";
      message.error(errorMsg);
    }
  }

  /** 驳回 */
  function handleReject(): void {
    setDecision("rejected");
    message.info("已驳回该候选（不影响设计选项库）");
  }

  /** 重置复核状态 */
  function handleReset(): void {
    setDecision("pending");
    setReviewer("");
    setComment("");
    setCreatedOptionId(null);
  }

  // 已接受
  if (decision === "accepted") {
    return (
      <Result
        status="success"
        title="已接受为设计选项"
        subTitle={`候选「${candidate.name}」已转入项目设计选项库`}
        extra={[
          <Space key="actions" direction="vertical" style={{ width: "100%" }}>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() =>
                window.open(`/projects/${projectId}/design-options`, "_self")
              }
            >
              查看设计选项库
            </Button>
            <Button onClick={handleReset}>复核其他候选</Button>
          </Space>,
        ]}
        style={{ padding: "12px 0" }}
      />
    );
  }

  // 已驳回
  if (decision === "rejected") {
    return (
      <Result
        status="info"
        title="已驳回该候选"
        subTitle="候选未转入设计选项库，可重新复核或处理其他候选"
        extra={
          <Button type="primary" onClick={handleReset}>
            撤销驳回
          </Button>
        }
        style={{ padding: "12px 0" }}
      />
    );
  }

  // 待决策
  return (
    <div>
      <Divider style={{ margin: "12px 0 8px" }}>
        <Space>
          <CommentOutlined />
          <Text type="secondary">人工复核面板</Text>
        </Space>
      </Divider>

      <Alert
        type="warning"
        showIcon
        message="AI 输出仅作为设计候选参考，接受前请由注册建筑师/工程师完成专业评审"
        description="接受将把候选转入项目设计选项库（DRAFT 状态），后续可补充反馈与批注。"
        style={{ marginBottom: 12 }}
      />

      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Input
          placeholder="复核人姓名（可空，默认 anonymous）"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          size="small"
        />
        <Input.TextArea
          placeholder="复核批注（可选，记录专业判断、修改建议、风险提示等）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 5 }}
          size="small"
        />

        <Space>
          <Button
            type="primary"
            icon={
              decision === "accepting" ? <LoadingOutlined /> : <CheckOutlined />
            }
            loading={decision === "accepting"}
            onClick={handleAccept}
          >
            接受为设计选项
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={handleReject}
            disabled={decision === "accepting"}
          >
            驳回
          </Button>
        </Space>

        {createdOptionId && (
          <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            <Tag color="blue">已创建</Tag>
            设计选项 ID: {createdOptionId}
          </Paragraph>
        )}
      </Space>
    </div>
  );
}
