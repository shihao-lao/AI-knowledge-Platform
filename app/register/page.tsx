'use client';

import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { ROUTES } from '@/lib/routes';

export default function RegisterPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { name: string; email: string; password: string }) => {
    setLoading(true);
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
      message.success('注册成功，已自动登录');
      router.push(ROUTES.KNOWLEDGE_BASES);
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Typography.Title level={2}>创建账号</Typography.Title>
        <Typography.Paragraph type="secondary">开始上传文档并构建可信问答。</Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不超过 50 字符' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="你的昵称" size="large" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="name@example.com" size="large" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            注册
          </Button>
        </Form>
        <Typography.Paragraph className="auth-footer">
          已有账号？<Link href="/login">登录</Link>
        </Typography.Paragraph>
      </Card>
    </main>
  );
}
