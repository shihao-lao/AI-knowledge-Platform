'use client';

import { Drawer, Empty, Space, Tag, Typography } from 'antd';
import type { Citation, KnowledgeDocument } from '@/types/domain';

interface DocumentPreviewProps {
  open: boolean;
  document?: KnowledgeDocument;
  citation?: Citation;
  onClose: () => void;
}

function DocumentPreview({ open, document, citation, onClose }: DocumentPreviewProps) {
  return (
    <Drawer width={640} open={open} onClose={onClose} title={document?.title ?? '文档预览'} destroyOnHidden>
      {document ? (
        <div className="doc-preview">
          <Space wrap className="doc-preview__meta">
            <Tag color="blue">{document.fileName}</Tag>
            <Tag>{(document.fileSize / 1024).toFixed(1)} KB</Tag>
            <Tag color="green">{document.chunkCount} Chunks</Tag>
          </Space>
          <Typography.Title level={4}>目录</Typography.Title>
          <ol className="toc-list">
            <li>文档摘要</li>
            <li className={citation ? 'toc-list__active' : ''}>引用段落</li>
            <li>上下文说明</li>
          </ol>
          <Typography.Title level={4}>原文片段</Typography.Title>
          <div className="quoted-block">
            <Typography.Paragraph>{document.content}</Typography.Paragraph>
            {citation && <Typography.Paragraph className="highlighted-quote">{citation.preview}</Typography.Paragraph>}
          </div>
        </div>
      ) : (
        <Empty description="选择一个引用来源后查看文档原文" />
      )}
    </Drawer>
  );
}

export default DocumentPreview;
