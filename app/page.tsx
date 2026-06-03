'use client';

import {
  BookOutlined,
  MessageOutlined,
  RocketOutlined,
  TeamOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Layout, Row, Space, Typography } from 'antd';
import Link from 'next/link';

const { Header, Content, Footer } = Layout;

export default function HomePage() {
  return (
    <Layout className="home-page">
      <Header className="home-header">
        <div className="home-header__inner">
          <Space size={8}>
            <span className="home-logo">知</span>
            <Typography.Text strong className="home-header__title">
              AI 知识库
            </Typography.Text>
          </Space>
          <Space size={16}>
            <Link href="/login">
              <Button type="text" className="home-header__btn">
                登录
              </Button>
            </Link>
            <Link href="/register">
              <Button type="primary">注册</Button>
            </Link>
          </Space>
        </div>
      </Header>

      <Content>
        <section className="home-hero">
          <Typography.Title level={1}>团队知识，智能问答</Typography.Title>
          <Typography.Paragraph type="secondary" className="home-hero__subtitle">
            上传文档、构建知识库，让 AI 基于真实资料回答问题，每个回答都有来源可追溯。
          </Typography.Paragraph>
          <Space size={16}>
            <Link href="/register">
              <Button type="primary" size="large" icon={<RocketOutlined />}>
                立即开始
              </Button>
            </Link>
            <Link href="/knowledge-bases">
              <Button size="large" icon={<BookOutlined />}>
                浏览知识库
              </Button>
            </Link>
          </Space>
        </section>

        <section className="home-features">
          <Row gutter={[32, 32]} justify="center">
            <Col xs={24} md={8}>
              <Card className="feature-card" hoverable>
                <BookOutlined className="feature-icon" />
                <Typography.Title level={4}>知识库管理</Typography.Title>
                <Typography.Paragraph type="secondary">
                  创建多个知识库，导入 PDF、Word、Excel、Markdown 等文档，自动解析并构建可检索的知识片段。
                </Typography.Paragraph>
                <Link href="/knowledge-bases">
                  <Button type="link">了解更多 →</Button>
                </Link>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" hoverable>
                <MessageOutlined className="feature-icon" />
                <Typography.Title level={4}>AI 智能问答</Typography.Title>
                <Typography.Paragraph type="secondary">
                  基于知识库内容进行对话，AI 自动检索相关段落，回答附带引用来源，可追溯到原文。
                </Typography.Paragraph>
                <Link href="/chat/kb_demo/conversation_1">
                  <Button type="link">开始对话 →</Button>
                </Link>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" hoverable>
                <TeamOutlined className="feature-icon" />
                <Typography.Title level={4}>团队协作</Typography.Title>
                <Typography.Paragraph type="secondary">
                  团队成员共享知识资产，统一的问答入口提升工作效率。
                </Typography.Paragraph>
                <Link href="/register">
                  <Button type="link">加入团队 →</Button>
                </Link>
              </Card>
            </Col>
          </Row>
        </section>

        <section className="home-advantages">
          <Row gutter={[24, 24]} justify="center">
            <Col xs={24} sm={8}>
              <Space direction="vertical" align="center" className="home-advantage">
                <SafetyOutlined className="home-advantage-icon" />
                <Typography.Text strong>数据安全</Typography.Text>
                <Typography.Text type="secondary">文档加密存储，权限精细控制</Typography.Text>
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <Space direction="vertical" align="center" className="home-advantage">
                <ThunderboltOutlined className="home-advantage-icon" />
                <Typography.Text strong>快速响应</Typography.Text>
                <Typography.Text type="secondary">毫秒级检索，流式输出回答</Typography.Text>
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <Space direction="vertical" align="center" className="home-advantage">
                <BookOutlined className="home-advantage-icon" />
                <Typography.Text strong>来源可溯</Typography.Text>
                <Typography.Text type="secondary">每个回答附带引用，可验证</Typography.Text>
              </Space>
            </Col>
          </Row>
        </section>
      </Content>

      <Footer className="home-footer">
        <Typography.Text type="secondary">AI 知识库智能问答平台 ©2026</Typography.Text>
      </Footer>
    </Layout>
  );
}
