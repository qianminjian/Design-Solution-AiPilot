"use client";

import { useState } from "react";
import { Alert, Empty, Segmented, Space, Table, Tag, Typography } from "antd";
import {
  ArrowRightOutlined,
  DiffOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
} from "@ant-design/icons";
import type { OutputDiffDto } from "@design-platform/shared";

const { Text, Paragraph, Title } = Typography;

/**
 * P09 中栏：Output Diff 展示
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13 §布局「输出 Diff」
 *
 * 功能：
 *  - 显示 AI 输出与基线的差异对比
 *  - 支持 text/json/structured 三种类型
 *  - 字段级 diff 表格（结构化数据）
 *  - 行级 diff（unified 格式，+/-/= 前缀）
 *
 * 安全红线：
 *  - 高风险输出只允许形成 Proposal/草稿
 *  - 字段级 diff 用于 Accept 时的责任确认（必须勾选 checklist）
 */

type DiffViewMode = "unified" | "field";

/** 渲染 unified diff 行 */
function UnifiedDiffView({ diff }: { diff: OutputDiffDto }) {
  if (!diff.hunks || diff.hunks.length === 0) {
    // 没有 hunks 时直接展示 before/after
    return (
      <div>
        {diff.before !== null && diff.before !== undefined && (
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>
              <MinusOutlined /> 旧版本
            </Text>
            <Paragraph
              style={{
                background: "#fff1f0",
                padding: 8,
                borderRadius: 4,
                fontSize: 11,
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                margin: "4px 0 0",
                border: "1px solid #ffa39e",
              }}
            >
              {diff.before}
            </Paragraph>
          </div>
        )}
        <div>
          <Text strong style={{ fontSize: 12 }}>
            <PlusOutlined /> AI 输出
          </Text>
          <Paragraph
            style={{
              background: "#f6ffed",
              padding: 8,
              borderRadius: 4,
              fontSize: 11,
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              margin: "4px 0 0",
              border: "1px solid #b7eb8f",
            }}
          >
            {diff.after}
          </Paragraph>
        </div>
      </div>
    );
  }

  // 渲染 hunks
  return (
    <div>
      {diff.hunks.map((hunk, hunkIdx) => (
        <div
          key={hunkIdx}
          style={{
            marginBottom: 12,
            border: "1px solid #f0f0f0",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              background: "#fafafa",
              fontSize: 11,
              color: "#666",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            @@ -{hunk.startLine},{hunk.lineCount} @@
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11 }}>
            {hunk.lines.map((line, lineIdx) => {
              const prefix = line.charAt(0);
              let bg = "#fff";
              let color = "#333";
              if (prefix === "+") {
                bg = "#f6ffed";
                color = "#52c41a";
              } else if (prefix === "-") {
                bg = "#fff1f0";
                color = "#ff4d4f";
              }
              return (
                <div
                  key={lineIdx}
                  style={{
                    background: bg,
                    color,
                    padding: "1px 8px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {line || " "}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 渲染字段级 diff 表格 */
function FieldDiffView({ diff }: { diff: OutputDiffDto }) {
  if (!diff.fieldDiffs || diff.fieldDiffs.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ fontSize: 12 }}>暂无字段级 diff</span>}
      />
    );
  }

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={diff.fieldDiffs.map((fd, idx) => ({ ...fd, key: idx }))}
      columns={[
        {
          title: "字段路径",
          dataIndex: "path",
          key: "path",
          width: 200,
          render: (path: string) => (
            <Text code style={{ fontSize: 11 }}>
              {path}
            </Text>
          ),
        },
        {
          title: "变更类型",
          dataIndex: "changeType",
          key: "changeType",
          width: 100,
          render: (changeType: string) => {
            const color =
              changeType === "added"
                ? "success"
                : changeType === "removed"
                  ? "error"
                  : "warning";
            const icon =
              changeType === "added" ? (
                <PlusOutlined />
              ) : changeType === "removed" ? (
                <MinusOutlined />
              ) : (
                <EditOutlined />
              );
            return (
              <Tag color={color} style={{ fontSize: 11 }}>
                {icon} {changeType}
              </Tag>
            );
          },
        },
        {
          title: "旧值",
          dataIndex: "oldValue",
          key: "oldValue",
          render: (val: string | null | undefined) =>
            val ? (
              <Text
                delete
                type="secondary"
                style={{ fontSize: 11, fontFamily: "monospace" }}
              >
                {val}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                —
              </Text>
            ),
        },
        {
          title: "新值",
          dataIndex: "newValue",
          key: "newValue",
          render: (val: string | null | undefined) =>
            val ? (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#52c41a",
                }}
              >
                {val}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                —
              </Text>
            ),
        },
      ]}
    />
  );
}

export interface OutputDiffViewerProps {
  /** diff 数据 */
  diff: OutputDiffDto | null;
}

export function OutputDiffViewer({ diff }: OutputDiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");

  if (!diff) {
    return (
      <Empty
        description={
          <span style={{ fontSize: 12 }}>
            暂无输出 Diff
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              本 Run 未产生可对比的输出 diff（如纯对话或查询类调用）
            </Text>
          </span>
        }
      />
    );
  }

  // 判断是否只有 fieldDiffs
  const hasHunks = (diff.hunks?.length ?? 0) > 0;
  const hasFieldDiffs = (diff.fieldDiffs?.length ?? 0) > 0;
  const effectiveMode: DiffViewMode =
    viewMode === "unified" && !hasHunks && hasFieldDiffs ? "field" : viewMode;

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          <DiffOutlined /> 输出 Diff
        </Title>
        <Space size={8}>
          <Tag style={{ fontSize: 10 }}>{diff.type}</Tag>
          {hasHunks && hasFieldDiffs && (
            <Segmented
              size="small"
              value={effectiveMode}
              onChange={(v) => setViewMode(v as DiffViewMode)}
              options={[
                { label: "行级", value: "unified" },
                { label: "字段级", value: "field" },
              ]}
            />
          )}
        </Space>
      </div>

      {diff.type === "structured" && hasFieldDiffs ? (
        effectiveMode === "field" ? (
          <FieldDiffView diff={diff} />
        ) : (
          <UnifiedDiffView diff={diff} />
        )
      ) : (
        <UnifiedDiffView diff={diff} />
      )}

      {/* 提示：AI 输出仅形成 Draft */}
      <Alert
        type="info"
        showIcon
        icon={<ArrowRightOutlined />}
        style={{ marginTop: 16 }}
        message={
          <span style={{ fontSize: 12 }}>AI 输出仅生成 Draft/Proposal</span>
        }
        description={
          <span style={{ fontSize: 11 }}>
            对齐 D37.13 §主动作：Accept 仅生成带来源的 Draft/Revision Proposal，
            不直接进入业务状态；需字段级 diff + 目标 ETag + 责任确认。
          </span>
        }
      />
    </div>
  );
}
