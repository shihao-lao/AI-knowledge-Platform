'use client';

import { DeleteOutlined } from '@ant-design/icons';
import { App, Button, Empty, Progress } from 'antd';
import type { FileType, KnowledgeDocument } from '@/types';
import { formatSize } from '@/lib/document';
import { statusMeta } from '@/lib/constants';
import KnowledgeDocumentDetail from './KnowledgeDocumentDetail';

const fileIconMap: Record<FileType, string> = {
  markdown: '📝',
  text: '📃',
  word: '📘',
};

interface KnowledgeDocumentListProps {
  documents: KnowledgeDocument[];
  expandedDocIds: string[];
  onToggleExpand: (docId: string) => void;
  onDelete: (docId: string) => void;
}

export default function KnowledgeDocumentList({
  documents,
  expandedDocIds,
  onToggleExpand,
  onDelete,
}: KnowledgeDocumentListProps) {
  const { modal } = App.useApp();

  if (documents.length === 0) {
    return <Empty description="当前知识库暂无匹配内容" />;
  }

  return (
    <div className="knowledge-list">
      {documents.map((doc) => {
        const expanded = expandedDocIds.includes(doc.id);
        return (
          <article key={doc.id} className={`knowledge-card ${expanded ? 'is-expanded' : ''}`}>
            <div className="knowledge-card__summary">
              <span className={`file-icon file-icon--${doc.fileType}`}>{fileIconMap[doc.fileType]}</span>
              <span className="knowledge-card__title">
                <strong>{doc.title}</strong>
                <small>
                  创建于 {new Date(doc.createdAt).toLocaleDateString('zh-CN')} · 大小 {formatSize(doc.fileSize)} ·{' '}
                  {statusMeta[doc.status].label}
                </small>
              </span>
              {doc.status !== 'completed' && (
                <span className="knowledge-card__progress">
                  <Progress percent={doc.processingProgress} size="small" showInfo={false} />
                  <small>{doc.processingProgress}%</small>
                </span>
              )}
              <span className="knowledge-card__actions">
                <Button size="small" onClick={() => onToggleExpand(doc.id)}>
                  {expanded ? '收起详情' : '查看详情'}
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    modal.confirm({
                      title: '确定删除此文档？',
                      content: `删除「${doc.title}」后不可恢复，相关知识切片也将被清除。`,
                      okText: '删除',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: () => onDelete(doc.id),
                    });
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
