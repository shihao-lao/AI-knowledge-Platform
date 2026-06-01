import type { DocumentStatus } from '@/types';

export const statusMeta: Record<DocumentStatus, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'processing' },
  parsing: { label: '解析中', color: 'blue' },
  chunking: { label: '切片中', color: 'gold' },
  embedding: { label: '向量化中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};
