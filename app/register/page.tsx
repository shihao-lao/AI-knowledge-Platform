'use client';

import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { knowledgePath } from '@/lib/paths';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Typography.Title level={2}>创建团队账号</Typography.Title>
        <Typography.Paragraph type="secondary">开始上传文档并构建可信问答。</Typography.Paragraph>
        <Form layout="vertical" onFinish={() => router.push(knowledgePath())}>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input prefix={<UserOutlined />} size="large" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} size="large" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '至少 8 位密码' }]}>
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
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
