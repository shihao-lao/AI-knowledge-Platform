import type { DocumentStatus, FileType } from '@/types';

export const statusMeta: Record<DocumentStatus, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'processing' },
  parsing: { label: '解析中', color: 'blue' },
  chunking: { label: '切片中', color: 'gold' },
  embedding: { label: '向量化中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

export const fileTypeText: Record<FileType, string> = {
  pdf: 'PDF 文档',
  markdown: '标记文档',
  text: '纯文本文档',
  word: 'Word 文档',
  excel: 'Excel 表格',
};

export function formatSize(size: number) {
  return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
}
