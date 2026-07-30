"use client";

import { Card, Statistic, Row, Col, Progress, Typography, Empty } from "antd";
import type { CheckResultDto } from "@design-platform/shared";
import { useMemo } from "react";

const { Text, Title } = Typography;

interface CoveragePanelProps {
  results: CheckResultDto[];
  loading?: boolean;
}

/** 结果状态分组计数 */
interface OutcomeCounts {
  total: number;
  pass: number;
  fail: number;
  notApplicable: number;
  indeterminate: number;
  error: number;
  manualReview: number;
}

/** 计算结果状态分布 */
function computeCounts(results: CheckResultDto[]): OutcomeCounts {
  const counts: OutcomeCounts = {
    total: results.length,
    pass: 0,
    fail: 0,
    notApplicable: 0,
    indeterminate: 0,
    error: 0,
    manualReview: 0,
  };
  for (const r of results) {
    switch (r.outcome) {
      case "PASS":
        counts.pass += 1;
        break;
      case "FAIL":
        counts.fail += 1;
        break;
      case "NOT_APPLICABLE":
        counts.notApplicable += 1;
        break;
      case "INDETERMINATE":
        counts.indeterminate += 1;
        break;
      case "ERROR":
        counts.error += 1;
        break;
      case "MANUAL_REVIEW":
        counts.manualReview += 1;
        break;
    }
  }
  return counts;
}

/**
 * 覆盖率面板（D37.12 CoveragePanel）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 正常状态：每结果显示规则/Edition/Clause、输入版本、对象、计算/断言、证据
 * - Unknown/NotApplicable：显式原因，不并入 Pass；覆盖率分母包含未执行/未知
 */
export function CoveragePanel({ results, loading }: CoveragePanelProps) {
  const counts = useMemo(() => computeCounts(results), [results]);

  if (loading) {
    return (
      <Card size="small" loading={loading}>
        <Empty description="加载中" />
      </Card>
    );
  }

  if (counts.total === 0) {
    return (
      <Card size="small">
        <Empty description="暂无检查结果" />
      </Card>
    );
  }

  // 覆盖率：已执行（PASS+FAIL）/ 总数，分母包含 Unknown/NotApplicable（按设计规格）
  const executed = counts.pass + counts.fail;
  const coveragePercent =
    counts.total > 0 ? Math.round((executed / counts.total) * 100) : 0;
  const passRate =
    counts.total > 0 ? Math.round((counts.pass / counts.total) * 100) : 0;

  return (
    <Card
      size="small"
      title={
        <span>
          <Title level={5} style={{ display: "inline", marginRight: 8 }}>
            覆盖率
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            分母含 Unknown / NotApplicable
          </Text>
        </span>
      }
    >
      <Row gutter={[8, 8]}>
        <Col span={12}>
          <Statistic
            title="总检查项"
            value={counts.total}
            valueStyle={{ fontSize: 20 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="覆盖率"
            value={coveragePercent}
            suffix="%"
            valueStyle={{ fontSize: 20, color: "#1677ff" }}
          />
        </Col>
      </Row>

      <Progress
        percent={coveragePercent}
        successPercent={Math.round((counts.pass / counts.total) * 100)}
        strokeColor={{ from: "#52c41a", to: "#1677ff" }}
        format={() => `${passRate}% PASS`}
        style={{ marginTop: 12 }}
      />

      <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Statistic
            title="通过"
            value={counts.pass}
            valueStyle={{ color: "#52c41a", fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="未通过"
            value={counts.fail}
            valueStyle={{ color: "#ff4d4f", fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="不适用"
            value={counts.notApplicable}
            valueStyle={{ color: "#8c8c8c", fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="无法判定"
            value={counts.indeterminate}
            valueStyle={{ color: "#faad14", fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="待复核"
            value={counts.manualReview}
            valueStyle={{ color: "#faad14", fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="异常"
            value={counts.error}
            valueStyle={{ color: "#ff4d4f", fontSize: 16 }}
          />
        </Col>
      </Row>
    </Card>
  );
}
