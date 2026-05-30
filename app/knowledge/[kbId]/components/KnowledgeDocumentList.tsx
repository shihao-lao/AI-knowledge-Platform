'use client';

import { DeleteOutlined } from '@ant-design/icons';
import { Button, Empty, Progress } from 'antd';
import type { DocumentStatus, FileType, KnowledgeDocument } from '@/types';
import { formatSize } from '@/lib/document';
import KnowledgeDocumentDetail from './KnowledgeDocumentDetail';

const statusMeta: Record<DocumentStatus, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'processing' },
  parsing: { label: '解析中', color: 'blue' },
  chunking: { label: '切片中', color: 'gold' },
  embedding: { label: '向量化中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const fileIconMap: Record<FileType, string> = {
  pdf: '📄',
  markdown: '📝',
  text: '📃',
  word: '📘',
  excel: '📊',
};

interface KnowledgeDocumentListProps {
  documents: KnowledgeDocument[];
  expandedDocId: string;
  onExpand: (docId: string) => void;
  onDelete: (docId: string) => void;
}

export default function KnowledgeDocumentList({
  documents,
  expandedDocId,
  onExpand,
  onDelete,
}: KnowledgeDocumentListProps) {
  if (documents.length === 0) {
    return <Empty description="当前知识库暂无匹配内容" />;
  }

  return (
    <div className="knowledge-list">
      {documents.map((doc) => {
        const expanded = expandedDocId === doc.id;
        return (
          <article key={doc.id} className={`knowledge-card ${expanded ? 'is-expanded' : ''}`}>
            <div
              className="knowledge-card__summary"
              onClick={() => onExpand(doc.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onExpand(doc.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className={`file-icon file-icon--${doc.fileType}`}>{fileIconMap[doc.fileType]}</span>
              <span className="knowledge-card__title">
                <strong>{doc.title}</strong>
                <small>
                  创建于 2026-05-21 · 大小 {formatSize(doc.fileSize)} · {statusMeta[doc.status].label}
                </small>
              </span>
              {doc.status !== 'completed' && (
                <span className="knowledge-card__progress">
                  <Progress percent={doc.processingProgress} size="small" showInfo={false} />
                  <small>{doc.processingProgress}%</small>
                </span>
              )}
              <span className="knowledge-card__actions">
                <Button size="small" onClick={(event) => event.stopPropagation()}>
                  {expanded ? '收起详情' : '查看详情'}
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(doc.id);
                  }}
                >
                  删除
                </Button>
              </span>
            </div>
            {expanded && <KnowledgeDocumentDetail document={doc} />}
          </article>
        );
      })}
    </div>
  );
}
