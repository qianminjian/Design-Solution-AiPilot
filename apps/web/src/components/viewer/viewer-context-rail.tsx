"use client";

import {
  Card,
  Tabs,
  Empty,
  Typography,
  Tag,
  Descriptions,
  List,
  Button,
  Tooltip,
} from "antd";
import {
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

interface ViewerContextRailProps {
  mode: string;
}

/**
 * D37.9 P05 右侧 Context Rail
 *
 * 对齐 D37.9 §Context rail：
 *  - Properties（选中对象的属性）
 *  - Issues（关联的 Finding/Issue）
 *  - Rule/AI/Run（规则检查 / AI 复核 / 分析运行 结果叠加）
 *
 * V0 占位：3 个 Tab 显示骨架，待 V1 接入实际数据
 */
export function ViewerContextRail({ mode }: ViewerContextRailProps) {
  return (
    <Card size="small" style={{ height: "100%" }} bodyStyle={{ padding: 8 }}>
      <Tabs
        size="small"
        defaultActiveKey="properties"
        items={[
          {
            key: "properties",
            label: (
              <span>
                <InfoCircleOutlined /> Properties
              </span>
            ),
            children: (
              <div style={{ fontSize: 12 }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      选中对象后显示属性
                    </Text>
                  }
                  style={{ padding: 24 }}
                />
                <Descriptions
                  size="small"
                  column={1}
                  labelStyle={{ fontSize: 11, width: 80 }}
                  contentStyle={{ fontSize: 11 }}
                >
                  <Descriptions.Item label="Type">—</Descriptions.Item>
                  <Descriptions.Item label="Category">—</Descriptions.Item>
                  <Descriptions.Item label="Level">—</Descriptions.Item>
                  <Descriptions.Item label="Material">—</Descriptions.Item>
                  <Descriptions.Item label="Dimensions">—</Descriptions.Item>
                </Descriptions>
              </div>
            ),
          },
          {
            key: "issues",
            label: (
              <span>
                <ExclamationCircleOutlined /> Issues
                <Tag color="red" style={{ fontSize: 10, marginLeft: 4 }}>
                  0
                </Tag>
              </span>
            ),
            children: (
              <div style={{ fontSize: 12 }}>
                {mode === "issue" && (
                  <Tooltip title="V0 阶段：创建 Issue 待 V1">
                    <Button
                      block
                      size="small"
                      icon={<PlusOutlined />}
                      disabled
                      style={{ marginBottom: 8 }}
                    >
                      从选择创建 Issue
                    </Button>
                  </Tooltip>
                )}
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      暂无关联 Issue
                    </Text>
                  }
                  style={{ padding: 24 }}
                />
              </div>
            ),
          },
          {
            key: "rule-ai-run",
            label: (
              <span>
                <SafetyCertificateOutlined /> Rule/AI/Run
              </span>
            ),
            children: (
              <div style={{ fontSize: 12 }}>
                <List
                  size="small"
                  dataSource={[]}
                  renderItem={() => null}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            暂无叠加结果
                          </Text>
                        }
                        style={{ padding: 16 }}
                      />
                    ),
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <Tooltip title="V0 阶段：规则检查叠加待 V1">
                    <Button
                      block
                      size="small"
                      icon={<SafetyCertificateOutlined />}
                      disabled
                    >
                      运行规则检查
                    </Button>
                  </Tooltip>
                  <Tooltip title="V0 阶段：AI 复核待 V1">
                    <Button
                      block
                      size="small"
                      icon={<RobotOutlined />}
                      disabled
                    >
                      发起 AI 复核
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
