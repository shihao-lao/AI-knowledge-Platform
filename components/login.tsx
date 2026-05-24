'use client';

import { GithubOutlined, GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Card, Divider, Form, Input, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { defaultKnowledgePath } from '@/lib/paths';

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Typography.Title level={2}>登录 AI 知识库</Typography.Title>
        <Typography.Paragraph type="secondary">进入团队知识问答工作台。</Typography.Paragraph>
        <Form layout="vertical" onFinish={() => router.push(defaultKnowledgePath())}>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="name@company.com" size="large" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            登录
          </Button>
        </Form>
        <Divider>或</Divider>
        <div className="auth-actions">
          <Button icon={<GithubOutlined />} block>
            GitHub
          </Button>
          <Button icon={<GoogleOutlined />} block>
            Google
          </Button>
        </div>
        <Typography.Paragraph className="auth-footer">
          还没有账号？<Link href="/register">注册</Link>
        </Typography.Paragraph>
      </Card>
    </main>
  );
}
