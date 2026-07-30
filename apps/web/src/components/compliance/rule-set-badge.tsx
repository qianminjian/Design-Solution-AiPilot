"use client";

import { Tag, Tooltip, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface RuleSetBadgeProps {
  ruleSetId?: string | null;
  /** 是否显示完整 ID（默认仅显示前 8 位） */
  fullId?: boolean;
}

/**
 * 规则集徽章（D37.12 RuleSetBadge）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 核心组件：RuleSetBadge
 * - 正常状态：显示规则/Edition/Clause
 *
 * V0 简化实现：
 * - ruleSetId 可能为 null（未关联规则集）
 * - 完整规则集管理界面待 V1 实现
 */
export function RuleSetBadge({ ruleSetId, fullId = false }: RuleSetBadgeProps) {
  if (!ruleSetId) {
    return (
      <Tag color="default" icon={<SafetyCertificateOutlined />}>
        未关联规则集
      </Tag>
    );
  }

  const displayId = fullId ? ruleSetId : ruleSetId.slice(0, 8) + "...";

  return (
    <Tooltip
      title={
        <div>
          <div>规则集 ID</div>
          <Text code style={{ color: "#fff" }} copyable>
            {ruleSetId}
          </Text>
        </div>
      }
      placement="top"
    >
      <Tag
        color="blue"
        icon={<SafetyCertificateOutlined />}
        style={{ cursor: "help" }}
      >
        规则集 {displayId}
      </Tag>
    </Tooltip>
  );
}
