// Coze 知识库 API 配置
const COZE_API_BASE = process.env.NEXT_PUBLIC_COZE_API_BASE || 'https://api.coze.cn';
const COZE_KNOWLEDGE_TOKEN = process.env.NEXT_PUBLIC_COZE_KNOWLEDGE_TOKEN!;
const COZE_DATASET_TOKEN = process.env.NEXT_PUBLIC_COZE_DATASET_TOKEN!;
const COZE_LIST_DATASETS_TOKEN = process.env.NEXT_PUBLIC_COZE_LIST_DATASETS_TOKEN!;
const DEFAULT_DATASET_ID = process.env.NEXT_PUBLIC_COZE_DATASET_ID!;
const DEFAULT_SPACE_ID = process.env.NEXT_PUBLIC_COZE_SPACE_ID!;

// ==================== 类型定义 ====================

/** 创建知识库请求 */
export interface CreateDatasetRequest {
  name: string;
  space_id?: string;
  format_type?: number;
}

/** 创建知识库响应 */
export interface CreateDatasetResponse {
  code: number;
  msg: string;
  data?: {
    dataset_id: string;
    name: string;
    status: string;
  };
}

/** 文档信息 */
export interface DocumentBase {
  name: string;
  source_info: {
    file_base64: string;
  };
}

/** 创建文档请求 */
export interface CreateDocumentRequest {
  dataset_id?: string;
  document_bases: DocumentBase[];
  chunk_strategy?: {
    chunk_type: number;
  };
  format_type?: number;
}

/** 创建文档响应 */
export interface CreateDocumentResponse {
  code: number;
  msg: string;
  data?: {
    document_ids: string[];
  };
}

// ==================== API 函数 ====================

/**
 * 创建知识库
 *
 * @param params - 创建知识库参数
 * @returns 创建结果
 */
export async function createDataset(params: CreateDatasetRequest): Promise<CreateDatasetResponse> {
  try {
    const requestData = {
      name: params.name,
      space_id: params.space_id || DEFAULT_SPACE_ID,
      format_type: params.format_type ?? 0,
    };

    console.log('[Coze KB] 创建知识库:', requestData.name);
    console.log('[Coze KB] space_id:', requestData.space_id);

    const response = await fetch(`${COZE_API_BASE}/v1/datasets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_DATASET_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('[Coze KB] response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Coze KB] API error:', response.status, errorText);
      return {
        code: response.status,
        msg: `API 错误 ${response.status}: ${errorText}`,
      };
    }

    const responseData = await response.json();
    console.log('[Coze KB] response:', responseData);

    return responseData;
  } catch (error) {
    console.error('[Coze KB] fetch error:', error);
    return {
      code: -1,
      msg: '创建知识库失败，请检查网络连接',
    };
  }
}

/**
 * 创建知识库文档
 *
 * @param params - 创建文档参数
 * @returns 创建结果
 */
export async function createDocument(params: CreateDocumentRequest): Promise<CreateDocumentResponse> {
  try {
    const requestData = {
      dataset_id: params.dataset_id || DEFAULT_DATASET_ID,
      document_bases: params.document_bases,
      chunk_strategy: params.chunk_strategy || { chunk_type: 0 },
      format_type: params.format_type ?? 0,
    };

    console.log('[Coze KB] 创建文档, dataset_id:', requestData.dataset_id);
    console.log('[Coze KB] documents count:', requestData.document_bases.length);

    const response = await fetch(`${COZE_API_BASE}/open_api/knowledge/document/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_KNOWLEDGE_TOKEN}`,
        'Agw-Js-Conv': 'str',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('[Coze KB] response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Coze KB] API error:', response.status, errorText);
      return {
        code: response.status,
        msg: `API 错误 ${response.status}: ${errorText}`,
      };
    }

    const responseData = await response.json();
    console.log('[Coze KB] response:', responseData);

    return responseData;
  } catch (error) {
    console.error('[Coze KB] fetch error:', error);
    return {
      code: -1,
      msg: '创建文档失败，请检查网络连接',
    };
  }
}

/**
 * 将文件转换为 Base64
 *
 * @param file - 文件对象
 * @returns Base64 编码字符串
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 上传文件到知识库
 *
 * @param file - 文件对象
 * @param datasetId - 知识库 ID（可选）
 * @returns 上传结果
 */
export async function uploadFile(file: File, datasetId?: string): Promise<CreateDocumentResponse> {
  try {
    const base64 = await fileToBase64(file);

    return createDocument({
      dataset_id: datasetId,
      document_bases: [
        {
          name: file.name,
          source_info: {
            file_base64: base64,
          },
        },
      ],
    });
  } catch (error) {
    console.error('[Coze KB] file conversion error:', error);
    return {
      code: -1,
      msg: '文件转换失败',
    };
  }
}

/** 知识库文档列表请求 */
export interface ListDocumentsRequest {
  dataset_id?: string;
}

/** 文档信息 */
export interface DocumentInfo {
  document_id: string;
  name: string;
  status: number;
  size: number;
  char_count: number;
  slice_count: number;
  type: string;
  create_time: number;
  update_time: number;
  web_url: string;
}

/** 知识库文档列表响应 */
export interface ListDocumentsResponse {
  code: number;
  msg: string;
  document_infos?: DocumentInfo[];
  total?: number;
}

/**
 * 获取知识库文档列表
 *
 * @param params - 请求参数
 * @returns 文档列表
 */
export async function listDocuments(params?: ListDocumentsRequest): Promise<ListDocumentsResponse> {
  try {
    const requestData = {
      dataset_id: params?.dataset_id || DEFAULT_DATASET_ID,
    };

    console.log('[Coze KB] 获取文档列表, dataset_id:', requestData.dataset_id);

    const response = await fetch(`${COZE_API_BASE}/open_api/knowledge/document/list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_KNOWLEDGE_TOKEN}`,
        'Agw-Js-Conv': 'str',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('[Coze KB] response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Coze KB] API error:', response.status, errorText);
      return {
        code: response.status,
        msg: `API 错误 ${response.status}: ${errorText}`,
      };
    }

    const responseData = await response.json();
    console.log('[Coze KB] response:', responseData);

    return responseData;
  } catch (error) {
    console.error('[Coze KB] fetch error:', error);
    return {
      code: -1,
      msg: '获取文档列表失败，请检查网络连接',
    };
  }
}

/** 知识库列表请求 */
export interface ListDatasetsRequest {
  space_id?: string;
}

/** 知识库信息 */
export interface DatasetInfo {
  dataset_id: string;
  name: string;
  description: string;
  status: number;
  format_type: number;
  doc_count: number;
  slice_count: number;
  all_file_size: string;
  file_list: string[];
  icon_url: string;
  icon_uri: string;
  creator_name: string;
  creator_id: string;
  avatar_url: string;
  create_time: number;
  update_time: number;
  can_edit: boolean;
  bot_used_count: number;
  hit_count: number;
  space_id: string;
  project_id: string;
  chunk_strategy: Record<string, unknown>;
  failed_file_list: string[];
  processing_file_list: string[];
  processing_file_id_list: string[];
}

/** 知识库列表响应 */
export interface ListDatasetsResponse {
  code: number;
  msg: string;
  data?: {
    total_count: number;
    dataset_list: DatasetInfo[];
  };
}

/**
 * 获取知识库列表
 *
 * @param params - 请求参数
 * @returns 知识库列表
 */
export async function listDatasets(params?: ListDatasetsRequest): Promise<ListDatasetsResponse> {
  try {
    const spaceId = params?.space_id || DEFAULT_SPACE_ID;

    console.log('[Coze KB] 获取知识库列表, space_id:', spaceId);

    const response = await fetch(`${COZE_API_BASE}/v1/datasets?space_id=${spaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${COZE_LIST_DATASETS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[Coze KB] response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Coze KB] API error:', response.status, errorText);
      return {
        code: response.status,
        msg: `API 错误 ${response.status}: ${errorText}`,
      };
    }

    const responseData = await response.json();
    console.log('[Coze KB] response:', responseData);

    return responseData;
  } catch (error) {
    console.error('[Coze KB] fetch error:', error);
    return {
      code: -1,
      msg: '获取知识库列表失败，请检查网络连接',
    };
  }
}
