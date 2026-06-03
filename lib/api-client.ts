import type { Citation } from '@/types';

export interface ApiKnowledge {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
}

export interface ApiDocument {
  id: string;
  knowledgeId: string;
  filename: string;
  filepath: string;
  mimeType: string;
  size: number;
  parseStatus: string;
  chunkCount: number;
  charCount: number;
  createdAt: string;
  updatedAt: string;
  chunks?: ApiChunk[];
}

export interface ApiChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  createdAt: string;
}

export interface SearchResult {
  content: string;
  score: number;
  source: string;
  chunkId: string;
  documentId: string;
  knowledgeId: string;
}

export interface SearchResponse {
  chunks: SearchResult[];
}

export interface ApiConversation {
  id: string;
  knowledgeId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages?: ApiMessage[];
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Array<{
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    preview: string;
    confidenceScore: number;
  }>;
  createdAt: string;
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = (body as { error?: string; details?: string }).error || `HTTP ${res.status}`;
    const details = (body as { details?: string }).details;
    throw new Error(details ? `${error}: ${details}` : error);
  }
  return res.json();
}

export const api = {
  // Knowledge CRUD
  listKnowledge(): Promise<{ data: ApiKnowledge[] }> {
    return request(`${BASE}/knowledge`);
  },

  getKnowledge(id: string): Promise<{ data: ApiKnowledge }> {
    return request(`${BASE}/knowledge/${id}`);
  },

  createKnowledge(data: { name: string; description?: string }): Promise<{ data: ApiKnowledge }> {
    return request(`${BASE}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateKnowledge(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<{ data: ApiKnowledge }> {
    return request(`${BASE}/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteKnowledge(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/knowledge/${id}`, { method: 'DELETE' });
  },

  // Document
  listDocuments(knowledgeId: string): Promise<{ data: ApiDocument[] }> {
    return request(`${BASE}/document?knowledgeId=${encodeURIComponent(knowledgeId)}`);
  },

  getDocument(id: string): Promise<{ data: ApiDocument }> {
    return request(`${BASE}/document/${id}`);
  },

  uploadDocument(
    knowledgeId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ data: ApiDocument }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);
      form.append('knowledgeId', knowledgeId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(body.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.open('POST', `${BASE}/document/upload`);
      xhr.send(form);
    });
  },

  deleteDocument(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/document/${id}`, { method: 'DELETE' });
  },

  // Search
  search(params: {
    query: string;
    knowledgeId?: string;
    topK?: number;
    scoreThreshold?: number;
  }): Promise<SearchResponse> {
    return request(`${BASE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  // Conversation
  listConversations(knowledgeId: string): Promise<{ data: ApiConversation[] }> {
    return request(`${BASE}/conversation?knowledgeId=${encodeURIComponent(knowledgeId)}`);
  },

  getConversation(id: string): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversation/${id}`);
  },

  createConversation(knowledgeId: string, title?: string): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledgeId, title }),
    });
  },

  updateConversation(id: string, data: { title?: string }): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversation/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteConversation(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/conversation/${id}`, { method: 'DELETE' });
  },

  // Message
  listMessages(conversationId: string): Promise<{ data: ApiMessage[] }> {
    return request(`${BASE}/conversation/${conversationId}/message`);
  },

  createMessage(
    conversationId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      citations?: Citation[];
    },
  ): Promise<{ data: ApiMessage }> {
    return request(`${BASE}/conversation/${conversationId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};
