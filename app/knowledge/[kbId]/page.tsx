'use client';

import { App, Input, Space, Typography, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { knowledgePath, chatPath } from '@/lib/paths';
import { api, type ApiKnowledge, type ApiDocument } from '@/lib/api-client';
import { useExpandedDocId, useKnowledgeStore } from '@/stores/knowledge-store';
import KnowledgeDocumentList from './components/KnowledgeDocumentList';
import KnowledgeUploader from './components/KnowledgeUploader';
import KnowledgeSidebar from './components/KnowledgeSidebar';

export default function KnowledgeWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;
  const { message } = App.useApp();

  const expandedDocId = useExpandedDocId();
  const removeDocumentFromStore = useKnowledgeStore((s) => s.removeDocument);
  const setExpandedDocId = useKnowledgeStore((s) => s.setExpandedDocId);
  const resolveExpandedDocForKb = useKnowledgeStore((s) => s.resolveExpandedDocForKb);

  const [keyword, setKeyword] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam) ? kbIdParam : (knowledgeBases[0]?.id ?? '');
  const activeKb = knowledgeBases.find((item) => item.id === activeKbId);

  useEffect(() => {
    if (knowledgeBases.length > 0 && kbIdParam && !knowledgeBases.some((kb) => kb.id === kbIdParam)) {
      router.replace(knowledgePath(knowledgeBases[0].id));
    }
  }, [kbIdParam, knowledgeBases, router]);

  useEffect(() => {
    resolveExpandedDocForKb(activeKbId);
  }, [activeKbId, resolveExpandedDocForKb]);

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const result = await api.listKnowledge();
      setKnowledgeBases(result.data);
    } catch (err) {
      console.error('获取知识库列表失败:', err);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!activeKbId) return;
    setLoading(true);
    try {
      const result = await api.listDocuments(activeKbId);
      setDocuments(result.data);
    } catch (err) {
      console.error('获取文档列表失败:', err);
      message.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeKbId, message]);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleExpand = useCallback(
    async (docId: string) => {
      setExpandedDocId(docId);
      // Fetch full document with chunks to get content
      try {
        const { data } = await api.getDocument(docId);
        if (data.chunks && data.chunks.length > 0) {
          const content = data.chunks
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .map((c) => c.content)
            .join('\n\n');
          setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, _content: content } : d)));
        }
      } catch {
        // non-fatal, detail will show "暂无内容"
      }
    },
    [setExpandedDocId],
  );

  const STAGE_TEXT: Record<string, string> = {
    pending: '等待中',
    parsing: '解析文档中',
    chunking: '切片中',
    embedding: '向量化中',
    completed: '已完成',
    failed: '处理失败',
  };

  const pollDocumentStatus = async (docId: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const { data } = await api.getDocument(docId);
        const stage = STAGE_TEXT[data.parseStatus] ?? data.parseStatus;
        if (data.parseStatus === 'completed') {
          message.success({
            content: `《${data.filename}》处理完成，共 ${data.chunkCount} 个切片`,
            key: `ingest-${docId}`,
          });
          await fetchDocuments();
          return;
        }
        if (data.parseStatus === 'failed') {
          message.error({ content: `《${data.filename}》处理失败`, key: `ingest-${docId}` });
          await fetchDocuments();
          return;
        }
        message.loading({ content: `《${data.filename}》${stage}...`, key: `ingest-${docId}`, duration: 0 });
      } catch {
        /* ignore polling error */
      }
    }
  };

  const handleUpload = async (file: File) => {
    const key = `upload-${file.name}`;
    message.loading({ content: `正在上传《${file.name}》... 0%`, key, duration: 0 });
    try {
      const result = await api.uploadDocument(activeKbId, file, (percent) => {
        message.loading({ content: `正在上传《${file.name}》... ${percent}%`, key, duration: 0 });
      });
      message.success({ content: `《${file.name}》上传完成，开始处理...`, key });
      await fetchDocuments();
      // Poll for processing status
      pollDocumentStatus(result.data.id);
    } catch (err) {
      message.error({ content: err instanceof Error ? err.message : '上传失败', key });
    }
  };

  const removeDocument = async (documentId: string) => {
    const hide = message.loading('正在删除文档...', 0);
    try {
      await api.deleteDocument(documentId);
      removeDocumentFromStore(documentId, activeKbId);
      await fetchDocuments();
      message.success('文档已删除');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除文档失败');
    } finally {
      hide();
    }
  };

  const goToChat = () => {
    router.push(chatPath(activeKbId));
  };

  const toKnowledgeDocument = useCallback(
    (doc: ApiDocument & { _content?: string }) => ({
      id: doc.id,
      knowledgeBaseId: doc.knowledgeId,
      title: doc.filename,
      fileName: doc.filename,
      fileType: 'text' as const,
      fileSize: doc.size,
      status: (doc.parseStatus === 'completed'
        ? 'completed'
        : doc.parseStatus === 'failed'
          ? 'failed'
          : 'uploading') as 'completed' | 'failed' | 'uploading',
      processingProgress:
        doc.parseStatus === 'completed'
          ? 100
          : doc.parseStatus === 'embedding'
            ? 84
            : doc.parseStatus === 'chunking'
              ? 58
              : doc.parseStatus === 'parsing'
                ? 28
                : 8,
      chunkCount: doc.chunkCount,
      charCount: doc.charCount,
      uploadedBy: { id: '', name: '', email: '', role: 'viewer' as const, createdAt: '' },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      content: doc._content ?? '',
    }),
    [],
  );

  const expandedDoc = documents.find((d) => d.id === expandedDocId);
  const sidebarDoc = expandedDoc ? toKnowledgeDocument(expandedDoc) : null;

  return (
    <div className="hub-shell">
      <aside className="hub-sidebar">
        <div className="hub-brand">
          <span className="hub-brand__mark">知</span>
          <span>知识中枢</span>
        </div>

        <nav className="hub-nav">
          <button type="button" className="hub-nav__item is-active">
            <span>📚</span>
            <span>知识库</span>
          </button>
          <button type="button" className="hub-nav__item" onClick={goToChat}>
            <span>💬</span>
            <span>AI 对话</span>
          </button>
        </nav>

        <div className="hub-side-section">
          <div className="hub-section-title">
            <span>我的知识库</span>
            <span>{knowledgeBases.length}</span>
          </div>
          {knowledgeBases.map((kb) => (
            <button
              type="button"
              key={kb.id}
              className={`hub-kb ${activeKbId === kb.id ? 'is-active' : ''}`}
              onClick={() => router.push(knowledgePath(kb.id))}
            >
              <span>{kb.name}</span>
              <small>{kb._count?.documents ?? 0} 份知识</small>
            </button>
          ))}
        </div>

        <div className="hub-sidebar__bottom">
          <button type="button" className="hub-nav__item">
            <span>⚙️</span>
            <span>系统设置</span>
          </button>
        </div>
      </aside>

      <main className="hub-main">
        <section className="knowledge-workspace">
          <div className="knowledge-main">
            <div className="knowledge-head">
              <div>
                <Typography.Title level={2}>我的知识合集</Typography.Title>
                <Typography.Text type="secondary">{activeKb?.description || '暂无描述'}</Typography.Text>
              </div>
              <Space wrap>
                <KnowledgeUploader onUpload={handleUpload} />
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="搜索当前知识库..."
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </Space>
            </div>
            <Spin spinning={loading}>
              <KnowledgeDocumentList
                documents={documents.map(toKnowledgeDocument)}
                expandedDocId={expandedDocId}
                onExpand={handleExpand}
                onDelete={removeDocument}
              />
            </Spin>
          </div>
          <KnowledgeSidebar expandedDoc={sidebarDoc} onGoToChat={goToChat} />
        </section>
      </main>
    </div>
  );
}
