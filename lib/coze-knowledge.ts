import { cozeFetch, cozeConfig } from './coze-api';
import type { KnowledgeBase } from '@/types';

export interface CozeDataset {
  dataset_id: string;
  name: string;
  description?: string;
  space_id: string;
  format_type: number;
  created_at: number;
  updated_at: number;
  file_count?: number;
}

export interface CreateDatasetParams {
  name: string;
  space_id?: string;
  format_type?: number;
  description?: string;
  file_id?: string;
}

export interface UpdateDatasetParams {
  name?: string;
  description?: string;
  file_id?: string;
}

export async function listDatasets(): Promise<CozeDataset[]> {
  const spaceId = cozeConfig.getSpaceId();
  if (!spaceId) throw new Error('Space ID is not configured');

  return cozeFetch<CozeDataset[]>(
    `/v1/datasets?space_id=${spaceId}&page_num=1&page_size=50`
  );
}

export async function createDataset(
  params: CreateDatasetParams
): Promise<{ dataset_id: string }> {
  const spaceId = params.space_id || cozeConfig.getSpaceId();
  if (!spaceId) throw new Error('Space ID is not configured');

  return cozeFetch<{ dataset_id: string }>('/v1/datasets', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      space_id: spaceId,
      format_type: params.format_type || 0,
    }),
  });
}

export async function getDataset(
  datasetId: string
): Promise<CozeDataset> {
  return cozeFetch<CozeDataset>(`/v1/datasets/${datasetId}`);
}

export async function updateDataset(
  datasetId: string,
  params: UpdateDatasetParams
): Promise<void> {
  await cozeFetch<void>(`/v1/datasets/${datasetId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function deleteDataset(datasetId: string): Promise<void> {
  await cozeFetch<void>(`/v1/datasets/${datasetId}`, {
    method: 'DELETE',
  });
}

export function transformToKnowledgeBase(dataset: CozeDataset): KnowledgeBase {
  return {
    id: dataset.dataset_id,
    name: dataset.name,
    description: dataset.description || '',
    visibility: 'private' as const,
    stats: {
      documentCount: dataset.file_count || 0,
      conversationCount: 0,
      memberCount: 0,
      lastActiveAt: new Date(dataset.updated_at).toISOString(),
    },
    createdAt: new Date(dataset.created_at).toISOString(),
    updatedAt: new Date(dataset.updated_at).toISOString(),
  };
}
