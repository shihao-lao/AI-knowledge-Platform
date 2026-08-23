'use client';

import {
  DeleteOutlined,
  ImportOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type ApiQuestion } from '@/lib/api-client';
import { chatPath } from '@/lib/paths';

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy: { label: '简单', color: 'green' },
  medium: { label: '中等', color: 'orange' },
  hard: { label: '困难', color: 'red' },
};

const IMPORT_TEMPLATE = `[
  {
    "category": "React",
    "difficulty": "medium",
    "question": "useEffect 的依赖数组是做什么的？",
    "answer": "依赖数组决定副作用何时重新执行……",
    "keywords": ["useEffect", "Hooks"]
  }
]`;

export default function QuestionBankPage() {
  const router = useRouter();
  const params = useParams();
  const kbId = typeof params.kbId === 'string' ? params.kbId : '';
  const { message } = App.useApp();

  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchQuestions = async (extra?: { category?: string; difficulty?: string }) => {
    setLoading(true);
    try {
      const res = await api.listQuestions({
        knowledgeId: kbId,
        category: extra?.category ?? category,
        difficulty: extra?.difficulty ?? difficulty,
        keyword: keyword.trim() || undefined,
      });
      setQuestions(res.data);
      setCategories(res.categories);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '获取题目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kbId) fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId, category, difficulty]);

  const handleImport = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      message.error('JSON 格式错误，请检查后重试');
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      message.error('请粘贴一个题目数组（至少 1 道题）');
      return;
    }
    setImporting(true);
    try {
      const res = await api.importQuestions(kbId, parsed);
      message.success(`成功导入 ${res.data.count} 道题`);
      setImportOpen(false);
      setImportText('');
      fetchQuestions();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteQuestion(id);
      message.success('已删除');
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <main className="simple-page">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              面试题库
            </Typography.Title>
            <Typography.Text type="secondary">共 {questions.length} 道题 · 题目可直接被 AI 问答引用</Typography.Text>
          </div>
          <Space>
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
              导入题目
            </Button>
            <Button icon={<MessageOutlined />} onClick={() => router.push(chatPath(kbId))}>
              去 AI 问答
            </Button>
          </Space>
        </div>

        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="按类目筛选"
            style={{ width: 160 }}
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <Select
            allowClear
            placeholder="按难度筛选"
            style={{ width: 140 }}
            value={difficulty}
            onChange={setDifficulty}
            options={Object.entries(DIFFICULTY_META).map(([v, m]) => ({ value: v, label: m.label }))}
          />
          <Input.Search
            placeholder="搜索题干/答案关键词"
            style={{ width: 260 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => fetchQuestions()}
            enterButton={<SearchOutlined />}
          />
        </Space>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : questions.length === 0 ? (
          <Empty description="暂无题目，点击「导入题目」添加，或先在上传文档后生成题目" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((q) => (
              <Card key={q.id} size="small" styles={{ body: { padding: '12px 16px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Space size={8} wrap>
                      <Tag color={DIFFICULTY_META[q.difficulty]?.color ?? 'default'}>
                        {DIFFICULTY_META[q.difficulty]?.label ?? q.difficulty}
                      </Tag>
                      <Tag color="blue">{q.category}</Tag>
                      {q.keywords.slice(0, 4).map((k) => (
                        <Tag key={k}>{k}</Tag>
                      ))}
                    </Space>
                    <Typography.Paragraph strong style={{ marginTop: 8, marginBottom: 4 }}>
                      {q.question}
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                      <Typography.Text type="secondary">参考答案：</Typography.Text>
                      {q.answer.length > 200 ? `${q.answer.slice(0, 200)}…` : q.answer}
                    </Typography.Paragraph>
                  </div>
                  <Popconfirm title="确定删除此题？" onConfirm={() => handleDelete(q.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="导入面试题目"
        open={importOpen}
        onOk={handleImport}
        onCancel={() => setImportOpen(false)}
        okText="导入"
        cancelText="取消"
        confirmLoading={importing}
        width={720}
      >
        <Typography.Paragraph type="secondary">
          粘贴 JSON 数组（字段：question / answer 必填，category / difficulty / keywords / source 可选），难度支持 easy | medium | hard：
        </Typography.Paragraph>
        <Input.TextArea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={IMPORT_TEMPLATE}
          autoSize={{ minRows: 10, maxRows: 20 }}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </main>
  );
}
