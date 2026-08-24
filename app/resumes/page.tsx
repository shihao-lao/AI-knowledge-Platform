'use client';

import {
  DeleteOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Empty, Popconfirm, Progress, Space, Spin, Typography, Upload } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import MarkdownMessage from '@/components/markdown-message';

const ACCEPT = '.txt,.md,.markdown,.pdf,.docx';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ef4444' }} />;
  if (ext === 'docx') return <FileWordOutlined style={{ color: '#4f46e5' }} />;
  return <FileTextOutlined style={{ color: '#10b981' }} />;
}

function scoreColor(score: number) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

interface ResumeItem {
  id: string;
  filename: string;
  fileSize: number;
  score: number;
  createdAt: string;
}

export default function ResumesPage() {
  const { message } = App.useApp();
  const [list, setList] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<{
    id: string;
    filename: string;
    fileSize: number;
    score: number;
    analysis: string;
    createdAt: string;
  } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.listResumes();
      setList(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '获取列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (file: File) => {
    setAnalyzing(true);
    setProgress(0);
    setCurrent(null);
    try {
      const res = await api.uploadResume(file, setProgress);
      setCurrent(res.data);
      message.success('简历分析完成');
      fetchList();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '分析失败');
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
    return false; // prevent antd Upload auto request
  };

  const handleView = async (id: string) => {
    setViewLoading(true);
    try {
      const res = await api.getResume(id);
      setCurrent(res.data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setViewLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteResume(id);
      message.success('已删除');
      setList((prev) => prev.filter((r) => r.id !== id));
      if (current?.id === id) setCurrent(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <main className="simple-page">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              📄 简历分析
            </Typography.Title>
            <Typography.Text type="secondary">上传简历，AI 从 HR 视角全面诊断问题并给出改进建议</Typography.Text>
          </div>
        </div>

        {/* 上传区 */}
        <Upload.Dragger
          accept={ACCEPT}
          maxCount={1}
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={analyzing}
          style={{ marginBottom: 24 }}
        >
          {analyzing ? (
            <div style={{ padding: '24px 0' }}>
              <Spin />
              <Typography.Text style={{ display: 'block', marginTop: 12 }}>
                正在分析简历...（约 20-40 秒）
              </Typography.Text>
              {progress > 0 && (
                <Progress percent={progress} size="small" style={{ maxWidth: 300, margin: '12px auto 0' }} />
              )}
            </div>
          ) : (
            <>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽简历文件到此区域</p>
              <p className="ant-upload-hint">支持 PDF、Word（.docx）、Markdown、TXT，最大 20MB</p>
            </>
          )}
        </Upload.Dragger>

        {/* 分析结果 */}
        {current && (
          <div ref={resultRef}>
            <Card
              styles={{ body: { padding: 0 } }}
              style={{ marginBottom: 24, overflow: 'hidden' }}
            >
              {/* 分数头部 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <Progress
                  type="circle"
                  percent={current.score}
                  size={96}
                  strokeColor={scoreColor(current.score)}
                  format={(p) => <span style={{ fontSize: 24, fontWeight: 700, color: scoreColor(current.score) }}>{p}</span>}
                />
                <div>
                  <Typography.Title level={4} style={{ marginBottom: 4 }}>
                    {current.filename}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {formatSize(current.fileSize)} · 分析于 {new Date(current.createdAt).toLocaleString('zh-CN')}
                  </Typography.Text>
                  <br />
                  <Typography.Text strong style={{ color: scoreColor(current.score), marginTop: 4, display: 'inline-block' }}>
                    {current.score >= 80 ? '👍 简历质量不错' : current.score >= 60 ? '⚠️ 有改进空间' : '🔧 建议重点优化'}
                  </Typography.Text>
                </div>
              </div>
              {/* 分析正文 */}
              <div style={{ padding: 24 }}>
                <MarkdownMessage>{current.analysis}</MarkdownMessage>
              </div>
            </Card>
          </div>
        )}

        {/* 历史记录 */}
        <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
          历史分析记录
        </Typography.Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : list.length === 0 ? (
          <Empty description="暂无分析记录，上传简历开始体验" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((item) => (
              <Card
                key={item.id}
                size="small"
                hoverable
                onClick={() => handleView(item.id)}
                style={{ cursor: 'pointer', opacity: viewLoading && current?.id !== item.id ? 0.6 : 1 }}
                styles={{ body: { padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }}
              >
                <Space size={12}>
                  {fileIcon(item.filename)}
                  <div>
                    <Typography.Text strong>{item.filename}</Typography.Text>
                    <br />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatSize(item.fileSize)} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </Typography.Text>
                  </div>
                </Space>
                <Space size={8}>
                  <Progress
                    type="circle"
                    percent={item.score}
                    size={44}
                    strokeColor={scoreColor(item.score)}
                    format={(p) => <span style={{ fontSize: 13, fontWeight: 600 }}>{p}</span>}
                  />
                  <Popconfirm
                    title="确定删除此分析记录？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(item.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
