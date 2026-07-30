"use client";

import {
  Card,
  Descriptions,
  Tag,
  Typography,
  Empty,
  Button,
  Space,
  Alert,
} from "antd";
import {
  LinkOutlined,
  FileSearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { CheckResultDto } from "@design-platform/shared";
import { OUTCOME_LABEL, OUTCOME_TAG_COLOR } from "@design-platform/shared";

const { Text, Paragraph, Title } = Typography;

interface ResultDetailRailProps {
  result: CheckResultDto | null;
  onCreateIssue?: (result: CheckResultDto) => void;
  onStartException?: (result: CheckResultDto) => void;
}

/**
 * 结果详情栏（D37.12 中部 Viewer/文档条文的 V0 简化实现）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 正常状态：每结果显示规则/Edition/Clause、输入版本、对象、计算/断言、证据、engine release 和 reviewer
 * - Unknown/NotApplicable：显式原因与补充输入/专业判断路径，不并入 Pass
 * - 引用不可用：许可/版本/页码不可访问时保留 locator/hash 和访问申请，不展示编造摘要
 */
export function ResultDetailRail({
  result,
  onCreateIssue,
  onStartException,
}: ResultDetailRailProps) {
  if (!result) {
    return (
      <Card>
        <Empty
          description="请选择左侧结果树中的检查项以查看详情"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  const label = OUTCOME_LABEL[result.outcome] ?? result.outcome;
  const color = OUTCOME_TAG_COLOR[result.outcome] ?? "default";

  // Unknown/NotApplicable/Error 显式原因路径
  const needsExplanation =
    result.outcome === "INDETERMINATE" ||
    result.outcome === "NOT_APPLICABLE" ||
    result.outcome === "ERROR" ||
    result.outcome === "MANUAL_REVIEW";

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            结果详情
          </Title>
          <Tag color={color} icon={<FileSearchOutlined />}>
            {label}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<LinkOutlined />}
            disabled
            title="V0 阶段暂未接入 Issue API"
            onClick={() => onCreateIssue?.(result)}
          >
            创建 Issue
          </Button>
          <Button
            size="small"
            icon={<WarningOutlined />}
            disabled={result.outcome === "PASS"}
            onClick={() => onStartException?.(result)}
          >
            发起 Exception
          </Button>
        </Space>
      }
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="结果 ID">
          <Text code style={{ fontSize: 12 }}>
            {result.id}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="执行 ID">
          <Text code style={{ fontSize: 12 }}>
            {result.executionId}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="对象类型">
          {result.objectType ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="对象 ID">
          {result.objectId ? (
            <Text code style={{ fontSize: 12 }}>
              {result.objectId}
            </Text>
          ) : (
            "-"
          )}
        </Descriptions.Item>
        <Descriptions.Item label="测量值">
          {result.measuredValue ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="阈值">
          {result.threshold ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="结论">
          <Tag color={color}>{label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(result.createdAt).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">
          {result.createdBy ?? "-"}
        </Descriptions.Item>
      </Descriptions>

      {result.explanation && (
        <Card size="small" style={{ marginTop: 12 }} title="说明">
          <Paragraph style={{ marginBottom: 0 }}>
            {result.explanation}
          </Paragraph>
        </Card>
      )}

      {result.evidenceJson && (
        <Card size="small" style={{ marginTop: 12 }} title="证据 (Evidence)">
          <pre
            style={{
              background: "#f5f5f5",
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              margin: 0,
              overflowX: "auto",
            }}
          >
            {formatJson(result.evidenceJson)}
          </pre>
        </Card>
      )}

      {needsExplanation && !result.explanation && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${label} 状态需要补充说明`}
          description="根据 D37.12 规格，Unknown/NotApplicable/Error 状态需显式原因与补充输入/专业判断路径，不并入 Pass。当前结果未提供 explanation，建议补充后由人工复核。"
        />
      )}
    </Card>
  );
}

/** 格式化 JSON 字符串（容错处理） */
function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
