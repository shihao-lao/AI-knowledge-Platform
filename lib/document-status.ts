import type { DocumentStatus } from '@/types';

export type DocumentIndexStatus = 'indexed' | 'keyword_only' | 'unknown';

export function documentStatus(status: string): DocumentStatus {
  // Compatibility with documents and API servers created before the status migration.
  if (status === 'ready') return 'completed';
  if (['pending', 'uploading', 'parsing', 'chunking', 'embedding', 'completed', 'failed'].includes(status)) {
    return status as DocumentStatus;
  }
  return 'pending';
}

export function indexStatusText(status?: DocumentIndexStatus): string {
  if (status === 'indexed') return '语义索引已完成';
  if (status === 'keyword_only') return '仅关键词检索可用，语义索引将在下次问答时重试';
  return '已解析，关键词检索可用；语义索引状态待确认';
}
