import { cozeFetch, cozeConfig } from './coze-api';
import type { KnowledgeDocument, DocumentStatus } from '@/types';

export interface CozeKnowledgeFile {
  file_id: string;
  name: string;
  size: number;
  status: number;
  created_at: number;
  updated_at: number;
  training_status?: number;
}

export interface CreateKnowledgeFileParams {
  file_ids: string[];
  name?: string;
  segment_rule?: number;
  re_segment?: boolean;
}

export interface UploadProgress {
  file_id: string;
  status: 'waiting' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

const STATUS_MAP: Record<number, UploadProgress['status']> = {
  0: 'waiting',
  1: 'parsing',
  2: 'chunking',
  3: 'embedding',
  4: 'completed',
  5: 'failed',
};

export async function listKnowledgeFiles(
  datasetId: string
): Promise<CozeKnowledgeFile[]> {
  return cozeFetch<CozeKnowledgeFile[]>(
    `/v1/datasets/${datasetId}/knowledge/files?page_num=1&page_size=50`
  );
}

export async function createKnowledgeFiles(
  datasetId: string,
  params: CreateKnowledgeFileParams
): Promise<{ file_id: string; name: string }[]> {
  return cozeFetch<{ file_id: string; name: string }[]>(
    `/v1/datasets/${datasetId}/knowledge/files`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        segment_rule: params.segment_rule || 0,
      }),
    }
  );
}

export async function deleteKnowledgeFile(
  datasetId: string,
  _fileId: string
): Promise<void> {
  await cozeFetch<void>(
    `/v1/datasets/${datasetId}/knowledge/files/${_fileId}`,
    { method: 'DELETE' }
  );
}

export async function getDatasetProgress(
  datasetId: string,
  fileId: string
): Promise<UploadProgress> {
  const data = await cozeFetch<{
    status: number;
    progress: number;
    failure_reason?: string;
  }>(`/v1/datasets/${datasetId}/knowledge/files/progress?file_id=${fileId}`);

  return {
    file_id: fileId,
    status: STATUS_MAP[data.status] || 'completed',
    progress: data.progress || 100,
    error: data.failure_reason,
  };
}

export async function uploadFile(file: File): Promise<string> {
  const token = cozeConfig.getToken();
  if (!token) throw new Error('Coze access token is not configured');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${cozeConfig.apiBase}/v1/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(data.msg || 'Upload failed');
  }

  return data.data.file_id;
}

export function transformToDocument(
  file: CozeKnowledgeFile,
  datasetId: string
): KnowledgeDocument {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let fileType: KnowledgeDocument['fileType'] = 'text';
  if (ext === 'pdf') fileType = 'pdf';
  else if (ext === 'md' || ext === 'markdown') fileType = 'markdown';
  else if (ext === 'doc' || ext === 'docx') fileType = 'word';
  else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'excel';

  return {
    id: file.file_id,
    knowledgeBaseId: datasetId,
    title: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    fileType,
    fileSize: file.size,
    content: '',
    status: (STATUS_MAP[file.status] || 'completed') as DocumentStatus,
    processingProgress: file.training_status === 4 ? 100 : 70,
    chunkCount: 0,
    uploadedBy: {
      id: '',
      name: '当前用户',
      email: '',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date(file.created_at).toISOString(),
    updatedAt: new Date(file.updated_at).toISOString(),
  };
}
