'use client';

import { LogoutOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, Descriptions, Skeleton, Tag, Typography } from 'antd';
import { useAuth } from '@/lib/hooks/use-auth';

export default function SettingsPage() {
  const { message } = App.useApp();
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      message.success('已退出登录');
    } catch {
      message.error('退出失败，请重试');
    }
  };

  return (
    <main className="simple-page">
      <Card>
        <Typography.Title level={3}>个人设置</Typography.Title>
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : user ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="头像">
              <Avatar src={undefined}>{user.name.slice(0, 1)}</Avatar>
            </Descriptions.Item>
            <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
            <Descriptions.Item label="账号">
              <Tag color="blue">已登录</Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Paragraph type="secondary">未登录</Typography.Paragraph>
        )}
        <Button danger icon={<LogoutOutlined />} className="sidebar-action" onClick={handleLogout}>
          退出登录
        </Button>
      </Card>
    </main>
  );
}
