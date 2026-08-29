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
  enabled: boolean;
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
  chunkIndex: number;
  documentId: string;
  knowledgeId: string;
}

export interface SearchResponse {
  chunks: SearchResult[];
}

export interface CitationDocStat {
  documentId: string;
  documentTitle: string;
  citationCount: number;
  averageConfidence: number;
  chunkBreakdown: Array<{ chunkIndex: number; count: number }>;
}

export interface CitationStatsData {
  summary: {
    totalCitations: number;
    uniqueDocumentsCited: number;
    totalConversations: number;
    totalAssistantMessages: number;
  };
  documents: CitationDocStat[];
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

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ApiQuestion {
  id: string;
  knowledgeId: string;
  category: string;
  difficulty: string;
  question: string;
  answer: string;
  keywords: string[];
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeResult {
  recordId: string;
  score: number;
  feedback: string;
  keyPoints: string[];
  referenceSummary: string;
}

export interface PracticeStats {
  total: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  byCategory: Array<{ key: string; count: number; averageScore: number }>;
  byDifficulty: Array<{ key: string; count: number; averageScore: number }>;
  recent: Array<{
    id: string;
    score: number;
    question: string;
    category: string;
    difficulty: string;
    evaluatedAt: string;
  }>;
}

// API 基础 URL，指向 Python 后端
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
  // Auth
  login(email: string, password: string): Promise<{ data: ApiUser }> {
    return request(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  },

  register(name: string, email: string, password: string): Promise<{ data: ApiUser }> {
    return request(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
  },

  logout(): Promise<{ data: { loggedOut: boolean } }> {
    return request(`${BASE}/auth/logout`, { method: 'POST' });
  },

  /** 获取当前登录用户；未登录返回 null（不抛错） */
  async me(): Promise<ApiUser | null> {
    try {
      const res = await fetch(`${BASE}/auth/me`);
      if (!res.ok) return null;
      const body = await res.json();
      return body.data ?? null;
    } catch {
      return null;
    }
  },

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

  updateKnowledge(id: string, data: { name?: string; description?: string }): Promise<{ data: ApiKnowledge }> {
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

  updateDocumentEnabled(id: string, enabled: boolean): Promise<{ data: ApiDocument }> {
    return request(`${BASE}/document/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  },

  // Citation Stats
  getCitationStats(knowledgeId: string): Promise<{ data: CitationStatsData }> {
    return request(`${BASE}/knowledge/${encodeURIComponent(knowledgeId)}/citation-stats`);
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

  // Question Bank
  listQuestions(params: {
    knowledgeId: string;
    category?: string;
    difficulty?: string;
    keyword?: string;
  }): Promise<{ data: ApiQuestion[]; categories: string[] }> {
    const qs = new URLSearchParams({ knowledgeId: params.knowledgeId });
    if (params.category) qs.set('category', params.category);
    if (params.difficulty) qs.set('difficulty', params.difficulty);
    if (params.keyword) qs.set('keyword', params.keyword);
    return request(`${BASE}/question?${qs.toString()}`);
  },

  importQuestions(
    knowledgeId: string,
    questions: Array<{
      category?: string;
      difficulty?: string;
      question: string;
      answer: string;
      keywords?: string[];
      source?: string;
    }>,
  ): Promise<{ data: { count: number } }> {
    return request(`${BASE}/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledgeId, questions }),
    });
  },

  deleteQuestion(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/question/${id}`, { method: 'DELETE' });
  },

  // Practice
  evaluatePractice(questionId: string, userAnswer: string): Promise<{ data: PracticeResult }> {
    return request(`${BASE}/practice/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, userAnswer }),
    });
  },

  getPracticeStats(knowledgeId: string): Promise<{ data: PracticeStats }> {
    return request(`${BASE}/practice/stats?knowledgeId=${encodeURIComponent(knowledgeId)}`);
  },

  // Resume
  listResumes(): Promise<{
    data: Array<{ id: string; filename: string; fileSize: number; score: number; createdAt: string }>;
  }> {
    return request(`${BASE}/resume`);
  },

  getResume(
    id: string,
  ): Promise<{ data: { id: string; filename: string; fileSize: number; score: number; content: string; analysis: string; createdAt: string } }> {
    return request(`${BASE}/resume?id=${encodeURIComponent(id)}`);
  },

  uploadResume(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ data: { id: string; filename: string; fileSize: number; score: number; analysis: string; createdAt: string } }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

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
      xhr.open('POST', `${BASE}/resume`);
      xhr.send(form);
    });
  },

  deleteResume(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/resume?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
