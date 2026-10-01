'use client';

import { GithubOutlined, GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { App, Button, Card, Divider, Form, Input, Typography } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getLoginRedirect } from '@/lib/routes';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登录成功');
      // 登录成功后跳转
      const from = searchParams.get('from');
      const redirectUrl = getLoginRedirect(from ?? undefined);
      // 使用 replace 避免返回按钮回到登录页
      router.replace(redirectUrl);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="auth-card">
      <Typography.Title level={2}>登录 AI 知识库</Typography.Title>
      <Typography.Paragraph type="secondary">进入团队知识问答工作台。</Typography.Paragraph>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
          <Input prefix={<MailOutlined />} placeholder="name@company.com" size="large" />
        </Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
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
  );
}

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
