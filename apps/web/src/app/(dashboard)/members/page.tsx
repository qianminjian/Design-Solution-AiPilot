import { Card, Empty, Typography } from "antd";

const { Title } = Typography;

/**
 * 成员管理页（占位）
 * 后续接入 GET /api/v1/iam/members 后替换为带角色/权限列的表格
 */
export default function MembersPage() {
  return (
    <Card>
      <Title level={3}>Members</Title>
      <Empty description="成员管理功能建设中" />
    </Card>
  );
}
