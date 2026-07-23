"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  theme,
  App,
  Input,
  Drawer,
} from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  GatewayOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuOutlined,
  SearchOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MonitorOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Logo } from "./logo";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface SiderMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
}

const SIDER_MENU_ITEMS: SiderMenuItem[] = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/projects", icon: <ProjectOutlined />, label: "Projects" },
  { key: "/stage-gate", icon: <GatewayOutlined />, label: "Stage Gate" },
  { key: "/review", icon: <CheckSquareOutlined />, label: "Review" },
  { key: "/documents", icon: <FileTextOutlined />, label: "Documents" },
  {
    key: "/golden-datasets",
    icon: <DatabaseOutlined />,
    label: "Golden Datasets",
  },
  { key: "/compliance-rules", icon: <SafetyCertificateOutlined />, label: "Compliance Rules" },
  { key: "/members", icon: <TeamOutlined />, label: "Members" },
  { key: "/monitoring", icon: <MonitorOutlined />, label: "Monitoring" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { data: auth } = useAuth();
  const logoutMutation = useLogout();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedKey = useMemo(() => {
    const match = SIDER_MENU_ITEMS.find(
      (item) => pathname === item.key || pathname.startsWith(`${item.key}/`),
    );
    return match?.key ?? "/dashboard";
  }, [pathname]);

  const userMenuItems: MenuProps["items"] = [
    { key: "profile", icon: <UserOutlined />, label: "Profile" },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "Logout", danger: true },
  ];

  const handleMenuClick: MenuProps["onClick"] = async ({ key }) => {
    if (key === "profile") {
      router.push("/settings");
      setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
  };

  const displayName = auth?.principal?.displayName ?? "Guest";

  const handleSearch = () => {
    if (searchValue.trim()) {
      router.push(`/projects?keyword=${encodeURIComponent(searchValue)}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        theme="dark"
        width={collapsed ? 64 : 220}
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        style={{ position: "sticky", top: 0, height: "100vh", zIndex: 100 }}
        breakpoint="lg"
        collapsedWidth={64}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 56,
            padding: "0 16px",
          }}
        >
          <Logo />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={SIDER_MENU_ITEMS as MenuProps["items"]}
          onClick={handleSiderSelect}
          aria-label="Main navigation"
          inlineCollapsed={collapsed}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 16px",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              style={{
                display: "none",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 8,
                color: token.colorText,
              }}
              aria-label="Toggle mobile menu"
              className="lg:hidden"
            >
              <MenuOutlined />
            </button>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索项目、文档..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={handleKeyPress}
              style={{ width: 280 }}
              aria-label="全局搜索"
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 8,
                color: token.colorText,
                position: "relative",
              }}
              aria-label="Notifications"
            >
              <BellOutlined />
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#dc2626",
                }}
              />
            </button>
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
                <Text className="hidden sm:inline">{displayName}</Text>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            padding: 24,
            background: token.colorBgLayout,
            minHeight: "calc(100vh - 56px)",
          }}
        >
          {children}
        </Content>
      </Layout>
      <Drawer
        title="Menu"
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width={240}
        style={{ zIndex: 1000 }}
        className="lg:hidden"
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={SIDER_MENU_ITEMS as MenuProps["items"]}
          onClick={handleSiderSelect}
          style={{ height: "100%", borderRight: 0 }}
        />
      </Drawer>
    </Layout>
  );
}
