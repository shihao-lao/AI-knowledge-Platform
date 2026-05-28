'use client';

import { BookOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Col, Input, Row, Space, Statistic, Tag, Typography, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CreateKnowledgeBaseModal, {
  type ManualKbValues,
} from '@/components/create-kb-modal';
import { knowledgePath } from '@/lib/paths';
import { buildKnowledgeBase, useKnowledgeBases, useKnowledgeStore } from '@/stores/knowledge-store';
import type { Visibility } from '@/types';

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const kbList = useKnowledgeBases();
  const addKnowledgeBase = useKnowledgeStore((s) => s.addKnowledgeBase);
  const [search, setSearch] = useState('');
  const [kbModalOpen, setKbModalOpen] = useState(false);

  const filteredKbs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return kbList;
    return kbList.filter(
      (kb) => kb.name.toLowerCase().includes(keyword) || kb.description.toLowerCase().includes(keyword),
    );
  }, [kbList, search]);

  const handleCreateManualKb = (values: ManualKbValues) => {
    const kb = buildKnowledgeBase(values);
    const docCount = values.initialContent?.trim() ? 1 : 0;
    addKnowledgeBase({ ...kb, stats: { ...kb.stats, documentCount: docCount } });
    message.success(`知识库「${values.name}」已创建`);
    router.push(knowledgePath(kb.id));
  };

  const handleCreateImportKb = (values: {
    name: string;
    description: string;
    visibility: Visibility;
    files: File[];
  }) => {
    const kb = buildKnowledgeBase({
      name: values.name,
      description: values.description || `通过导入 ${values.files.length} 个文件创建`,
      visibility: values.visibility,
    });
    addKnowledgeBase({
      ...kb,
      stats: { ...kb.stats, documentCount: values.files.length, lastActiveAt: new Date().toISOString() },
    });
    message.success(`知识库「${values.name}」已创建，进入工作台后可继续导入文件`);
    router.push(knowledgePath(kb.id));
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setKbModalOpen(true)}>
            新建知识库
          </Button>
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        {filteredKbs.map((kb) => (
          <Col xs={24} md={12} xl={8} key={kb.id}>
            <Card
              className="kb-card"
              actions={[
                <Link href={knowledgePath(kb.id)} key="open">
                  打开
                </Link>,
                <EditOutlined key="edit" />,
                <DeleteOutlined key="delete" />,
              ]}
            >
              <Space align="start">
                <span className="kb-card__icon">
                  <BookOutlined />
                </span>
                <div>
                  <Typography.Title level={4}>{kb.name}</Typography.Title>
                  <Typography.Paragraph ellipsis={{ rows: 2 }}>{kb.description}</Typography.Paragraph>
                  <Tag color={kb.visibility === 'private' ? 'blue' : 'green'}>
                    {kb.visibility === 'private' ? '私有' : '公开'}
                  </Tag>
                </div>
              </Space>
              <div className="kb-card__stats">
                <Statistic title="文档" value={kb.stats.documentCount} />
                <Statistic title="对话" value={kb.stats.conversationCount} />
                <Statistic title="成员" value={kb.stats.memberCount} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <CreateKnowledgeBaseModal
        open={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        onCreateManual={handleCreateManualKb}
        onCreateImport={handleCreateImportKb}
      />
    </main>
  );
}
