"use client";

import { Tree, Tag, Badge, Typography, Empty, Spin } from "antd";
import type { CheckResultDto } from "@design-platform/shared";
import { OUTCOME_LABEL, OUTCOME_TAG_COLOR } from "@design-platform/shared";
import type { DataNode } from "antd/es/tree";
import { useMemo } from "react";

const { Text } = Typography;

interface ResultTreeProps {
  results: CheckResultDto[];
  loading?: boolean;
  selectedKey?: string;
  onSelect?: (resultId: string) => void;
}

/** 按规则分组结果 */
interface GroupedResults {
  ruleKey: string;
  ruleLabel: string;
  results: CheckResultDto[];
}

/** 按 objectType 分组结果（V0 简化：以 objectType 作为规则近似） */
function groupResults(results: CheckResultDto[]): GroupedResults[] {
  const groups = new Map<string, GroupedResults>();
  for (const r of results) {
    const ruleKey = r.objectType ?? "未分类";
    if (!groups.has(ruleKey)) {
      groups.set(ruleKey, {
        ruleKey,
        ruleLabel: ruleKey,
        results: [],
      });
    }
    groups.get(ruleKey)?.results.push(r);
  }
  return Array.from(groups.values());
}

/** 构造 Ant Design Tree 数据节点 */
function buildTreeData(
  groups: GroupedResults[],
  selectedKey?: string,
): DataNode[] {
  return groups.map((group) => {
    const passCount = group.results.filter((r) => r.outcome === "PASS").length;
    const failCount = group.results.filter((r) => r.outcome === "FAIL").length;
    return {
      key: `group:${group.ruleKey}`,
      title: (
        <span
          style={{ display: "flex", alignItems: "center", gap: 8 }}
          aria-label={`规则组 ${group.ruleLabel}`}
        >
          <Text strong style={{ fontSize: 13 }}>
            {group.ruleLabel}
          </Text>
          <Badge
            count={group.results.length}
            style={{ backgroundColor: "#1677ff" }}
            size="small"
          />
          {failCount > 0 && (
            <Badge
              count={failCount}
              style={{ backgroundColor: "#ff4d4f" }}
              size="small"
            />
          )}
          {passCount > 0 && (
            <Badge
              count={passCount}
              style={{ backgroundColor: "#52c41a" }}
              size="small"
            />
          )}
        </span>
      ),
      children: group.results.map((r) => {
        const label = OUTCOME_LABEL[r.outcome] ?? r.outcome;
        const color = OUTCOME_TAG_COLOR[r.outcome] ?? "default";
        const isSelected = selectedKey === r.id;
        return {
          key: r.id,
          title: (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: isSelected ? "#e6f4ff" : "transparent",
                padding: "2px 6px",
                borderRadius: 4,
              }}
              aria-label={`检查结果 ${r.id.slice(0, 8)}`}
            >
              <Tag color={color} style={{ margin: 0, fontSize: 11 }}>
                {label}
              </Tag>
              <Text
                type="secondary"
                style={{ fontSize: 12, fontFamily: "monospace" }}
              >
                {r.objectId ? r.objectId.slice(0, 8) : r.id.slice(0, 8)}
              </Text>
              {r.measuredValue && (
                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                  {r.measuredValue}
                </Text>
              )}
            </span>
          ),
          isLeaf: true,
        };
      }),
    };
  });
}

/**
 * 结果树（D37.12 左侧规则/结果树）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 布局：左侧规则/结果树
 * - 正常状态：每结果显示规则/Edition/Clause、输入版本、对象
 */
export function ResultTree({
  results,
  loading,
  selectedKey,
  onSelect,
}: ResultTreeProps) {
  const groups = useMemo(() => groupResults(results), [results]);
  const treeData = useMemo(
    () => buildTreeData(groups, selectedKey),
    [groups, selectedKey],
  );
  const expandedKeys = useMemo(
    () => groups.map((g) => `group:${g.ruleKey}`),
    [groups],
  );

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin tip="加载结果树..." />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Empty description="暂无检查结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }

  return (
    <Tree
      treeData={treeData}
      defaultExpandedKeys={expandedKeys}
      selectedKeys={selectedKey ? [selectedKey] : []}
      onSelect={(keys) => {
        if (keys.length > 0) {
          const key = keys[0] as string;
          if (!key.startsWith("group:")) {
            onSelect?.(key);
          }
        }
      }}
      showLine
      blockNode
      aria-label="检查结果树"
    />
  );
}
