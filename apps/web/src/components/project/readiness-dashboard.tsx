"use client";

import { Card, Typography, Space, Tag, Alert, Tooltip, Progress } from "antd";
import {
  GatewayOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { StageInstanceDto } from "@design-platform/shared";

const { Text, Paragraph } = Typography;

/**
 * Readiness 指标卡（对齐 D37.7 P02 项目驾驶舱）
 *
 * 每卡展示（D37.7 正常状态规格）：
 *  - 分子/分母
 *  - 来源
 *  - 更新时间
 *  - 阻塞对象
 *  - 责任人
 *
 * V0 简化：后端聚合 API 未就位，每卡显示"待 V1 接入"占位，
 *        不伪造 0% 仪表盘（D37.7 空状态红线"不伪造 0% 仪表盘"）。
 */
interface ReadinessMetric {
  /** 指标键 */
  key: string;
  /** 指标名 */
  label: string;
  /** 图标 */
  icon: React.ReactNode;
  /** 主色 */
  color: string;
  /** V0 占位说明 */
  placeholder: string;
}

const READINESS_METRICS: ReadinessMetric[] = [
  {
    key: "stage",
    label: "Stage Progress",
    icon: <ApartmentOutlined />,
    color: "#2563eb",
    placeholder: "阶段完成度（D05）",
  },
  {
    key: "gate",
    label: "Gate Readiness",
    icon: <GatewayOutlined />,
    color: "#d97706",
    placeholder: "门禁通过率（D05）",
  },
  {
    key: "baseline",
    label: "Baseline Freeze",
    icon: <SafetyCertificateOutlined />,
    color: "#0891b2",
    placeholder: "基线冻结状态（D05）",
  },
  {
    key: "publication",
    label: "Publication Readiness",
    icon: <SendOutlined />,
    color: "#16a34a",
    placeholder: "发布就绪度（D11/D18）",
  },
];

interface ReadinessDashboardProps {
  /** 阶段列表（用于判断是否显示配置向导空状态） */
  stages: StageInstanceDto[];
  /** 项目 ID（用于配置向导跳转） */
  projectId: string;
}

/**
 * Readiness 仪表盘组件（V0 对齐 D37.7 P02 项目驾驶舱）
 *
 * 布局：
 *  - 4 个 readiness 指标卡（Stage/Gate/Baseline/Publication）
 *  - 配置向导（V0：stages 为空时显示）
 *  - 部分/陈旧状态提示（V0：占位，V1 接入水位检测后启用）
 *
 * V0 限制：
 *  - 后端无 readiness 聚合 API，每卡显示"待 V1 接入"占位
 *  - 不伪造 0% 仪表盘（D37.7 空状态红线）
 *  - 配置向导显示 5 步：项目基准→团队→阶段→需求→CDE
 */
export function ReadinessDashboard({
  stages,
  projectId: _projectId,
}: ReadinessDashboardProps) {
  const hasStages = stages.length > 0;

  return (
    <Card
      size="small"
      title={
        <Space size="small">
          <Text strong>项目驾驶舱</Text>
          <Tooltip title="D37.7 P02 Readiness 仪表盘：每项指标显示分子/分母、来源、更新时间、阻塞对象与责任人。V0 后端聚合 API 未就位，下方卡片为占位状态，不伪造数据。">
            <InfoCircleOutlined style={{ color: "#64748b" }} />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 4 个 readiness 指标卡 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {READINESS_METRICS.map((metric) => (
            <div
              key={metric.key}
              style={{
                padding: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space size="small">
                  <span style={{ color: metric.color }}>{metric.icon}</span>
                  <Text strong style={{ fontSize: 13 }}>
                    {metric.label}
                  </Text>
                </Space>
                <Tag color="default" style={{ fontSize: 11 }}>
                  {metric.placeholder}
                </Tag>
                <Progress
                  percent={0}
                  size="small"
                  status="normal"
                  strokeColor={metric.color}
                />
                <Text
                  type="secondary"
                  style={{ fontSize: 11, fontStyle: "italic" }}
                >
                  数据源待 V1 接入
                </Text>
              </Space>
            </div>
          ))}
        </div>

        {/* 配置向导（V0：stages 为空时显示） */}
        {!hasStages && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="项目尚未完成初始化配置"
            description={
              <Space direction="vertical" size={4}>
                <Text style={{ fontSize: 13 }}>
                  按以下顺序完成配置（对齐 D37.7 P02 空状态规格）：
                </Text>
                <Space size="small" wrap>
                  <Tag color="blue">1. 项目基准</Tag>
                  <Tag color="blue">2. 团队成员</Tag>
                  <Tag color="blue">3. 阶段定义</Tag>
                  <Tag color="blue">4. 需求基线</Tag>
                  <Tag color="blue">5. CDE 文档库</Tag>
                </Space>
              </Space>
            }
          />
        )}

        {/* 部分/陈旧状态提示（V0 占位，V1 接入水位检测后启用） */}
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="指标水位一致性检测"
          description={
            <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
              V1 接入后将检测各 readiness
              项水位一致性：水位不一致时禁止汇总成单一
              &ldquo;就绪&rdquo;，显示缺失域和可否继续（对齐 D37.7
              部分/陈旧状态红线）。 Gate 审查期间 Baseline
              变化时冻结旧审查并提示重建/差异，不自动指向 latest。
            </Paragraph>
          }
        />
      </Space>
    </Card>
  );
}
