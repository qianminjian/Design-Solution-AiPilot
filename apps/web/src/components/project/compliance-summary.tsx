"use client";

import {
  Card,
  Row,
  Col,
  Tag,
  Progress,
  Typography,
  Empty,
  Space,
  Tooltip,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type React from "react";

const { Text } = Typography;

/** 合规检查结果摘要 */
export interface ComplianceSummaryData {
  /** 总规则数 */
  totalRules: number;
  /** 通过规则数 */
  passedRules: number;
  /** 失败规则数 */
  failedRules: number;
  /** 检查状态 */
  checkStatus: "completed" | "running" | "failed";
}

interface ComplianceSummaryProps {
  data: ComplianceSummaryData | null;
  loading?: boolean;
}

/** 检查状态配置项 */
interface CheckStatusConfigItem {
  color: string;
  label: string;
  icon: React.ElementType;
}

/** 检查状态配置 */
const CHECK_STATUS_CONFIG: Record<string, CheckStatusConfigItem> = {
  completed: { color: "green", label: "Completed", icon: CheckCircleOutlined },
  running: { color: "blue", label: "Running", icon: QuestionCircleOutlined },
  failed: { color: "red", label: "Failed", icon: CloseCircleOutlined },
};

/** 未知检查状态兜底配置 */
const CHECK_STATUS_FALLBACK: CheckStatusConfigItem = {
  color: "default",
  label: "未知",
  icon: QuestionCircleOutlined,
};

/**
 * 安全访问检查状态配置
 * 未知枚举值返回兜底配置，避免后端返回新枚举值时渲染崩溃
 */
function getCheckStatusConfig(
  status: string | undefined | null,
): CheckStatusConfigItem {
  if (status && status in CHECK_STATUS_CONFIG) {
    return CHECK_STATUS_CONFIG[status] as CheckStatusConfigItem;
  }
  return CHECK_STATUS_FALLBACK;
}

/** 判断是否为已知检查状态 */
function isKnownCheckStatus(status: string | undefined | null): boolean {
  return !!status && status in CHECK_STATUS_CONFIG;
}

/**
 * 合规检查结果汇总卡片
 * - 展示规则通过率、通过/失败数、检查状态
 * - 用于阶段门控页面的合规检查结果汇总区域
 */
export function ComplianceSummary({ data, loading }: ComplianceSummaryProps) {
  if (loading) {
    return (
      <Card size="small" loading>
        <div style={{ height: 120 }} />
      </Card>
    );
  }

  if (!data) {
    return <Empty description="暂无合规检查数据" />;
  }

  const passRate =
    data.totalRules > 0
      ? Math.round((data.passedRules / data.totalRules) * 100)
      : 0;
  const statusConfig = getCheckStatusConfig(data.checkStatus);
  const isKnown = isKnownCheckStatus(data.checkStatus);
  const StatusIcon = statusConfig.icon;

  const statusTag = (
    <Tag color={statusConfig.color} icon={<StatusIcon />}>
      {statusConfig.label}
    </Tag>
  );

  return (
    <Card size="small">
      <Row gutter={16} align="middle">
        <Col span={8}>
          <div style={{ textAlign: "center" }}>
            <Progress
              type="circle"
              percent={passRate}
              strokeColor={
                passRate >= 80
                  ? "#52c41a"
                  : passRate >= 50
                    ? "#faad14"
                    : "#ff4d4f"
              }
              size={80}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
              合规通过率
            </div>
          </div>
        </Col>
        <Col span={16}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isKnown || !data.checkStatus ? (
                statusTag
              ) : (
                <Tooltip title={`未知检查状态：${data.checkStatus}`}>
                  {statusTag}
                </Tooltip>
              )}
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>总规则</div>
                <Text strong style={{ fontSize: 20 }}>
                  {data.totalRules}
                </Text>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>通过</div>
                <Text strong style={{ fontSize: 20, color: "#52c41a" }}>
                  {data.passedRules}
                </Text>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>失败</div>
                <Text strong style={{ fontSize: 20, color: "#ff4d4f" }}>
                  {data.failedRules}
                </Text>
              </div>
            </div>
            {data.failedRules > 0 && (
              <div style={{ fontSize: 12, color: "#ff4d4f" }}>
                <CloseCircleOutlined /> 存在 {data.failedRules}{" "}
                项未通过规则，需关注
              </div>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
