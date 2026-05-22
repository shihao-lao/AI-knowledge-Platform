'use client';

import { Avatar, Card, Descriptions, Tag, Typography } from 'antd';
import { currentUser } from '@/data/mock';

export default function SettingsPage() {
  return (
    <main className="simple-page">
      <Card>
        <Typography.Title level={3}>个人设置</Typography.Title>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="头像">
            <Avatar src={currentUser.avatar}>{currentUser.name.slice(0, 1)}</Avatar>
          </Descriptions.Item>
          <Descriptions.Item label="姓名">{currentUser.name}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{currentUser.email}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color="blue">{currentUser.role.toUpperCase()}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </main>
  );
}
