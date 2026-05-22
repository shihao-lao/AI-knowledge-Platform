'use client';

import { FileMarkdownOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import { Progress, Typography } from 'antd';
import type { Citation } from '@/types/domain';

interface CitationCardProps {
  citation: Citation;
  active?: boolean;
  onOpen: (citation: Citation) => void;
}

function CitationCard({ citation, active, onOpen }: CitationCardProps) {
  const Icon = citation.documentTitle.endsWith('.pdf')
    ? FilePdfOutlined
    : citation.documentTitle.endsWith('.md')
      ? FileMarkdownOutlined
      : FileTextOutlined;

  return (
    <button
      className={`citation-card ${active ? 'is-active' : ''}`}
      style={{ borderLeftColor: citation.color }}
      onClick={() => onOpen(citation)}
      type="button"
    >
      <span className="citation-card__head">
        <Icon />
        <Typography.Text ellipsis strong>
          {citation.documentTitle}
        </Typography.Text>
      </span>
      <Typography.Paragraph ellipsis={{ rows: 2 }} className="citation-card__preview">
        {citation.preview}
      </Typography.Paragraph>
      <span className="citation-card__meta">
        <span>第 {citation.chunkIndex} 段</span>
        <span>{Math.round(citation.confidenceScore * 100)}% 匹配</span>
      </span>
      <Progress
        percent={Math.round(citation.confidenceScore * 100)}
        showInfo={false}
        size="small"
        strokeColor={citation.color}
      />
      <span className="citation-card__action">点击查看原文</span>
    </button>
  );
}

export default CitationCard;
