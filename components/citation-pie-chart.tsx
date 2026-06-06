'use client';

import dynamic from 'next/dynamic';
import type { CitationDocStat } from '@/lib/api-client';

const Pie = dynamic(() => import('@ant-design/charts').then((m) => m.Pie), { ssr: false });

interface Props {
  documents: CitationDocStat[];
}

export default function CitationPieChart({ documents }: Props) {
  const data = documents.map((d) => ({
    documentTitle: d.documentTitle.length > 16 ? d.documentTitle.slice(0, 16) + '…' : d.documentTitle,
    citationCount: d.citationCount,
  }));

  const config = {
    data,
    angleField: 'citationCount',
    colorField: 'documentTitle',
    innerRadius: 0.55,
    label: {
      text: (d: { documentTitle: string }) => d.documentTitle,
      style: { fontSize: 11 },
    },
    legend: { color: { position: 'bottom' as const, layout: { justifyContent: 'center' as const } } },
    height: 360,
    interaction: { elementHighlight: true },
  };

  return <Pie {...config} />;
}
