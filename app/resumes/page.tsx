'use client';

import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Drawer, Empty, Popconfirm, Progress, Space, Spin, Tabs, Typography, Upload } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import MarkdownMessage from '@/components/markdown-message';
import AppShell from '@/components/app-shell';
import ResumeStructureEditor, { type ExportStyle } from '@/components/resume-structure-editor';
import { emptyStructuredResume, type StructuredResume } from '@/types';
import { normalizeStructuredResume } from '@/lib/resume-layout';
import { useRouter } from 'next/navigation';

const ACCEPT = '.txt,.md,.markdown,.pdf,.docx';
const MAX_SIZE_MB = 20;

function formatSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: 'var(--file-pdf-color)' }} />;
  if (ext === 'docx') return <FileWordOutlined style={{ color: 'var(--file-doc-color)' }} />;
  return <FileTextOutlined style={{ color: 'var(--file-text-color)' }} />;
}

function scoreColor(score: number) {
  if (score >= 80) return 'var(--color-score-high)';
  if (score >= 60) return 'var(--color-score-medium)';
  return 'var(--color-score-low)';
}

function scoreLabel(score: number) {
  if (score >= 80) return '简历质量不错';
  if (score >= 60) return '有改进空间';
  return '建议重点优化';
}

interface ResumeItem {
  id: string;
  filename: string;
  fileSize: number;
  score: number;
  createdAt: string;
}

interface ResumeDetail extends ResumeItem {
  analysis: string;
  structured?: StructuredResume | null;
  content?: string;
}

export default function ResumesPage() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [list, setList] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<ResumeDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [structured, setStructured] = useState<StructuredResume>(emptyStructuredResume());
  const [savedStructured, setSavedStructured] = useState<StructuredResume>(emptyStructuredResume());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStyle, setExportStyle] = useState<ExportStyle>('classic');
  const [activeTab, setActiveTab] = useState<'edit' | 'analysis' | 'source'>('edit');
  const [editorResetKey, setEditorResetKey] = useState('init');
  const editorResetSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const busy = saving || exporting || analyzing;

  const dirty = useMemo(
    () => JSON.stringify(structured) !== JSON.stringify(savedStructured),
    [structured, savedStructured],
  );

  useEffect(() => {
    if (!dirty || !current) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, current]);

  useEffect(() => {
    if (!current || (!dirty && !busy)) return;
    const guardLink = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      modal.confirm({
        title: '还有未保存的修改',
        content: '离开会放弃当前修改。可以取消并先保存。',
        okText: '放弃修改并继续',
        cancelText: '继续编辑',
        onOk: () => {
          setCurrent(null);
          router.push(url.pathname + url.search + url.hash);
        },
      });
    };
    document.addEventListener('click', guardLink, true);
    return () => document.removeEventListener('click', guardLink, true);
  }, [current, dirty, busy, modal, router]);

  const canLeave = async () => {
    if (busy) return false;
    if (!current || !dirty) return true;
    return new Promise<boolean>((resolve) => {
      modal.confirm({
        title: '还有未保存的修改',
        content: '离开会放弃当前修改。可以取消并先保存。',
        okText: '放弃修改并继续',
        cancelText: '继续编辑',
        onOk: () => {
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        },
      });
    });
  };

  const handleClose = async () => {
    if (await canLeave()) {
      detailRequestSeq.current += 1;
      setCurrent(null);
    }
  };

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

  const applyDetail = (detail: ResumeDetail) => {
    const next = normalizeStructuredResume(detail.structured);
    setCurrent(detail);
    setStructured(next);
    setSavedStructured(next);
    editorResetSeq.current += 1;
    setEditorResetKey(`${detail.id}:${editorResetSeq.current}`);
  };

  const handleUpload = async (file: File) => {
    if (!(await canLeave())) return false;
    if (!/\.(pdf|docx|txt|md|markdown)$/i.test(file.name)) {
      message.error('请上传 PDF、DOCX、Markdown 或 TXT 文件');
      return false;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      message.error(`文件大小不能超过 ${MAX_SIZE_MB}MB`);
      return false;
    }
    setAnalyzing(true);
    setProgress(0);
    detailRequestSeq.current += 1;
    try {
      const res = await api.uploadResume(file, setProgress);
      setProgress(100);
      const detail: ResumeDetail = {
        id: res.data.id,
        filename: res.data.filename,
        fileSize: res.data.fileSize ?? file.size,
        score: res.data.score,
        createdAt: res.data.createdAt,
        analysis: res.data.analysis,
        structured: res.data.structured,
        content: res.data.content,
      };
      applyDetail(detail);
      setActiveTab('edit');
      message.success('简历分析完成，可在右侧编辑结构并导出');
      fetchList();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '分析失败');
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
    return false;
  };

  const handleView = async (id: string) => {
    if (current?.id === id || !(await canLeave())) return;
    const sequence = ++detailRequestSeq.current;
    setViewLoading(true);
    try {
      let res = await api.getResume(id);
      if (!res.data.structured) res = await api.reparseResumeStructure(id);
      if (sequence !== detailRequestSeq.current) return;
      applyDetail({ ...res.data });
      setActiveTab('edit');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (sequence === detailRequestSeq.current) setViewLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy || (current?.id === id && !(await canLeave()))) return;
    try {
      await api.deleteResume(id);
      message.success('已删除');
      setList((prev) => prev.filter((r) => r.id !== id));
      if (current?.id === id) setCurrent(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const persistStructure = async () => {
    if (!current) throw new Error('请先选择简历');
    const res = await api.updateResumeStructure(current.id, structured);
    const next = normalizeStructuredResume(res.data.structured);
    setStructured(next);
    setSavedStructured(next);
    setCurrent((prev) => (prev ? { ...prev, structured: res.data.structured } : prev));
    editorResetSeq.current += 1;
    setEditorResetKey(`${current.id}:saved:${editorResetSeq.current}`);
  };

  const handleDiscard = () => {
    setStructured(savedStructured);
    editorResetSeq.current += 1;
    setEditorResetKey(`${current?.id}:discarded:${editorResetSeq.current}`);
  };

  const handleSave = async () => {
    if (!current || busy) return;
    setSaving(true);
    try {
      await persistStructure();
      message.success('结构化简历已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReparse = async () => {
    if (!current || busy) return;
    if (dirty) {
      message.warning('请先保存或放弃未保存修改');
      return;
    }
    setSaving(true);
    try {
      const res = await api.reparseResumeStructure(current.id);
      applyDetail({ ...current, structured: res.data.structured, analysis: res.data.analysis || current.analysis });
      message.success('已重新解析结构');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重新解析失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx', style: 'classic' | 'compact' | 'modern' = 'classic') => {
    if (!current || busy) return;
    setExporting(true);
    try {
      if (dirty) await persistStructure();
      await api.exportResume(current.id, format, style);
      message.success(`已导出 ${format.toUpperCase()}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell activeNav="resumes">
      <main className="simple-page">
        <Card>
          <div className="util-page-header">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 4 }}>
                简历分析与编辑
              </Typography.Title>
              <Typography.Text type="secondary">
                上传简历后自动填充可视化编辑器，保留原栏目名称与顺序，修改后导出 PDF 或 Word
              </Typography.Text>
            </div>
          </div>

          <Upload.Dragger
            accept={ACCEPT}
            maxCount={1}
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={busy || viewLoading}
            style={{ marginBottom: 24 }}
          >
            {analyzing ? (
              <div className="util-center-pad">
                <Spin />
                <Typography.Text style={{ display: 'block', marginTop: 12 }}>
                  {progress < 75
                    ? '正在上传文件...'
                    : progress < 100
                      ? '正在解析并结构化简历...（约 20-40 秒）'
                      : '分析完成'}
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
                <p className="ant-upload-hint">
                  支持 PDF、Word（.docx）、Markdown、TXT，最大 {MAX_SIZE_MB}MB
                  <br />
                  流程：本地解析正文 → 结构化模块 + AI 诊断 → 右侧编辑导出
                </p>
              </>
            )}
          </Upload.Dragger>

          <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            历史分析记录
          </Typography.Title>

          {loading ? (
            <div className="util-center-pad">
              <Spin />
            </div>
          ) : list.length === 0 ? (
            <Empty description="暂无分析记录，上传简历开始体验" />
          ) : (
            <div className="util-stack util-stack-8">
              {list.map((item) => (
                <Card
                  key={item.id}
                  size="small"
                  hoverable
                  onClick={() => handleView(item.id)}
                  style={{
                    cursor: 'pointer',
                    opacity: viewLoading && current?.id !== item.id ? 0.6 : 1,
                    borderColor: current?.id === item.id ? 'var(--color-primary)' : undefined,
                  }}
                  styles={{
                    body: {
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  }}
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
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(item.id);
                        setActiveTab('edit');
                      }}
                    />
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

        <Drawer
          className="resume-detail-drawer"
          placement="right"
          width="min(1200px, 100%)"
          open={!!current}
          onClose={handleClose}
          mask={false}
          maskClosable={false}
          closable={false}
          push={false}
          title={null}
          footer={null}
        >
          {current && (
            <>
              <div className="resume-score-header">
                <Progress
                  type="circle"
                  percent={current.score}
                  size={64}
                  strokeColor={scoreColor(current.score)}
                  format={(p) => (
                    <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(current.score) }}>{p}</span>
                  )}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Title level={5} style={{ marginBottom: 4 }} ellipsis={{ tooltip: current.filename }}>
                    {current.filename}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatSize(current.fileSize)} · {new Date(current.createdAt).toLocaleString('zh-CN')}
                  </Typography.Text>
                  <br />
                  <Typography.Text strong style={{ color: scoreColor(current.score) }}>
                    {scoreLabel(current.score)}
                  </Typography.Text>
                </div>
                <Button
                  aria-label="关闭简历编辑器"
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={handleClose}
                  disabled={busy}
                />
              </div>

              <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as 'edit' | 'analysis' | 'source')}
                className="resume-editor-tabs"
                items={[
                  {
                    key: 'edit',
                    label: '可视化编辑',
                    children: (
                      <ResumeStructureEditor
                        key={editorResetKey}
                        value={structured}
                        dirty={dirty}
                        saving={saving || exporting}
                        onChange={setStructured}
                        onSave={handleSave}
                        onReparse={handleReparse}
                        onExport={handleExport}
                        resetKey={editorResetKey}
                        onDiscard={handleDiscard}
                        exportStyle={exportStyle}
                        onStyleChange={setExportStyle}
                      />
                    ),
                  },
                  {
                    key: 'source',
                    label: '原文对照',
                    children: (
                      <div className="resume-source-text">
                        {current.content || '此记录没有原文，请重新上传原始简历。'}
                      </div>
                    ),
                  },
                  {
                    key: 'analysis',
                    label: 'AI 分析报告',
                    children: (
                      <div className="resume-analysis-body">
                        <MarkdownMessage>{current.analysis}</MarkdownMessage>
                      </div>
                    ),
                  },
                ]}
              />
            </>
          )}
        </Drawer>
      </main>
    </AppShell>
  );
}
