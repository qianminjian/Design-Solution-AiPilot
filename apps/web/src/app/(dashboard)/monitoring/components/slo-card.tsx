"use client";

import { Card, Descriptions, Progress, Space, Tag, Typography } from "antd";
import type { SloTargetDto } from "@design-platform/shared";
import { SLO_STATUS_COLOR, SLO_STATUS_LABEL } from "@design-platform/shared";

const { Text } = Typography;

/**
 * SLO 卡片（D37.17 SLO 影响视图）
 *
 * 展示单个 SLO 目标的实时状态：
 *  - 可用率目标 vs 当前可用率
 *  - 错误预算剩余（负值显示超支）
 *  - 24h 请求/错误数（颜色分级：>1000 红 / >100 黄 / 其他绿）
 *  - p95/p99 延迟
 *  - 错误预算剩余进度条（<0 红 / <30 黄 / 其他绿）
 */
export function SloCard({ slo }: { slo: SloTargetDto }) {
  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <Text strong>{slo.name}</Text>
          <Tag color={SLO_STATUS_COLOR[slo.status]}>
            {SLO_STATUS_LABEL[slo.status]}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="可用率目标">
            {slo.availabilityTarget}%
          </Descriptions.Item>
          <Descriptions.Item label="当前可用率">
            <span
              style={{
                color:
                  slo.availabilityCurrent >= slo.availabilityTarget
                    ? "#52c41a"
                    : "#ff4d4f",
                fontWeight: 600,
              }}
            >
              {slo.availabilityCurrent}%
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="错误预算">
            {slo.errorBudgetRemaining >= 0 ? (
              <Text type="success">剩余 {slo.errorBudgetRemaining}%</Text>
            ) : (
              <Text type="danger">超支 {-slo.errorBudgetRemaining}%</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="24h 请求数">
            {slo.requestCount24h.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="24h 错误数">
            <span
              style={{
                color:
                  slo.errorCount24h > 1000
                    ? "#ff4d4f"
                    : slo.errorCount24h > 100
                      ? "#faad14"
                      : "#52c41a",
              }}
            >
              {slo.errorCount24h.toLocaleString()}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="p95 / p99 延迟">
            <Text>
              {slo.p95LatencyMs} / {slo.p99LatencyMs} ms
            </Text>
          </Descriptions.Item>
        </Descriptions>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            错误预算剩余
          </Text>
          <Progress
            percent={Math.max(0, slo.errorBudgetRemaining)}
            size="small"
            status={
              slo.errorBudgetRemaining < 0
                ? "exception"
                : slo.errorBudgetRemaining < 30
                  ? "active"
                  : "success"
            }
          />
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          最后更新: {new Date(slo.updatedAt).toLocaleString("zh-CN")}
        </Text>
      </Space>
    </Card>
  );
}
