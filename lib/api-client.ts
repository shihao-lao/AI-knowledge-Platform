import type { Citation, StructuredResume } from '@/types';
import type { DocumentIndexStatus } from '@/lib/document-status';

export interface ApiDocumentUpload {
  id: string;
  filename: string;
  status: string;
  indexStatus: DocumentIndexStatus;
  chunkCount: number;
  message: string;
}

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
  indexStatus?: DocumentIndexStatus;
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
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Token 存储
const TOKEN_KEY = 'auth_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

function toCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamelCase);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      toCamelCase(nestedValue),
    ]),
  );
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // 如果有 token，添加 Authorization 头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    // 401 未授权：token 过期或无效，清除本地 token 并跳转登录
    if (res.status === 401 && !/\/auth\/(login|register)$/.test(url)) {
      removeToken();
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const loginUrl = `/login?from=${encodeURIComponent(currentPath)}`;
        window.location.href = loginUrl;
      }
      throw new Error('登录已过期，请重新登录');
    }

    const body = await res.json().catch(() => ({}));
    // 处理不同格式的错误响应
    let errorMessage = `HTTP ${res.status}`;
    if (typeof body === 'object' && body !== null) {
      if (typeof body.detail === 'string') {
        errorMessage = body.detail;
      } else if (typeof body.error === 'string') {
        errorMessage = body.error;
      } else if (typeof body.message === 'string') {
        errorMessage = body.message;
      } else if (Array.isArray(body.detail)) {
        // FastAPI 验证错误格式
        errorMessage = body.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    throw new Error(errorMessage);
  }
  return toCamelCase(await res.json()) as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ data: ApiUser; accessToken: string }> {
    const result = await request<{ data: ApiUser; accessToken: string }>(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    // 存储 token
    if (result.accessToken) {
      setToken(result.accessToken);
    }
    return result;
  },

  async register(name: string, email: string, password: string): Promise<{ data: ApiUser }> {
    const result = await request<{ data: ApiUser }>(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    // 注册成功后自动登录获取 token
    // 由于后端注册接口不返回 token，需要调用登录接口
    const loginResult = await request<{ data: ApiUser; accessToken: string }>(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (loginResult.accessToken) {
      setToken(loginResult.accessToken);
    }
    return result;
  },

  logout(): Promise<{ data: { loggedOut: boolean } }> {
    // 清除本地 token
    removeToken();
    return request(`${BASE}/auth/logout`, { method: 'POST' });
  },

  /** 获取当前登录用户；未登录返回 null（不抛错） */
  async me(): Promise<ApiUser | null> {
    try {
      const token = getToken();
      if (!token) return null;
      const res = await fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // token 过期，清除
        removeToken();
        return null;
      }
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
    return request(`${BASE}/document?knowledge_id=${encodeURIComponent(knowledgeId)}`);
  },

  getDocument(id: string): Promise<{ data: ApiDocument }> {
    return request(`${BASE}/document/${id}`);
  },

  uploadDocument(
    knowledgeId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ data: ApiDocumentUpload }> {
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
          resolve(toCamelCase(JSON.parse(xhr.responseText)) as { data: ApiDocumentUpload });
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(typeof body.detail === 'string' ? body.detail : body.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.open('POST', `${BASE}/document/upload?knowledge_id=${encodeURIComponent(knowledgeId)}`);
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(form);
    });
  },

  deleteDocument(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/document/${id}`, { method: 'DELETE' });
  },

  updateDocumentEnabled(id: string, enabled: boolean): Promise<{ data: ApiDocument }> {
    return request(`${BASE}/document/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  },

  // Citation Stats
  getCitationStats(knowledgeId: string): Promise<{ data: CitationStatsData }> {
    return request(`${BASE}/citations/stats?knowledge_id=${encodeURIComponent(knowledgeId)}`);
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
    return request(`${BASE}/conversations?knowledge_id=${encodeURIComponent(knowledgeId)}`);
  },

  getConversation(id: string): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversations/${id}`);
  },

  createConversation(knowledgeId: string, title?: string): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversations?knowledge_id=${encodeURIComponent(knowledgeId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  },

  updateConversation(id: string, data: { title?: string }): Promise<{ data: ApiConversation }> {
    return request(`${BASE}/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteConversation(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/conversations/${id}`, { method: 'DELETE' });
  },

  // Message
  listMessages(conversationId: string): Promise<{ data: ApiMessage[] }> {
    return request(`${BASE}/conversations/${conversationId}/messages`);
  },

  createMessage(
    conversationId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      citations?: Citation[];
    },
  ): Promise<{ data: ApiMessage }> {
    const params = new URLSearchParams({
      role: data.role,
      content: data.content,
      citations: JSON.stringify(data.citations || []),
    });
    return request(`${BASE}/conversations/${conversationId}/messages?${params.toString()}`, {
      method: 'POST',
    });
  },

  // Question Bank
  listQuestions(params: {
    knowledgeId: string;
    category?: string;
    difficulty?: string;
    keyword?: string;
  }): Promise<{ data: ApiQuestion[]; categories: string[] }> {
    const qs = new URLSearchParams({ knowledge_id: params.knowledgeId });
    if (params.category) qs.set('category', params.category);
    if (params.difficulty) qs.set('difficulty', params.difficulty);
    if (params.keyword) qs.set('keyword', params.keyword);
    return request(`${BASE}/questions?${qs.toString()}`);
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
    return request(`${BASE}/questions/import?knowledge_id=${encodeURIComponent(knowledgeId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    });
  },

  deleteQuestion(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/questions/${id}`, { method: 'DELETE' });
  },

  // Practice
  evaluatePractice(questionId: string, userAnswer: string): Promise<{ data: PracticeResult }> {
    return request(`${BASE}/practice/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, user_answer: userAnswer }),
    });
  },

  getPracticeStats(knowledgeId: string): Promise<{ data: PracticeStats }> {
    return request(`${BASE}/practice/stats?knowledge_id=${encodeURIComponent(knowledgeId)}`);
  },

  // Resume
  listResumes(): Promise<{
    data: Array<{ id: string; filename: string; fileSize: number; score: number; createdAt: string }>;
  }> {
    return request(`${BASE}/resumes`);
  },

  getResume(id: string): Promise<{
    data: {
      id: string;
      filename: string;
      fileSize: number;
      score: number;
      content: string;
      analysis: string;
      createdAt: string;
      structured?: StructuredResume | null;
    };
  }> {
    return request(`${BASE}/resumes/${encodeURIComponent(id)}`);
  },

  updateResumeStructure(id: string, structured: StructuredResume): Promise<{
    data: {
      id: string;
      filename: string;
      fileSize: number;
      score: number;
      content: string;
      analysis: string;
      createdAt: string;
      structured?: StructuredResume | null;
    };
  }> {
    return request(`${BASE}/resumes/${encodeURIComponent(id)}/structure`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structured }),
    });
  },

  reparseResumeStructure(id: string): Promise<{
    data: {
      id: string;
      filename: string;
      fileSize: number;
      score: number;
      content: string;
      analysis: string;
      createdAt: string;
      structured?: StructuredResume | null;
    };
  }> {
    return request(`${BASE}/resumes/${encodeURIComponent(id)}/structure/parse`, { method: 'POST' });
  },

  async exportResume(id: string, format: 'pdf' | 'docx', style: 'classic' | 'compact' | 'modern' = 'classic'): Promise<void> {
    const token = getToken();
    const res = await fetch(
      `${BASE}/resumes/${encodeURIComponent(id)}/export?format=${format}&style=${encodeURIComponent(style)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`;
      throw new Error(detail);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = utf8Match
      ? decodeURIComponent(utf8Match[1])
      : plainMatch
        ? plainMatch[1]
        : `resume${style === 'classic' ? '' : `-${style}`}.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  uploadResume(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{
    data: {
      id: string;
      filename: string;
      fileSize: number;
      score: number;
      analysis: string;
      createdAt: string;
      structured?: StructuredResume | null;
      content?: string;
    };
  }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.min(Math.round((e.loaded / e.total) * 70), 70));
        }
      };
      xhr.upload.onload = () => {
        onProgress?.(75);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(toCamelCase(JSON.parse(xhr.responseText)) as Awaited<ReturnType<typeof api.uploadResume>>);
          } catch {
            reject(new Error('简历分析返回了无效数据，请重试'));
          }
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(body.detail || body.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.timeout = 240000;
      xhr.ontimeout = () => reject(new Error('简历分析超时，请稍后查看历史记录或重试'));
      xhr.open('POST', `${BASE}/resumes/upload`);
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(form);
    });
  },

  deleteResume(id: string): Promise<{ data: { deleted: boolean } }> {
    return request(`${BASE}/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // AI 工具（文档摘要 / 专家 Skill）
  async aiGenerate(action: 'summary' | 'skill', title: string, content: string): Promise<{ data: string }> {
    const result = await request<{ data: string }>(`${BASE}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, title, content }),
    });
    return result;
  },
};
