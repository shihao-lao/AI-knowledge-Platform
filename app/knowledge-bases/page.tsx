'use client';

import {
  BookOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Col, Descriptions, Empty, Input, Row, Space, Spin, Statistic, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ApiKnowledge } from '@/lib/api-client';
import CreateKnowledgeBaseModal from '@/components/create-kb-modal';
import { knowledgePath } from '@/lib/paths';
import type { Visibility } from '@/types';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState('');
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const fetchKnowledgeBases = async () => {
    setLoading(true);
    try {
      const result = await api.listKnowledge();
      setKnowledgeBases(result.data);
    } catch (err) {
      console.error('获取知识库列表失败:', err);
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const filteredKbs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return knowledgeBases;
    return knowledgeBases.filter(
      (kb) => kb.name.toLowerCase().includes(keyword) || kb.description.toLowerCase().includes(keyword),
    );
  }, [knowledgeBases, search]);

  const handleCreateKb = async (values: { name: string; description: string; visibility: Visibility }) => {
    const hide = message.loading('正在创建知识库...', 0);
    try {
      const result = await api.createKnowledge(values);
      message.success(`知识库「${values.name}」已创建`);
      await fetchKnowledgeBases();
      router.push(knowledgePath(result.data.id));
    } catch {
      message.error('创建知识库失败');
    } finally {
      hide();
    }
  };

  const handleDeleteKb = async (kbId: string, kbName: string) => {
    try {
      await api.deleteKnowledge(kbId);
      message.success(`知识库「${kbName}」已删除`);
      await fetchKnowledgeBases();
    } catch {
      message.error('删除知识库失败');
    }
  };

  return (
    <main className="simple-page">
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2}>知识库管理</Typography.Title>
          <Typography.Text type="secondary">创建、搜索并管理你的团队知识库。</Typography.Text>
        </div>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索知识库"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchKnowledgeBases} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setKbModalOpen(true)}>
            新建知识库
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {filteredKbs.length === 0 ? (
          <Empty description="暂无知识库" />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredKbs.map((kb) => {
              const isExpanded = expandedIds.has(kb.id);
              const docCount = kb._count?.documents ?? 0;
              return (
                <Col xs={24} md={12} xl={8} key={kb.id}>
                  <Card
                    className="kb-card"
                    actions={[
                      <Link href={knowledgePath(kb.id)} key="open">
                        打开
                      </Link>,
                      <span key="detail" onClick={() => toggleExpand(kb.id)} className="kb-card__action-detail">
                        {isExpanded ? <CloseOutlined /> : <EyeOutlined />}
                        <span>{isExpanded ? '收起' : '详情'}</span>
                      </span>,
                      <DeleteOutlined
                        key="delete"
                        onClick={() =>
                          modal.confirm({
                            title: '确定删除此知识库？',
                            content: `删除「${kb.name}」后不可恢复，其中的所有文档和对话记录也将被清除。`,
                            okText: '删除',
                            cancelText: '取消',
                            okButtonProps: { danger: true },
                            onOk: () => handleDeleteKb(kb.id, kb.name),
                          })
                        }
                      />,
                    ]}
                  >
                    <Space align="start" className="kb-card__body">
                      <span className="kb-card__icon">
                        <BookOutlined className="kb-card__icon-svg" />
                      </span>
                      <div className="kb-card__info">
                        <Typography.Title level={4} className="kb-card__name">
                          {kb.name}
                        </Typography.Title>
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          className="kb-card__desc"
                        >
                          {kb.description || '暂无描述'}
                        </Typography.Paragraph>
                        <Space size={4} wrap>
                          <Tag color="blue">
                            <FileOutlined /> {docCount} 份文档
                          </Tag>
                          <Tag color={kb.visibility === 'public' ? 'green' : 'default'}>
                            {kb.visibility === 'public' ? '公开' : '私有'}
                          </Tag>
                        </Space>
                      </div>
                    </Space>

                    <div className="kb-card__stats">
                      <Statistic title="文档" value={docCount} prefix={<FileOutlined />} />
                    </div>

                    <div className="kb-card__meta">
                      <Space split={<span className="kb-card__meta-divider">|</span>}>
                        <Typography.Text type="secondary" className="kb-card__meta-text">
                          <UserOutlined className="kb-card__meta-icon" />
                          {kb.status === 'active' ? '活跃' : kb.status}
                        </Typography.Text>
                        <Typography.Text type="secondary" className="kb-card__meta-text">
                          创建于 {formatRelativeTime(kb.createdAt)}
                        </Typography.Text>
                      </Space>
                    </div>
                  </Card>

                  {isExpanded && (
                    <Card
                      size="small"
                      className="kb-card__detail"
                      title={
                        <Space>
                          <InfoCircleOutlined />
                          <span>{kb.name} — 详细信息</span>
                        </Space>
                      }
                      extra={
                        <CloseOutlined
                          className="kb-card__detail-close"
                          onClick={() => toggleExpand(kb.id)}
                        />
                      }
                    >
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="知识库 ID">{kb.id}</Descriptions.Item>
                        <Descriptions.Item label="可见性">
                          <Tag color={kb.visibility === 'public' ? 'green' : 'default'}>
                            {kb.visibility === 'public' ? '公开' : '私有'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Tag color={kb.status === 'active' ? 'green' : 'default'}>{kb.status}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="文档数">{docCount}</Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {new Date(kb.createdAt).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                          {new Date(kb.updatedAt).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                        <Descriptions.Item label="描述" span={2}>
                          {kb.description || '暂无描述'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  )}
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>

      <CreateKnowledgeBaseModal
        open={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        onCreate={handleCreateKb}
      />
    </main>
  );
}
