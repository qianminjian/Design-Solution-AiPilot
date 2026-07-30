"use client";

import { Card, Progress, Space, Spin, Typography, Empty, Alert } from "antd";
import {
  CheckCircleOutlined,
  FileSearchOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useCoverageSummary } from "@/hooks/use-requirements";
import { ApiError } from "@/lib/api-client";

const { Text } = Typography;

/** 判断是否为后端未实现错误 */
function isNotImplementedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 501;
  }
  return false;
}

interface CoverageSummaryBarProps {
  projectId: string;
}

/**
 * D37.7 P03 覆盖度汇总条（CoverageSummary）
 *
 * 显示项目需求覆盖度的 4 项关键指标：
 *  - 总需求数
 *  - 已批准数（Approved）
 *  - 已实现数（Implemented）
 *  - 覆盖率（已建立 TraceLink 的比例）
 *
 * 空状态：后端 API 未实现时显示骨架占位，不伪造数据
 */
export function CoverageSummaryBar({ projectId }: CoverageSummaryBarProps) {
  const {
    data: coverage,
    isLoading,
    isError,
    error,
  } = useCoverageSummary(projectId);

  return (
    <Card size="small" bodyStyle={{ padding: 12 }}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
          <Spin />
        </div>
      ) : isError && isNotImplementedError(error) ? (
        <Alert
          type="info"
          showIcon
          icon={<FileSearchOutlined />}
          message="覆盖率数据 API 待 V1 实现"
          description="CoverageSummary 后端接口尚未实现，下方指标以骨架占位展示。"
          style={{ background: "#f8fafc", border: "1px dashed #cbd5e1" }}
        />
      ) : isError ? (
        <Alert
          type="error"
          message="覆盖率加载失败"
          description={(error as Error)?.message ?? "请稍后重试"}
          showIcon
        />
      ) : coverage ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
          }}
        >
          {/* 总需求数 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FileSearchOutlined style={{ fontSize: 24, color: "#2563eb" }} />
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Total
              </Text>
              <Text strong style={{ fontSize: 18 }}>
                {coverage.totalRequirements}
              </Text>
            </Space>
          </div>

          {/* 已批准 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CheckCircleOutlined style={{ fontSize: 24, color: "#16a34a" }} />
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Approved
              </Text>
              <Text strong style={{ fontSize: 18 }}>
                {coverage.approvedCount}
              </Text>
            </Space>
          </div>

          {/* 已实现 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LinkOutlined style={{ fontSize: 24, color: "#0891b2" }} />
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Implemented
              </Text>
              <Text strong style={{ fontSize: 18 }}>
                {coverage.implementedCount}
              </Text>
            </Space>
          </div>

          {/* 覆盖率 */}
          <div style={{ minWidth: 160 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Coverage Rate
                </Text>
                <Text strong style={{ fontSize: 13 }}>
                  {(coverage.coverageRate * 100).toFixed(1)}%
                </Text>
              </div>
              <Progress
                percent={Math.round(coverage.coverageRate * 100)}
                size="small"
                status={
                  coverage.coverageRate >= 0.8
                    ? "success"
                    : coverage.coverageRate >= 0.5
                      ? "normal"
                      : "exception"
                }
              />
              <Text type="secondary" style={{ fontSize: 10 }}>
                {coverage.linkedCount} / {coverage.totalRequirements} linked
              </Text>
            </Space>
          </div>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无覆盖率数据"
        />
      )}
    </Card>
  );
}
