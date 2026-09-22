'use client';

import {
  BookOutlined,
  EditOutlined,
  FileSearchOutlined,
  MessageOutlined,
  RocketOutlined,
  SolutionOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Layout, Row, Space, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { ROUTES } from '@/lib/routes';

const { Header, Content, Footer } = Layout;

const features = [
  {
    icon: <BookOutlined />,
    title: '智能知识库',
    desc: '上传 PDF/Word/Markdown 文档，AI 自动解析、语义索引，让资料变成可对话的知识资产。',
    href: ROUTES.KNOWLEDGE_BASES,
  },
  {
    icon: <MessageOutlined />,
    title: 'AI 面试官',
    desc: '模拟真实面试：AI 出题、追问、点评，每次回答后附参考答案与评分，帮你查漏补缺。',
    href: ROUTES.LOGIN,
  },
  {
    icon: <EditOutlined />,
    title: '刷题练习',
    desc: '结构化题库（类目/难度/关键词），作答即时评估打分，遗漏要点清晰标注。',
    href: ROUTES.LOGIN,
  },
  {
    icon: <FileSearchOutlined />,
    title: '简历诊断',
    desc: '上传简历，AI 从 HR 视角全面分析：评分、优势亮点、问题不足、改进建议、面试追问预测。',
    href: ROUTES.LOGIN,
  },
  {
    icon: <TrophyOutlined />,
    title: '掌握度追踪',
    desc: '按技术类目和难度统计正确率，直观掌握薄弱环节，针对性强化复习。',
    href: ROUTES.LOGIN,
  },
  {
    icon: <SolutionOutlined />,
    title: '引用溯源',
    desc: '每次回答标注资料来源，[1][2] 标记一键跳转原文，面试准备有据可依。',
    href: ROUTES.KNOWLEDGE_BASES,
  },
];

const stats = [
  { number: '512 维', label: '中文语义向量' },
  { number: 'BM25', label: '全文检索融合' },
  { number: 'SSE', label: '毫秒级流式回答' },
  { number: '0 依赖', label: '本地模型零 API 费用' },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // 已登录用户自动跳转到知识库页
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(ROUTES.KNOWLEDGE_BASES);
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 认证检查中或已登录待跳转时，不渲染落地页内容
  if (loading || isAuthenticated) return null;

  return (
    <Layout className="home-page">
      {/* ── Header ── */}
      <Header className={`home-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="home-header__inner">
          <Link href={ROUTES.HOME} className="home-brand">
            <span className="home-logo">知</span>
            <Typography.Text strong>面试通</Typography.Text>
          </Link>
          <nav className="home-nav">
            <a href="#features">功能</a>
            <a href="#highlights">亮点</a>
          </nav>
          <Space size={12}>
            <Link href={ROUTES.LOGIN}>
              <Button type="text">登录</Button>
            </Link>
            <Link href={ROUTES.REGISTER}>
              <Button type="primary" shape="round">
                免费注册
              </Button>
            </Link>
          </Space>
        </div>
      </Header>

      <Content>
        {/* ── Hero ── */}
        <section className="home-hero">
          <div className="home-hero__badge">
            <span>🤖</span> AI 驱动的面试备考助手
          </div>
          <Typography.Title level={1} className="home-hero__title">
            面试不再靠运气
            <br />
            <span className="home-hero__gradient">AI 帮你精准准备</span>
          </Typography.Title>
          <Typography.Paragraph className="home-hero__subtitle">
            上传资料、导入题库、模拟面试、练习评估、简历诊断——
            <br className="hide-mobile" />
            一套工具解决面试备考全链路，让每次准备都有据可依。
          </Typography.Paragraph>
          <Space size={16} className="home-hero__actions">
            <Link href={ROUTES.REGISTER}>
              <Button type="primary" size="large" shape="round" icon={<RocketOutlined />}>
                立即开始，免费使用
              </Button>
            </Link>
            <Link href={ROUTES.KNOWLEDGE_BASES}>
              <Button size="large" shape="round" icon={<BookOutlined />}>
                浏览知识库
              </Button>
            </Link>
          </Space>

          {/* 产品截图占位 */}
          <div className="home-hero__visual">
            <div className="home-hero__mockup">
              <div className="mockup-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="mockup-body">
                <div className="mockup-sidebar">
                  <div className="mockup-nav-item active" />
                  <div className="mockup-nav-item" />
                  <div className="mockup-nav-item" />
                  <div className="mockup-nav-item" />
                </div>
                <div className="mockup-main">
                  <div className="mockup-msg ai" />
                  <div className="mockup-msg user" />
                  <div className="mockup-msg ai long" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="home-stats">
          <Row gutter={[32, 16]} justify="center">
            {stats.map((s) => (
              <Col key={s.label} xs={12} sm={6}>
                <div className="home-stat">
                  <Typography.Text strong className="home-stat__number">
                    {s.number}
                  </Typography.Text>
                  <Typography.Text type="secondary">{s.label}</Typography.Text>
                </div>
              </Col>
            ))}
          </Row>
        </section>

        {/* ── Features ── */}
        <section className="home-features" id="features">
          <div className="section-header">
            <Typography.Title level={2}>覆盖面试备考全场景</Typography.Title>
            <Typography.Paragraph type="secondary">
              从资料整理到模拟面试，从刷题练习到简历优化，一个平台全搞定。
            </Typography.Paragraph>
          </div>
          <Row gutter={[24, 24]}>
            {features.map((f) => (
              <Col key={f.title} xs={24} sm={12} lg={8}>
                <Link href={f.href} className="feature-card-link">
                  <Card className="feature-card" hoverable>
                    <div className="feature-card__icon">{f.icon}</div>
                    <Typography.Title level={5}>{f.title}</Typography.Title>
                    <Typography.Paragraph type="secondary">{f.desc}</Typography.Paragraph>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </section>

        {/* ── Highlights ── */}
        <section className="home-highlights" id="highlights">
          <div className="section-header">
            <Typography.Title level={2}>为什么选择面试通</Typography.Title>
          </div>
          <Row gutter={[48, 32]} align="middle">
            <Col xs={24} md={12}>
              <div className="highlight-text">
                <Typography.Title level={3}>真实语义，不只是关键词匹配</Typography.Title>
                <Typography.Paragraph type="secondary">
                  基于 BGE 中文大模型 512 维语义向量 + BM25 全文检索双路融合， "闭包"和"作用域链"能匹配、"Event
                  Loop"和"事件循环"能关联—— 这是传统关键词搜索做不到的。
                </Typography.Paragraph>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="highlight-visual">
                <div className="highlight-card">
                  <div className="highlight-card__row">
                    <span className="highlight-tag">查询</span>
                    <span>闭包是什么？</span>
                  </div>
                  <div className="highlight-card__arrow">→</div>
                  <div className="highlight-card__row">
                    <span className="highlight-tag green">命中</span>
                    <span>题目: 解释一下闭包 — 0.89</span>
                  </div>
                  <div className="highlight-card__row">
                    <span className="highlight-tag blue">语义</span>
                    <span>JS 高级程序设计 — 0.72</span>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </section>

        {/* ── CTA ── */}
        <section className="home-cta">
          <Typography.Title level={2}>准备好下一场面试了吗？</Typography.Title>
          <Typography.Paragraph type="secondary">
            上传你的资料，导入题库，开始 AI 模拟面试——完全免费。
          </Typography.Paragraph>
          <Link href={ROUTES.REGISTER}>
            <Button type="primary" size="large" shape="round" icon={<RocketOutlined />}>
              免费开始使用
            </Button>
          </Link>
        </section>
      </Content>

      <Footer className="home-footer">
        <div className="home-footer__inner">
          <Space size={8}>
            <span className="home-logo small">知</span>
            <Typography.Text strong>面试通</Typography.Text>
          </Space>
          <Typography.Text type="secondary">AI 面试备考助手 ©2026</Typography.Text>
        </div>
      </Footer>
    </Layout>
  );
}
