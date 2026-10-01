'use client';

import { Table } from 'antd';
import type { CitationDocStat } from '@/lib/api-client';

interface Props {
  documents: CitationDocStat[];
}

function confidenceStyle(score: number): React.CSSProperties {
  if (score >= 0.85)
    return {
      color: 'var(--color-score-high)',
      background: 'var(--color-score-high-bg)',
      border: '1px solid var(--color-score-high-border)',
      borderRadius: 4,
      padding: '0 6px',
      fontSize: 12,
    };
  if (score >= 0.65)
    return {
      color: 'var(--color-score-medium)',
      background: 'var(--color-score-medium-bg)',
      border: '1px solid var(--color-score-medium-border)',
      borderRadius: 4,
      padding: '0 6px',
      fontSize: 12,
    };
  return {
    color: 'var(--color-score-low)',
    background: 'var(--color-score-low-bg)',
    border: '1px solid var(--color-score-low-border)',
    borderRadius: 4,
    padding: '0 6px',
    fontSize: 12,
  };
}

export default function CitationStatsTable({ documents }: Props) {
  const columns = [
    {
      title: '文档名称',
      dataIndex: 'documentTitle',
      key: 'documentTitle',
      ellipsis: true,
    },
    {
      title: '引用次数',
      dataIndex: 'citationCount',
      key: 'citationCount',
      sorter: (a: CitationDocStat, b: CitationDocStat) => a.citationCount - b.citationCount,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '平均置信度',
      dataIndex: 'averageConfidence',
      key: 'averageConfidence',
      sorter: (a: CitationDocStat, b: CitationDocStat) => a.averageConfidence - b.averageConfidence,
      render: (score: number) => <span style={confidenceStyle(score)}>{(score * 100).toFixed(1)}%</span>,
    },
    {
      title: '最常被引段落',
      key: 'topChunk',
      render: (_: unknown, record: CitationDocStat) => {
        const top = record.chunkBreakdown[0];
        return top ? `第 ${top.chunkIndex + 1} 段 (${top.count} 次)` : '-';
      },
    },
  ];

  return (
    <Table
      dataSource={documents}
      columns={columns}
      rowKey="documentId"
      pagination={documents.length > 10 ? { pageSize: 10 } : false}
      size="middle"
    />
  );
}
