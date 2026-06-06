'use client';

import dynamic from 'next/dynamic';
import type { CitationDocStat } from '@/lib/api-client';

const Column = dynamic(() => import('@ant-design/charts').then((m) => m.Column), { ssr: false });

interface Props {
  documents: CitationDocStat[];
}

export default function CitationBarChart({ documents }: Props) {
  const data = documents.map((d) => ({
    documentTitle: d.documentTitle.length > 16 ? d.documentTitle.slice(0, 16) + '…' : d.documentTitle,
    citationCount: d.citationCount,
  }));

  const config = {
    data,
    xField: 'documentTitle',
    yField: 'citationCount',
    color: '#4f46e5',
    label: { position: 'middle' as const, style: { fill: '#fff', fontSize: 12 } },
    xAxis: { label: { autoRotate: true } },
    yAxis: { title: { text: '引用次数' } },
    height: 360,
    columnStyle: { radius: [4, 4, 0, 0] },
  };

  return <Column {...config} />;
}
