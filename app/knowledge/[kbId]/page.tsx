'use client';

import { App, Input, Space, Typography, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { KnowledgeDocument, DocumentStatus, FileType } from '@/types';
import { knowledgePath, chatPath } from '@/lib/paths';
import { currentUser } from '@/data/mock';
import { parseUploadedFile, documentProcessingStages } from '@/lib/document';
import { listDocuments, listDatasets, deleteDocuments, uploadFile, type DocumentInfo, type DatasetInfo } from '@/app/api/kb';
import {
  useKnowledgeBases,
  useDocuments,
  useExpandedDocId,
  useKnowledgeStore,
} from '@/stores/knowledge-store';
import KnowledgeDocumentList from './components/KnowledgeDocumentList';
import KnowledgeUploader from './components/KnowledgeUploader';
import KnowledgeSidebar from './components/KnowledgeSidebar';

/** 根据文件名推断文件类型 */
function inferFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['txt', 'text'].includes(ext)) return 'text';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  return 'text';
}

/** 将 Coze 文档状态映射到本地状态 */
function mapDocumentStatus(status: number): DocumentStatus {
  switch (status) {
    case 0:
      return 'uploading';
    case 1:
      return 'completed';
    case 2:
      return 'failed';
    default:
      return 'uploading';
  }
}

/** 从 web_url 获取文档内容 */
async function fetchDocumentContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.error('获取文档内容失败:', error);
  }
  return '';
}

/** 将 Coze 文档转换为本地 KnowledgeDocument 格式 */
function convertToKnowledgeDocument(doc: DocumentInfo, kbId: string): KnowledgeDocument {
  return {
    id: doc.document_id,
    knowledgeBaseId: kbId,
    title: doc.name,
    fileName: doc.name,
    fileType: inferFileType(doc.name),
    fileSize: doc.size || 0,
    status: mapDocumentStatus(doc.status),
    processingProgress: doc.status === 1 ? 100 : 50,
    chunkCount: doc.slice_count || 0,
    charCount: doc.char_count || 0,
    uploadedBy: currentUser,
    createdAt: doc.create_time ? new Date(doc.create_time * 1000).toISOString() : new Date().toISOString(),
    updatedAt: doc.update_time ? new Date(doc.update_time * 1000).toISOString() : new Date().toISOString(),
    content: '',
  };
}

export default function KnowledgeWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;

  const { message } = App.useApp();

  const _kbList = useKnowledgeBases();
  const docRows = useDocuments();
  const expandedDocId = useExpandedDocId();
  const addDocument = useKnowledgeStore((s) => s.addDocument);
  const updateDocument = useKnowledgeStore((s) => s.updateDocument);
  const removeDocumentFromStore = useKnowledgeStore((s) => s.removeDocument);
  const setExpandedDocId = useKnowledgeStore((s) => s.setExpandedDocId);
  const resolveExpandedDocForKb = useKnowledgeStore((s) => s.resolveExpandedDocForKb);

  const [keyword, setKeyword] = useState('');
  const [cozeDocuments, setCozeDocuments] = useState<KnowledgeDocument[]>([]);
  const [cozeDatasets, setCozeDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const activeKbId = kbIdParam && cozeDatasets.some((kb) => kb.dataset_id === kbIdParam)
    ? kbIdParam
    : cozeDatasets[0]?.dataset_id ?? '';
  const activeKb = cozeDatasets.find((item) => item.dataset_id === activeKbId) ?? cozeDatasets[0];

  useEffect(() => {
    if (cozeDatasets.length > 0 && kbIdParam && !cozeDatasets.some((kb) => kb.dataset_id === kbIdParam)) {
      router.replace(knowledgePath(cozeDatasets[0].dataset_id));
    }
  }, [kbIdParam, cozeDatasets, router]);

  useEffect(() => {
    resolveExpandedDocForKb(activeKbId);
  }, [activeKbId, resolveExpandedDocForKb]);

  // 从 Coze API 获取知识库列表
  const fetchCozeDatasets = async () => {
    try {
      const result = await listDatasets();
      if (result.code === 0 && result.data?.dataset_list) {
        setCozeDatasets(result.data.dataset_list);
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error);
    }
  };

  // 从 Coze API 获取文档列表
  const fetchCozeDocuments = async () => {
    if (!activeKbId) {
      console.log('[Docs] activeKbId is empty, skip fetching');
      return;
    }

    console.log('[Docs] Fetching documents for dataset_id:', activeKbId);
    setLoading(true);
    try {
      const result = await listDocuments({ dataset_id: activeKbId });
      console.log('[Docs] API response:', result);

      if (result.code === 0 && result.document_infos) {
        console.log('[Docs] Found documents:', result.document_infos.length);
        // 转换文档基本信息
        const docs = result.document_infos.map((doc) => convertToKnowledgeDocument(doc, activeKbId));

        // 获取每个文档的内容
        const docsWithContent = await Promise.all(
          result.document_infos.map(async (doc, index) => {
            if (doc.web_url) {
              const content = await fetchDocumentContent(doc.web_url);
              return { ...docs[index], content };
            }
            return docs[index];
          })
        );

        console.log('[Docs] Setting documents:', docsWithContent.length);
        setCozeDocuments(docsWithContent);
        message.success(`已加载 ${docsWithContent.length} 个文档`);
      } else {
        console.error('[Docs] API error:', result.msg);
        message.error(result.msg || '获取文档列表失败');
      }
    } catch (error) {
      console.error('[Docs] Fetch error:', error);
      message.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时获取数据
  useEffect(() => {
    fetchCozeDatasets();
    fetchCozeDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKbId]);

  // 合并本地文档和 Coze 文档
  const allDocuments = useMemo(() => {
    const localDocs = docRows.filter((doc) => doc.knowledgeBaseId === activeKbId);
    // 去重：Coze 文档优先
    const cozeDocIds = new Set(cozeDocuments.map((d) => d.id));
    const filteredLocalDocs = localDocs.filter((d) => !cozeDocIds.has(d.id));
    return [...cozeDocuments, ...filteredLocalDocs];
  }, [activeKbId, docRows, cozeDocuments]);

  const activeDocs = useMemo(() => {
    return allDocuments.filter((doc) => {
      const matchKeyword = `${doc.title}${doc.fileName}${doc.content}`.includes(keyword.trim());
      return !keyword.trim() || matchKeyword;
    });
  }, [allDocuments, keyword]);

  const expandedDoc = activeDocs.find((doc) => doc.id === expandedDocId) ?? activeDocs[0];

  const importFileToKb = async (file: File, kbId: string) => {
    const importKey = `import-${file.name}-${file.size}`;
    message.loading({ content: `正在读取《${file.name}》并提取关键点...`, key: importKey, duration: 0 });
    const { sourceTitle, content } = await parseUploadedFile(file);
    const newDoc: KnowledgeDocument = {
      id: crypto.randomUUID(),
      knowledgeBaseId: kbId,
      title: `${sourceTitle}关键点文档`,
      fileName: `${sourceTitle}-关键点.md`,
      fileType: 'markdown',
      fileSize: file.size,
      status: 'uploading',
      processingProgress: 8,
      chunkCount: 0,
      uploadedBy: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content,
    };
    addDocument(newDoc);
    message.success({ content: `已生成《${sourceTitle}关键点文档》`, key: importKey });

    documentProcessingStages.forEach(([status, progress, delay]) => {
      window.setTimeout(() => {
        updateDocument(newDoc.id, {
          status,
          processingProgress: progress,
          chunkCount: status === 'completed' ? 24 : 12,
        });
      }, delay);
    });
    return newDoc;
  };

  const handleUpload = async (file: File) => {
    const key = `upload-${file.name}`;
    message.loading({ content: `正在上传《${file.name}》到知识库...`, key, duration: 0 });
    try {
      const result = await uploadFile(file, activeKbId);
      if (result.code === 0) {
        message.success({ content: `《${file.name}》上传成功，正在处理中...`, key });
        await fetchCozeDocuments();
      } else {
        message.error({ content: result.msg || '上传失败', key });
      }
    } catch {
      message.error({ content: '上传失败，请检查网络连接', key });
    }
  };

  const removeDocument = async (documentId: string) => {
    const hide = message.loading('正在删除文档...', 0);
    try {
      const result = await deleteDocuments({ document_ids: [documentId] });
      if (result.code === 0) {
        removeDocumentFromStore(documentId, activeKbId);
        await fetchCozeDocuments(); // 刷新列表
        message.success('文档已删除');
      } else {
        message.error(result.msg || '删除失败');
      }
    } catch {
      message.error('删除文档失败，请检查网络连接');
    } finally {
      hide();
    }
  };

  const goToChat = () => {
    router.push(chatPath(activeKbId));
  };

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
            <span>{cozeDatasets.length}</span>
          </div>
          {cozeDatasets.map((kb) => (
            <button
              type="button"
              key={kb.dataset_id}
              className={`hub-kb ${activeKbId === kb.dataset_id ? 'is-active' : ''}`}
              onClick={() => router.push(knowledgePath(kb.dataset_id))}
            >
              <span>{kb.name}</span>
              <small>
                {kb.file_list?.length ?? kb.doc_count} 份知识
              </small>
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
                documents={activeDocs}
                expandedDocId={expandedDocId}
                onExpand={setExpandedDocId}
                onDelete={removeDocument}
              />
            </Spin>
          </div>
          <KnowledgeSidebar expandedDoc={expandedDoc ?? null} onGoToChat={goToChat} />
        </section>
      </main>
    </div>
  );
}
