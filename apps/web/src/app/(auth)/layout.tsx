"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";

const { Title, Text } = Typography;

/**
 * 认证路由组布局
 * - 全屏渐变背景，居中渲染子路由
 * - 不包含 Sider 导航
 * - 顶部展示品牌 Logo 与平台名称
 *
 * 注：antd Typography 依赖客户端 context，不能在 RSC 服务端组件中直接使用，
 * 因此本布局标记为客户端组件（修复 Title/Text 在 SSR 序列化为 undefined 的错误）。
 */
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #e6f4ff 0%, #f5f5f5 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "linear-gradient(135deg, #1677ff 0%, #4096ff 100%)",
          }}
        />
        <Title level={3} style={{ margin: 0 }}>
          AI Pilot
        </Title>
      </div>
      {children}
      <Text
        type="secondary"
        style={{
          marginTop: 32,
          fontSize: 12,
        }}
      >
        V1 技术试点 — 建筑专业纵向闭环
      </Text>
    </div>
  );
}
