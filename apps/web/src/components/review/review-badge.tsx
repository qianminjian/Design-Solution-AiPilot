"use client";

import { Tag, Tooltip } from "antd";
import {
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import {
  getSeverityConfig,
  getFindingStatusConfig,
  getCheckResultStatusConfig,
  isKnownSeverity,
  isKnownFindingStatus,
  isKnownCheckResultStatus,
  type FindingSeverity,
  type FindingStatus,
  type CheckResultStatus,
} from "./review-config";

/**
 * 严重级别图标映射
 * 关键值：critical/high/medium/low 对应原 finding-list 的图标风格
 */
const SEVERITY_ICONS: Record<string, ReactNode> = {
  critical: <WarningOutlined />,
  high: <WarningOutlined />,
  medium: <InfoCircleOutlined />,
  low: <CheckCircleOutlined />,
  unknown: <InfoCircleOutlined />,
};

/**
 * 发现状态图标映射
 */
const FINDING_STATUS_ICONS: Record<string, ReactNode> = {
  pending: <ClockCircleOutlined />,
  approved: <CheckCircleOutlined />,
  rejected: <CloseCircleOutlined />,
  resolved: <CheckCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/**
 * 检查结果状态图标映射
 */
const CHECK_RESULT_STATUS_ICONS: Record<string, ReactNode> = {
  passed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  partial: <MinusCircleOutlined />,
  running: <QuestionCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

interface BadgeProps<T> {
  /** 后端返回的原始值（可能为未知枚举） */
  value: T | string | undefined | null;
}

/**
 * 严重级别标签
 *
 * - 已知枚举：显示对应颜色与中文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function SeverityBadge({ value }: BadgeProps<FindingSeverity>) {
  const config = getSeverityConfig(value);
  const isKnown = isKnownSeverity(value);
  const icon = SEVERITY_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知严重级别：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 发现状态标签
 *
 * - 已知枚举：显示对应颜色与中文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function FindingStatusBadge({ value }: BadgeProps<FindingStatus>) {
  const config = getFindingStatusConfig(value);
  const isKnown = isKnownFindingStatus(value);
  const icon = FINDING_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 检查结果状态标签
 *
 * - 已知枚举：显示对应颜色与中文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function CheckResultStatusBadge({
  value,
}: BadgeProps<CheckResultStatus>) {
  const config = getCheckResultStatusConfig(value);
  const isKnown = isKnownCheckResultStatus(value);
  const icon = CHECK_RESULT_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知检查结果状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}
