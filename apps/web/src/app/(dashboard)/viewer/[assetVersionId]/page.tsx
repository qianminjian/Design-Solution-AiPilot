"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Space,
  Tag,
  Tooltip,
  Typography,
  Segmented,
} from "antd";
import {
  ArrowLeftOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CompressOutlined,
  EyeOutlined,
  ColumnWidthOutlined,
  HighlightOutlined,
  ColumnHeightOutlined,
  ScissorOutlined,
  BgColorsOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { ModelTreePanel } from "@/components/viewer/model-tree-panel";
import { ViewerContextRail } from "@/components/viewer/viewer-context-rail";

const { Text } = Typography;

/** Viewer 主模式（D37.9） */
type ViewerMode =
  | "review"
  | "compare"
  | "issue"
  | "measure"
  | "section"
  | "markup"
  | "analysis";

const MODE_OPTIONS: {
  label: string;
  value: ViewerMode;
  icon: React.ReactNode;
}[] = [
  { label: "Review", value: "review", icon: <EyeOutlined /> },
  { label: "Compare", value: "compare", icon: <ColumnWidthOutlined /> },
  { label: "Issue", value: "issue", icon: <ExclamationCircleOutlined /> },
  { label: "Measure", value: "measure", icon: <ColumnHeightOutlined /> },
  { label: "Section", value: "section", icon: <ScissorOutlined /> },
  { label: "Markup", value: "markup", icon: <HighlightOutlined /> },
  { label: "Analysis", value: "analysis", icon: <BgColorsOutlined /> },
];

/**
 * P05 Viewer 页面（D37.9）
 *
 * 路由：/viewer/{assetVersionId}?viewpoint=&selection=
 *
 * 三栏布局（对齐 D37.9）：
 *  - 左侧 ModelTreePanel：对象树 / 图层
 *  - 中部 Viewer Canvas：工具栏 + 画布（V0 占位，待 V1 接入 3D SDK）
 *  - 右侧 ViewerContextRail：Properties / Issues / Rule/AI/Run
 *
 * V0 简化：
 *  - 不集成真实 3D SDK（Forge / Three.js），画布区域显示骨架占位
 *  - 工具栏按钮支持模式切换，但实际操作待 V1
 *  - 模型树与右侧面板展示骨架结构
 *  - 错误/降级（对齐 D37.9 §错误/降级）：
 *    WebGL/SDK/转换失败提供日志引用、重新加载、低保真/下载原件；
 *    不得显示空白画布。
 */
export default function ViewerPage({
  params,
}: {
  params: Promise<{ assetVersionId: string }>;
}) {
  const { assetVersionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewpoint = searchParams.get("viewpoint");
  const selection = searchParams.get("selection");

  const [mode, setMode] = useState<ViewerMode>("review");

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            style={{ paddingLeft: 0 }}
          >
            返回
          </Button>
          <Text code>assetVersionId: {assetVersionId}</Text>
          {viewpoint && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              viewpoint: {viewpoint.slice(0, 8)}...
            </Tag>
          )}
          {selection && (
            <Tag color="geekblue" style={{ fontSize: 11 }}>
              selection: {selection.split(",").length} 个对象
            </Tag>
          )}
        </Space>
        <Space>
          <Tooltip title="V0 阶段：下载原件功能待 V1 实现">
            <Button icon={<FileTextOutlined />} disabled>
              下载原件
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Viewer 3D 渲染引擎待 V1 接入"
        description="V0 阶段未集成 Forge / Three.js 等 3D SDK，下方画布以骨架占位展示。工具栏模式切换可用，但实际渲染与对象拾取需 V1 接入 SDK 后实现。"
      />

      {/* Viewer 工具栏（对齐 D37.9 §toolbar） */}
      <Card size="small" bodyStyle={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {/* 文件名 + 视图模式 */}
          <Space size="middle" wrap>
            <Text strong style={{ fontSize: 13 }}>
              Floor Plan - Level 3.rvt
            </Text>
            <Segmented
              size="small"
              value={mode}
              onChange={(val) => setMode(val as ViewerMode)}
              options={MODE_OPTIONS.map((opt) => ({
                label: (
                  <Space size={4}>
                    {opt.icon}
                    <span style={{ fontSize: 11 }}>{opt.label}</span>
                  </Space>
                ),
                value: opt.value,
              }))}
            />
          </Space>

          {/* 缩放与工具按钮 */}
          <Space size={4}>
            <Tooltip title="Zoom In">
              <Button
                size="small"
                type="text"
                icon={<ZoomInOutlined />}
                disabled
              />
            </Tooltip>
            <Tooltip title="Zoom Out">
              <Button
                size="small"
                type="text"
                icon={<ZoomOutOutlined />}
                disabled
              />
            </Tooltip>
            <Tooltip title="Fit to View">
              <Button
                size="small"
                type="text"
                icon={<CompressOutlined />}
                disabled
              />
            </Tooltip>
          </Space>
        </div>
      </Card>

      {/* 三栏布局：左侧模型树 + 中部画布 + 右侧 Context Rail */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 320px",
          gap: 12,
          minHeight: 540,
        }}
      >
        {/* 左侧：模型树 */}
        <ModelTreePanel />

        {/* 中部：Viewer 画布（V0 占位） */}
        <Card
          size="small"
          bodyStyle={{ padding: 0, position: "relative", minHeight: 540 }}
        >
          {/* 版本水印（D37.9 §Compare：只读并持续显示版本水印） */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              background: "rgba(15, 23, 42, 0.7)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            V1 · {assetVersionId.slice(0, 8)} · {mode.toUpperCase()}
          </div>

          {/* Canvas 占位区（V0） */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 540,
              background:
                "repeating-linear-gradient(0deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px)",
              gap: 12,
            }}
          >
            <PictureOutlined style={{ fontSize: 64, color: "#94a3b8" }} />
            <Space direction="vertical" align="center" size={4}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Viewer Canvas（V0 占位）
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                待 V1 接入 3D SDK 后渲染模型
              </Text>
            </Space>
            <Space size="small">
              <Tooltip title="V0：progressive load 待 V1">
                <Tag color="default" style={{ fontSize: 11 }}>
                  Progressive Load: N/A
                </Tag>
              </Tooltip>
              <Tooltip title="V0：LOD 待 V1">
                <Tag color="default" style={{ fontSize: 11 }}>
                  LOD: N/A
                </Tag>
              </Tooltip>
            </Space>
          </div>

          {/* 大模型状态条（D37.9 §大模型状态） */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              background: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: "6px 10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
            }}
          >
            <Space size="small">
              <ApartmentOutlined />
              <Text type="secondary" style={{ fontSize: 11 }}>
                已加载: 0 / 0 对象
              </Text>
            </Space>
            <Space size="small">
              <Tag color="warning" style={{ fontSize: 10 }}>
                V0 占位
              </Tag>
            </Space>
          </div>
        </Card>

        {/* 右侧：Context Rail */}
        <ViewerContextRail mode={mode} />
      </div>
    </Space>
  );
}
