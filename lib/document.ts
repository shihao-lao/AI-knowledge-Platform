import type { FileType } from '@/types';

export const fileTypeText: Record<FileType, string> = {
  markdown: '标记文档',
  text: '纯文本文档',
  word: 'Word 文档',
};

export function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}
