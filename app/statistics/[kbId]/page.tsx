'use client';

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  FileOutlined,
  MessageOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Col, Empty, Row, Select, Space, Spin, Statistic, Typography } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type ApiKnowledge, type CitationStatsData } from '@/lib/api-client';
import { knowledgePath, statisticsPath } from '@/lib/paths';
import CitationBarChart from '@/components/citation-bar-chart';
import CitationPieChart from '@/components/citation-pie-chart';
import CitationStatsTable from '@/components/citation-stats-table';

export default function StatisticsPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = App.useApp();
  const kbId = params.kbId as string;

  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [stats, setStats] = useState<CitationStatsData | null>(null);

  const fetchStats = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const result = await api.getCitationStats(id);
        setStats(result.data);
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
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="总引用次数" value={summary.totalCitations} prefix={<BarChartOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="被引文档数" value={summary.uniqueDocumentsCited} prefix={<FileOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="相关对话数" value={summary.totalConversations} prefix={<TeamOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
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
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
      </Spin>
    </main>
  );
}
