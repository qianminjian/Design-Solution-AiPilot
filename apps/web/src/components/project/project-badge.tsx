"use client";

import { Tag, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  LockOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  BuildOutlined,
  ShopOutlined,
  AppstoreOutlined,
  QuestionCircleOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import {
  getProjectStatusConfig,
  getBuildingTypeConfig,
  getStageStatusConfig,
  getGateStatusConfig,
  getGateDecisionConfig,
  isKnownProjectStatus,
  isKnownBuildingType,
  isKnownStageStatus,
  isKnownGateStatus,
  isKnownGateDecision,
  type ProjectStatus,
  type BuildingType,
  type StageStatus,
  type GateStatus,
  type GateDecision,
} from "./project-config";

/** 项目状态图标映射 */
const PROJECT_STATUS_ICONS: Record<string, ReactNode> = {
  active: <SyncOutlined spin />,
  on_hold: <PauseCircleOutlined />,
  completed: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  archived: <LockOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/** 建筑类型图标映射 */
const BUILDING_TYPE_ICONS: Record<string, ReactNode> = {
  office: <HomeOutlined />,
  residential: <BuildOutlined />,
  commercial: <ShopOutlined />,
  mixed: <AppstoreOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/** 阶段状态图标映射 */
const STAGE_STATUS_ICONS: Record<string, ReactNode> = {
  planned: <ClockCircleOutlined />,
  active: <SyncOutlined spin />,
  review_preparing: <SyncOutlined spin />,
  under_review: <SyncOutlined spin />,
  conditionally_approved: <CheckCircleOutlined />,
  approved: <CheckCircleOutlined />,
  suspended: <PauseCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  closed: <CheckCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/** 门禁状态图标映射 */
const GATE_STATUS_ICONS: Record<string, ReactNode> = {
  pending: <ClockCircleOutlined />,
  decided: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/** 门禁决策图标映射 */
const GATE_DECISION_ICONS: Record<string, ReactNode> = {
  approved: <CheckCircleOutlined />,
  conditionally_approved: <ExclamationCircleOutlined />,
  rework_required: <WarningOutlined />,
  suspended: <PauseCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

interface BadgeProps<T> {
  /** 后端返回的原始值（可能为未知枚举） */
  value: T | string | undefined | null;
}

/**
 * 项目状态标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function ProjectStatusBadge({ value }: BadgeProps<ProjectStatus>) {
  const config = getProjectStatusConfig(value);
  const isKnown = isKnownProjectStatus(value);
  const icon = PROJECT_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知项目状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 建筑类型标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function BuildingTypeBadge({ value }: BadgeProps<BuildingType>) {
  const config = getBuildingTypeConfig(value);
  const isKnown = isKnownBuildingType(value);
  const icon = BUILDING_TYPE_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知建筑类型：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 阶段状态标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function StageStatusBadge({ value }: BadgeProps<StageStatus>) {
  const config = getStageStatusConfig(value);
  const isKnown = isKnownStageStatus(value);
  const icon = STAGE_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知阶段状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 门禁状态标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function GateStatusBadge({ value }: BadgeProps<GateStatus>) {
  const config = getGateStatusConfig(value);
  const isKnown = isKnownGateStatus(value);
  const icon = GATE_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知门禁状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 门禁决策标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 *
 * 当 decision 为 null（未决策）时，调用方应改用 GateStatusBadge
 */
export function GateDecisionBadge({ value }: BadgeProps<GateDecision>) {
  const config = getGateDecisionConfig(value);
  const isKnown = isKnownGateDecision(value);
  const icon = GATE_DECISION_ICONS[config.iconKey];

  // 注意：null/undefined 时 value 是 falsy，归到 unknown 分支
  if (isKnown) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  if (!value) {
    return (
      <Tag icon={<MinusCircleOutlined />} color="default">
        未决策
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知决策结论：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}
