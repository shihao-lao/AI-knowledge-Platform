import type { StructuredResume } from '@/types';
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
  documentCount: number;
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

// ==================== 用户大模型配置 ====================

/** 后端返回的模型配置，密钥只以脱敏形式给出。 */
export interface LLMSettings {
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  apiKeySet: boolean;
  apiKeyMasked: string;
  /** user = 用自己配置的；server = 服务端默认；none = 都没有 */
  source: 'user' | 'server' | 'none';
  configured: boolean;
  isCustom: boolean;
}

export interface LLMSettingsInput {
  provider: string;
  baseUrl: string;
  /** 省略或留空表示沿用已保存的密钥 */
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  clearApiKey?: boolean;
}

export interface LLMTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  model: string;
  reply: string;
  modelsAvailable: number;
}

export interface LLMModelsResult {
  ok: boolean;
  message: string;
  data: string[];
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

/**
 * 归一化消息引用字段。
 *
 * 历史数据把 citations 以 JSON 文本入库，接口曾原样返回字符串（如 "[]"）。
 * 字符串同样有 length，能骗过 `citations.length > 0` 判断，最终渲染时抛
 * `citations.map is not a function` 导致整页白屏，这里统一收敛为数组。
 */
export function normalizeCitations(raw: unknown): ApiMessage['citations'] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as ApiMessage['citations']) : [];
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
const USER_KEY = 'auth_user';

function cacheUser(token: string, user: ApiUser): void {
  if (typeof window !== 'undefined' && getToken() === token) {
    localStorage.setItem(USER_KEY, JSON.stringify({ token, user }));
  }
}

function cachedUser(token: string): ApiUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    const cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    return cached?.token === token && cached.user?.id === payload.sub ? cached.user : null;
  } catch {
    return null;
  }
}

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
  localStorage.removeItem(USER_KEY);
}

function toCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamelCase);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      // 下划线开头的键（如 _count）整体保留，否则会被改写成 Count 而丢失
      key.startsWith('_') ? key : key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
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
      if (getToken() !== token) throw new Error('请求的登录状态已变更，请重试');
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

export interface ApiInterview {
  id: string;
  conversationId: string;
  status: 'answering' | 'reviewing' | 'completed';
  currentPosition: number;
  turns: Array<{
    id: string;
    position: number;
    question: string;
    category: string;
    difficulty: string;
    userAnswer: string | null;
    grading: boolean;
    evaluation: {
      score: number;
      feedback: string;
      keyPoints: string[];
      referenceSummary: string;
      recordId: string;
    } | null;
  }>;
  summary: { questionCount: number; averageScore: number; keyPoints: string[] } | null;
  createdAt: string;
  completedAt: string | null;
}

export const api = {
  getInterview(conversationId: string): Promise<{ data: ApiInterview | null }> {
    return request(`${BASE}/conversations/${conversationId}/interview`);
  },

  startInterview(
    conversationId: string,
    count: number,
    difficulty?: string,
    category?: string,
  ): Promise<{ data: ApiInterview }> {
    return request(`${BASE}/conversations/${conversationId}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_count: count, difficulty, category }),
    });
  },

  answerInterview(conversationId: string, turnId: string, answer: string): Promise<{ data: ApiInterview }> {
    return request(`${BASE}/conversations/${conversationId}/interview/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turn_id: turnId, answer }),
    });
  },

  nextInterviewQuestion(conversationId: string, turnId: string): Promise<{ data: ApiInterview }> {
    return request(`${BASE}/conversations/${conversationId}/interview/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turn_id: turnId }),
    });
  },

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
      cacheUser(result.accessToken, result.data);
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
      cacheUser(loginResult.accessToken, loginResult.data);
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
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      // 旧请求不能清除后来登录的新令牌。
      if (getToken() !== token) return null;
      if (res.status === 401) {
        removeToken();
        return null;
      }
      if (!res.ok) {
        if (res.status >= 500) return cachedUser(token);
        return null;
      }
      const body = toCamelCase(await res.json()) as { data?: ApiUser };
      if (!body.data) throw new Error('用户信息响应无效');
      cacheUser(token, body.data);
      return body.data;
    } catch {
      return getToken() === token ? cachedUser(token) : null;
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
  async listMessages(conversationId: string): Promise<{ data: ApiMessage[] }> {
    const result = await request<{ data: ApiMessage[] }>(`${BASE}/conversations/${conversationId}/messages`);
    return { ...result, data: (result?.data ?? []).map((m) => ({ ...m, citations: normalizeCitations(m.citations) })) };
  },

  createMessage(
    conversationId: string,
    data: {
      role: 'user';
      content: string;
    },
  ): Promise<{ data: ApiMessage }> {
    const params = new URLSearchParams({
      role: data.role,
      content: data.content,
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
  ): Promise<{ data: { imported: number; skipped: number; errors: string[]; message: string } }> {
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

  updateResumeStructure(
    id: string,
    structured: StructuredResume,
  ): Promise<{
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

  async exportResume(
    id: string,
    format: 'pdf' | 'docx',
    style: 'classic' | 'compact' | 'modern' = 'classic',
  ): Promise<void> {
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

  // ==================== 用户大模型配置 ====================
  // 请求体需要 snake_case（后端 Pydantic 模型），响应由 request 自动转 camelCase。

  getLLMSettings(): Promise<LLMSettings> {
    return request(`${BASE}/settings/llm`);
  },

  saveLLMSettings(input: LLMSettingsInput): Promise<LLMSettings> {
    return request(`${BASE}/settings/llm`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: input.provider,
        base_url: input.baseUrl,
        api_key: input.apiKey,
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        timeout: input.timeout,
        clear_api_key: input.clearApiKey ?? false,
      }),
    });
  },

  resetLLMSettings(): Promise<LLMSettings> {
    return request(`${BASE}/settings/llm`, { method: 'DELETE' });
  },

  /** 测试连通性；未保存时可先带上待测参数，apiKey 留空则沿用已保存的密钥。 */
  testLLMSettings(input?: Partial<LLMSettingsInput>): Promise<LLMTestResult> {
    return request(`${BASE}/settings/llm/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: input?.baseUrl,
        api_key: input?.apiKey,
        model: input?.model,
        temperature: input?.temperature,
        max_tokens: input?.maxTokens,
        timeout: input?.timeout,
      }),
    });
  },

  /** 拉取服务商支持的模型列表，供下拉选择。 */
  listLLMModels(input?: Partial<LLMSettingsInput>): Promise<LLMModelsResult> {
    return request(`${BASE}/settings/llm/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: input?.baseUrl, api_key: input?.apiKey }),
    });
  },
};
