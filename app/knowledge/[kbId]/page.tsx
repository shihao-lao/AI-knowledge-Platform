'use client';

import { App, Space, Typography, Spin } from 'antd';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { knowledgePath, chatPath, statisticsPath, questionsPath } from '@/lib/paths';
import { api, type ApiKnowledge, type ApiDocument } from '@/lib/api-client';
import { useExpandedDocIds, useKnowledgeStore } from '@/stores/knowledge-store';
import CreateDocumentModal from './components/CreateDocumentModal';
import KnowledgeDocumentList from './components/KnowledgeDocumentList';
import KnowledgeUploader from './components/KnowledgeUploader';
import KnowledgeSidebar from './components/KnowledgeSidebar';

const STAGE_TEXT: Record<string, string> = {
  pending: '等待中',
  uploading: '上传中',
  parsing: '解析文档中',
  chunking: '切片中',
  embedding: '向量化中',
  completed: '已完成',
  failed: '处理失败',
};

/** 每个阶段对应的进度百分比 */
const STAGE_PROGRESS: Record<string, number> = {
  pending: 2,
  uploading: 8,
  parsing: 25,
  chunking: 50,
  embedding: 78,
  completed: 100,
  failed: 0,
};

export default function KnowledgeWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;
  const { message } = App.useApp();

  const expandedDocIds = useExpandedDocIds();
  const removeDocumentFromStore = useKnowledgeStore((s) => s.removeDocument);
  const toggleExpandedDocId = useKnowledgeStore((s) => s.toggleExpandedDocId);

  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam) ? kbIdParam : (knowledgeBases[0]?.id ?? '');
  const activeKb = knowledgeBases.find((item) => item.id === activeKbId);

  useEffect(() => {
    if (knowledgeBases.length > 0 && kbIdParam && !knowledgeBases.some((kb) => kb.id === kbIdParam)) {
      router.replace(knowledgePath(knowledgeBases[0].id));
    }
  }, [kbIdParam, knowledgeBases, router]);

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

  const handleToggleExpand = useCallback(
    async (docId: string) => {
      toggleExpandedDocId(docId);
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
    [toggleExpandedDocId],
  );

  const pollDocumentStatus = async (docId: string) => {
    const MAX_DURATION = 5 * 60 * 1000; // 5 分钟总超时
    const BASE_INTERVAL = 1500; // 起始间隔 1.5s
    const MAX_INTERVAL = 8000; // 最大间隔 8s
    let interval = BASE_INTERVAL;
    let consecutiveErrors = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_DURATION) {
      await new Promise((r) => setTimeout(r, interval));
      try {
        const { data } = await api.getDocument(docId);
        consecutiveErrors = 0;
        interval = BASE_INTERVAL;

        const stage = STAGE_TEXT[data.parseStatus] ?? data.parseStatus;

        // 组装进度详情：chunking/embedding 阶段带上切片数
        let detail = stage;
        if (data.parseStatus === 'chunking' && data.charCount > 0) {
          detail = `${stage}（${data.charCount.toLocaleString()} 字符）`;
        }
        if (data.parseStatus === 'embedding' && data.chunkCount > 0) {
          detail = `${stage}（${data.chunkCount} 个切片）`;
        }

        if (data.parseStatus === 'completed') {
          message.success({
            content: `《${data.filename}》处理完成，共 ${data.chunkCount} 个切片`,
            key: `ingest-${docId}`,
          });
          await fetchDocuments();
          return;
        }
        if (data.parseStatus === 'failed') {
          message.error({ content: `《${data.filename}》处理失败，请重试`, key: `ingest-${docId}` });
          await fetchDocuments();
          return;
        }
        message.loading({ content: `《${data.filename}》${detail}...`, key: `ingest-${docId}`, duration: 0 });

        // 指数退避
        interval = Math.min(interval * 1.3, MAX_INTERVAL);
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          message.error({ content: '状态检查失败，请刷新页面查看', key: `ingest-${docId}` });
          return;
        }
        interval = Math.min(interval * 2, MAX_INTERVAL);
      }
    }
    // 超时：不报错，只提示用户手动刷新
    message.info({ content: '文档仍在处理中，请稍后刷新查看', key: `ingest-${docId}`, duration: 5 });
    await fetchDocuments();
  };

  // 页面加载后，自动恢复轮询仍在处理中的文档
  const hasResumedPolling = useRef(false);
  useEffect(() => {
    if (hasResumedPolling.current || documents.length === 0) return;
    const processingStatuses = new Set(['pending', 'uploading', 'parsing', 'chunking', 'embedding']);
    const processingDocs = documents.filter((d) => processingStatuses.has(d.parseStatus));
    if (processingDocs.length > 0) {
      hasResumedPolling.current = true;
      processingDocs.forEach((d) => pollDocumentStatus(d.id));
    }
  }, [documents]);

  const handleUpload = async (file: File) => {
    const key = `upload-${file.name}`;
    message.loading({ content: `正在上传《${file.name}》... 0%`, key, duration: 0 });
    try {
      const result = await api.uploadDocument(activeKbId, file, (percent) => {
        message.loading({ content: `正在上传《${file.name}》... ${percent}%`, key, duration: 0 });
      });
      message.success({ content: `《${file.name}》上传完成，开始处理...`, key });
      await fetchDocuments();
      pollDocumentStatus(result.data.id);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '上传失败';
      message.error({ content: `《${file.name}》${errMsg}`, key });
    }
  };

  const removeDocument = async (documentId: string) => {
    const hide = message.loading('正在删除文档...', 0);
    try {
      await api.deleteDocument(documentId);
      removeDocumentFromStore(documentId);
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

  const handleToggleEnabled = async (docId: string, enabled: boolean) => {
    try {
      await api.updateDocumentEnabled(docId, enabled);
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, enabled } : d)));
      message.success(enabled ? '文档已启用' : '文档已禁用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleCreateDoc = async (title: string, content: string) => {
    const file = new File([content], `${title}.txt`, { type: 'text/plain' });
    await handleUpload(file);
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
          : doc.parseStatus === 'pending'
            ? 'uploading'
            : (doc.parseStatus as string)) as 'completed' | 'failed' | 'uploading',
      processingProgress: STAGE_PROGRESS[doc.parseStatus] ?? 8,
      chunkCount: doc.chunkCount,
      charCount: doc.charCount,
      enabled: doc.enabled ?? true,
      uploadedBy: { id: '', name: '', email: '', role: 'viewer' as const, createdAt: '' },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      content: doc._content ?? '',
    }),
    [],
  );

  const lastExpandedId = expandedDocIds[expandedDocIds.length - 1];
  const sidebarDocRaw = lastExpandedId ? (documents.find((d) => d.id === lastExpandedId) ?? documents[0]) : undefined;
  const sidebarDoc = sidebarDocRaw ? toKnowledgeDocument(sidebarDocRaw) : null;

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
          <button type="button" className="hub-nav__item" onClick={() => router.push(questionsPath(activeKbId))}>
            <span>❓</span>
            <span>面试题库</span>
          </button>
          <button type="button" className="hub-nav__item" onClick={() => router.push(statisticsPath(activeKbId))}>
            <span>📊</span>
            <span>引用统计</span>
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
          <button type="button" className="hub-nav__item" onClick={() => router.push('/knowledge-bases')}>
            <span>📦</span>
            <span>知识库管理</span>
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
                <KnowledgeUploader onUpload={handleUpload} onCreateManual={() => setDocModalOpen(true)} />
              </Space>
            </div>
            <Spin spinning={loading}>
              <KnowledgeDocumentList
                documents={documents.map(toKnowledgeDocument)}
                expandedDocIds={expandedDocIds}
                onToggleExpand={handleToggleExpand}
                onDelete={removeDocument}
                onToggleEnabled={handleToggleEnabled}
              />
            </Spin>
          </div>
          <KnowledgeSidebar expandedDoc={sidebarDoc} onGoToChat={goToChat} />
        </section>
      </main>

      <CreateDocumentModal open={docModalOpen} onClose={() => setDocModalOpen(false)} onSubmit={handleCreateDoc} />
    </div>
  );
}
