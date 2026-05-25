'use client';

import { useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Space,
  Tag,
  Typography,
} from 'antd';
import { currentUser } from '@/data/mock';
import { cozeConfig } from '@/lib/coze-api';

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = async (values: {
    token: string;
    spaceId: string;
    botId: string;
  }) => {
    setSaving(true);
    try {
      cozeConfig.setToken(values.token);
      cozeConfig.setSpaceId(values.spaceId);
      cozeConfig.setBotId(values.botId);
      message.success('配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

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

      <Card style={{ marginTop: 16 }}>
        <Typography.Title level={4}>Coze API 配置</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          配置 Coze 平台的 API 凭证以启用知识库和 AI 对话功能。
          请在
          <a href="https://www.coze.cn" target="_blank" rel="noopener noreferrer">
            Coze 平台
          </a>
          获取相关凭证。
        </Typography.Text>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            token: cozeConfig.getToken(),
            spaceId: cozeConfig.getSpaceId(),
            botId: cozeConfig.getBotId(),
          }}
          onFinish={handleSave}
        >
          <Form.Item
            name="token"
            label="Access Token"
            rules={[{ required: true, message: '请输入 Access Token' }]}
            extra="在 Coze 开发者页面生成的个人访问令牌"
          >
            <Input.Password placeholder="pat_xxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="spaceId"
            label="工作空间 ID (Space ID)"
            extra="工作空间的唯一标识，可在 URL 中找到"
          >
            <Input placeholder="744632974166804****" />
          </Form.Item>

          <Form.Item
            name="botId"
            label="智能体 ID (Bot ID)"
            extra="要使用的智能体 ID，可在智能体开发页面 URL 中找到"
          >
            <Input placeholder="73428668********" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存配置
              </Button>
              <Button
                onClick={() => form.resetFields()}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Typography.Title level={4}>使用说明</Typography.Title>
        <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>访问 Coze 开发平台并登录账号</li>
          <li>进入开发者设置，生成个人访问令牌（Access Token）</li>
          <li>创建或选择一个工作空间，获取 Space ID</li>
          <li>创建或选择一个智能体，获取 Bot ID</li>
          <li>将上述信息填入上方表单并保存</li>
          <li>配置完成后即可使用知识库和 AI 对话功能</li>
        </ol>
      </Card>
    </main>
  );
}
