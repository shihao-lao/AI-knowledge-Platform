'use client';

import { FileMarkdownOutlined, FileTextOutlined } from '@ant-design/icons';
import { Progress, Typography } from 'antd';
import type { Citation } from '@/types';

interface CitationCardProps {
  citation: Citation;
  active?: boolean;
  onOpen: (citation: Citation) => void;
}

function getRelevanceTier(score: number): { label: string; color: string } {
  if (score >= 0.85) return { label: '高度相关', color: '#52c41a' };
  if (score >= 0.65) return { label: '较为相关', color: '#faad14' };
  return { label: '一般相关', color: '#ff7a45' };
}

function CitationCard({ citation, active, onOpen }: CitationCardProps) {
  const Icon = citation.documentTitle.endsWith('.md') ? FileMarkdownOutlined : FileTextOutlined;

  const percent = Math.round(citation.confidenceScore * 100);
  const tier = getRelevanceTier(citation.confidenceScore);
  const barColor =
    citation.confidenceScore >= 0.85 ? '#52c41a' : citation.confidenceScore >= 0.65 ? '#faad14' : '#ff7a45';

  return (
    <button
      className={`citation-card ${active ? 'is-active' : ''}`}
      style={{ borderLeftColor: barColor }}
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
        <span>第 {citation.chunkIndex + 1} 段</span>
        <span className="citation-card__score" style={{ color: barColor }}>
          {tier.label} {percent}%
        </span>
      </span>
      <Progress percent={percent} showInfo={false} size="small" strokeColor={barColor} trailColor="rgba(0,0,0,0.06)" />
      <span className="citation-card__action">点击查看原文</span>
    </button>
  );
}

export default CitationCard;
