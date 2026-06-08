'use client';

import { Progress, Tag, Typography, message } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypePrism from 'rehype-prism-plus';
import type { KnowledgeDocument } from '@/types';
import { statusMeta } from '@/lib/constants';

interface KnowledgeDocumentDetailProps {
  document: KnowledgeDocument;
}

function ContentRenderer({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="html-content">
        <p>暂无内容</p>
      </div>
    );
  }

  return (
    <div className="html-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypePrism]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function KnowledgeDocumentDetail({ document: doc }: KnowledgeDocumentDetailProps) {
  return (
    <div className="knowledge-detail">
      <div className="knowledge-detail__toolbar">
        <Typography.Title level={3}>{doc.title}：内容解析与知识摘要</Typography.Title>
      </div>
      <Typography.Paragraph>
        当前内容已经被解析为可检索的知识片段，后续提问时系统会优先召回相关段落，并在回答中给出来源。
      </Typography.Paragraph>
      <div className="uploaded-content">
        <div className="uploaded-content__head">
          <strong>导入内容</strong>
          <Tag color={statusMeta[doc.status].color}>{statusMeta[doc.status].label}</Tag>
        </div>
        {doc.status !== 'completed' && <Progress percent={doc.processingProgress} size="small" />}
        <ContentRenderer content={doc.content || ''} />
      </div>
      <pre className="knowledge-code">
        <button
          type="button"
          onClick={() => {
            const text = `标题：${doc.title}\n状态：${statusMeta[doc.status].label}\n切片数：${doc.chunkCount || 0}\n用途：用于当前知识库问答与引用溯源`;
            navigator.clipboard
              .writeText(text)
              .then(() => message.success('已复制'))
              .catch(() => message.error('复制失败'));
          }}
        >
          复制
        </button>
        <code>{`标题：${doc.title}\n状态：${statusMeta[doc.status].label}\n切片数：${doc.chunkCount || 0}\n用途：用于当前知识库问答与引用溯源`}</code>
      </pre>
    </div>
  );
}
