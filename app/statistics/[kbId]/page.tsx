'use client';

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  EditOutlined,
  FileOutlined,
  MessageOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type ApiKnowledge, type CitationStatsData, type PracticeStats } from '@/lib/api-client';
import { knowledgePath, statisticsPath } from '@/lib/paths';
import CitationBarChart from '@/components/citation-bar-chart';
import CitationPieChart from '@/components/citation-pie-chart';
import CitationStatsTable from '@/components/citation-stats-table';
import AppShell from '@/components/app-shell';

const DIFFICULTY_COLOR: Record<string, string> = { easy: 'green', medium: 'orange', hard: 'red' };
const DIFFICULTY_LABEL: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };

export default function StatisticsPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = App.useApp();
  const kbId = params.kbId as string;

  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [stats, setStats] = useState<CitationStatsData | null>(null);
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);

  const fetchStats = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const [citation, practice] = await Promise.all([
          api.getCitationStats(id),
          api.getPracticeStats(id).catch(() => null),
        ]);
        setStats(citation.data);
        setPracticeStats(practice?.data ?? null);
      } catch (err) {
        console.error('获取引用统计失败:', err);
        message.error('获取引用统计失败');
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    api
      .listKnowledge()
      .then((r) => setKnowledgeBases(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (kbId) fetchStats(kbId);
  }, [kbId, fetchStats]);

  const handleKbChange = (id: string) => {
    router.push(statisticsPath(id));
  };

  const summary = stats?.summary;
  const documents = stats?.documents ?? [];
  const hasData = documents.length > 0;

  return (
    <AppShell activeNav="statistics">
      <main className="simple-page">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={2}>
              <BarChartOutlined style={{ marginRight: 8 }} />
              引用统计
            </Typography.Title>
            <Typography.Text type="secondary">查看各知识文档被引用的次数和分布情况。</Typography.Text>
          </div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(knowledgePath(kbId))}>
              返回
            </Button>
            <Select
              value={kbId}
              onChange={handleKbChange}
              style={{ width: 200 }}
              placeholder="选择知识库"
              options={knowledgeBases.map((kb) => ({ label: kb.name, value: kb.id }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchStats(kbId)} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          {summary && (
            <Row gutter={[16, 16]} className="util-mb-6">
              <Col xs={12} sm={12} lg={6}>
                <Card>
                  <Statistic title="总引用次数" value={summary.totalCitations} prefix={<BarChartOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <Card>
                  <Statistic title="被引文档数" value={summary.uniqueDocumentsCited} prefix={<FileOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <Card>
                  <Statistic title="相关对话数" value={summary.totalConversations} prefix={<TeamOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <Card>
                  <Statistic title="引用消息数" value={summary.totalAssistantMessages} prefix={<MessageOutlined />} />
                </Card>
              </Col>
            </Row>
          )}

          {!hasData && !loading ? (
            <Empty description="暂无引用数据" />
          ) : (
            <>
              <Row gutter={[16, 16]} className="util-mb-6">
                <Col xs={24} lg={14}>
                  <Card
                    title={
                      <>
                        <BarChartOutlined style={{ marginRight: 8 }} />
                        文档引用次数
                      </>
                    }
                  >
                    <CitationBarChart documents={documents} />
                  </Card>
                </Col>
                <Col xs={24} lg={10}>
                  <Card
                    title={
                      <>
                        <PieChartOutlined style={{ marginRight: 8 }} />
                        引用分布占比
                      </>
                    }
                  >
                    <CitationPieChart documents={documents} />
                  </Card>
                </Col>
              </Row>

              <Card
                title={
                  <>
                    <FileOutlined style={{ marginRight: 8 }} />
                    文档引用明细
                  </>
                }
              >
                <CitationStatsTable documents={documents} />
              </Card>
            </>
          )}

          {practiceStats && practiceStats.total > 0 && (
            <>
              <Typography.Title level={4} style={{ marginTop: 32 }}>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                练习掌握度
              </Typography.Title>
              <Row gutter={[16, 16]} className="util-mb-6">
                <Col xs={12} sm={12} lg={6}>
                  <Card>
                    <Statistic title="练习次数" value={practiceStats.total} prefix={<EditOutlined />} />
                  </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                  <Card>
                    <Statistic title="平均分" value={practiceStats.averageScore} suffix="/ 100" />
                  </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="最高分"
                      value={practiceStats.maxScore}
                      valueStyle={{ color: 'var(--color-score-high)' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="最低分"
                      value={practiceStats.minScore}
                      valueStyle={{ color: 'var(--color-score-low)' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} className="util-mb-6">
                <Col xs={24} lg={12}>
                  <Card title="按类目掌握度" size="small">
                    {practiceStats.byCategory.length === 0 ? (
                      <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      practiceStats.byCategory.map((c) => (
                        <div key={c.key} style={{ marginBottom: 12 }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Typography.Text>
                              {c.key}
                              <Typography.Text type="secondary">（{c.count} 次）</Typography.Text>
                            </Typography.Text>
                            <Typography.Text strong>{c.averageScore} 分</Typography.Text>
                          </Space>
                          <Progress
                            percent={c.averageScore}
                            showInfo={false}
                            strokeColor={
                              c.averageScore >= 80
                                ? 'var(--color-score-high)'
                                : c.averageScore >= 60
                                  ? 'var(--color-score-medium)'
                                  : 'var(--color-score-low)'
                            }
                          />
                        </div>
                      ))
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="按难度掌握度" size="small">
                    {practiceStats.byDifficulty.length === 0 ? (
                      <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      practiceStats.byDifficulty.map((d) => (
                        <div key={d.key} style={{ marginBottom: 12 }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Typography.Text>
                              <Tag color={DIFFICULTY_COLOR[d.key] ?? 'default'}>{DIFFICULTY_LABEL[d.key] ?? d.key}</Tag>
                              <Typography.Text type="secondary">（{d.count} 次）</Typography.Text>
                            </Typography.Text>
                            <Typography.Text strong>{d.averageScore} 分</Typography.Text>
                          </Space>
                          <Progress
                            percent={d.averageScore}
                            showInfo={false}
                            strokeColor={
                              d.averageScore >= 80
                                ? 'var(--color-score-high)'
                                : d.averageScore >= 60
                                  ? 'var(--color-score-medium)'
                                  : 'var(--color-score-low)'
                            }
                          />
                        </div>
                      ))
                    )}
                  </Card>
                </Col>
              </Row>

              <Card title="最近练习记录" size="small">
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={practiceStats.recent}
                  pagination={false}
                  columns={[
                    { title: '题目', dataIndex: 'question', ellipsis: true },
                    {
                      title: '类目',
                      dataIndex: 'category',
                      width: 100,
                      render: (v: string) => <Tag color="blue">{v}</Tag>,
                    },
                    {
                      title: '难度',
                      dataIndex: 'difficulty',
                      width: 80,
                      render: (v: string) => <Tag color={DIFFICULTY_COLOR[v]}>{DIFFICULTY_LABEL[v] ?? v}</Tag>,
                    },
                    { title: '得分', dataIndex: 'score', width: 80, render: (v: number) => <b>{v}</b> },
                  ]}
                />
              </Card>
            </>
          )}
        </Spin>
      </main>
    </AppShell>
  );
}
