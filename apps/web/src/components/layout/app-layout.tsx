"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Avatar, Dropdown, Typography, theme, App } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Logo } from "./logo";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/** 侧边栏菜单项定义（key 为路由路径，用于导航跳转与高亮匹配） */
interface SiderMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
}

const SIDER_MENU_ITEMS: SiderMenuItem[] = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/projects", icon: <ProjectOutlined />, label: "Projects" },
  { key: "/members", icon: <TeamOutlined />, label: "Members" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

/**
 * 应用主布局
 * - Sider：Logo + 主导航菜单
 * - Header：用户头像 + 下拉菜单（Profile / Logout）
 * - Content：子路由渲染区
 *
 * 使用 Ant Design Layout 组件，遵循 WCAG 2.2 AA：
 * - Menu 默认 WAI-ARIA 完整
 * - Dropdown 提供键盘可达的菜单
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { data: auth } = useAuth();
  const logoutMutation = useLogout();
  const [logoutLoading, setLogoutLoading] = useState(false);

  // 当前选中的菜单项（取路径首段以支持子路由高亮）
  const selectedKey = useMemo(() => {
    const match = SIDER_MENU_ITEMS.find(
      (item) => pathname === item.key || pathname.startsWith(`${item.key}/`),
    );
    return match?.key ?? "/dashboard";
  }, [pathname]);

  // 头像下拉菜单
  const userMenuItems: MenuProps["items"] = [
    { key: "profile", icon: <UserOutlined />, label: "Profile" },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "Logout", danger: true },
  ];

  const handleMenuClick: MenuProps["onClick"] = async ({ key }) => {
    if (key === "profile") {
      router.push("/settings");
    } else if (key === "logout") {
      setLogoutLoading(true);
      try {
        await logoutMutation.mutateAsync();
        message.success("已退出登录");
        router.push("/login");
      } catch (error) {
        const tip =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "退出登录失败";
        message.error(tip);
      } finally {
        setLogoutLoading(false);
      }
    }
  };

  const handleSiderSelect: MenuProps["onClick"] = ({ key }) => {
    router.push(key);
  };

  // 优先展示真实用户名，缺失时降级为 Guest
  const displayName = auth?.principal?.displayName ?? "Guest";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        theme="dark"
        width={220}
        style={{ position: "sticky", top: 0, height: "100vh" }}
      >
        <Logo />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={SIDER_MENU_ITEMS as MenuProps["items"]}
          onClick={handleSiderSelect}
          aria-label="Main navigation"
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "0 24px",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Dropdown
            menu={{ items: userMenuItems, onClick: handleMenuClick }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 8px",
                height: "100%",
              }}
              aria-label="User menu"
              disabled={logoutLoading}
            >
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>{displayName}</Text>
            </button>
          </Dropdown>
        </Header>
        <Content
          style={{
            padding: 24,
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
