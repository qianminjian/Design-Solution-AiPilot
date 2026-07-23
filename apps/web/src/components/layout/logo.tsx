import { Typography } from "antd";

const { Text } = Typography;

/**
 * Logo 组件
 * 左侧导航顶部品牌标识，使用 Ant Design Token 主色
 */
export function Logo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 56,
        padding: "0 16px",
        gap: 8,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "linear-gradient(135deg, #1677ff 0%, #4096ff 100%)",
          flexShrink: 0,
        }}
      />
      <Text
        strong
        style={{ color: "#fff", fontSize: 16, whiteSpace: "nowrap" }}
      >
        AI Pilot
      </Text>
    </div>
  );
}
