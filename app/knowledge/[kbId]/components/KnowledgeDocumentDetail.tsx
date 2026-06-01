'use client';

import { Progress, Tag, Typography } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { KnowledgeDocument } from '@/types';
import { statusMeta } from '@/lib/document';

interface KnowledgeDocumentDetailProps {
  document: KnowledgeDocument;
}

/** 检测内容是否包含 HTML 标签 */
function isHtmlContent(content: string): boolean {
  // 检测常见的 HTML 标签
  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  return htmlTagPattern.test(content);
}

/** 渲染内容 - 自动检测 HTML 或 Markdown */
function ContentRenderer({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="html-content">
        <p>暂无内容</p>
      </div>
    );
  }

  // 检测是否为 HTML 内容
  if (isHtmlContent(content)) {
    return <div className="html-content" dangerouslySetInnerHTML={{ __html: content }} />;
  }

  // Markdown 内容
  return (
    <div className="html-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
      <Typography.Paragraph>重点摘要：</Typography.Paragraph>
      <ul className="knowledge-points">
        <li>资料会经历上传、读取、解析、切片、向量化四个阶段。</li>
        <li>完成后的知识片段可被 AI 对话检索，并作为回答依据。</li>
        <li>引用来源需要能回到原文段落，保证回答可验证。</li>
      </ul>
      <pre className="knowledge-code">
        <button type="button">复制</button>
        <code>{`知识片段示例：\n标题：${doc.title}\n状态：${statusMeta[doc.status].label}\n用途：用于当前知识库问答与引用溯源`}</code>
      </pre>
    </div>
  );
}
