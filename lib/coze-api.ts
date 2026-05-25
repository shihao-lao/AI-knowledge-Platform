const COZE_API_BASE = 'https://api.coze.cn';

export const cozeConfig = {
  apiBase: COZE_API_BASE,
  getToken: (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('coze_access_token') || process.env.NEXT_PUBLIC_COZE_TOKEN || '';
  },
  getSpaceId: (): string => {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('coze_space_id') ||
      process.env.NEXT_PUBLIC_COZE_SPACE_ID ||
      ''
    );
  },
  getBotId: (): string => {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('coze_bot_id') ||
      process.env.NEXT_PUBLIC_COZE_BOT_ID ||
      ''
    );
  },
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coze_access_token', token);
    }
  },
  setSpaceId: (spaceId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coze_space_id', spaceId);
    }
  },
  setBotId: (botId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coze_bot_id', botId);
    }
  },
};

export async function cozeFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = cozeConfig.getToken();
  if (!token) {
    throw new Error('Coze access token is not configured. Please set it in settings.');
  }

  const url = `${COZE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new CozeApiError(
      errorData.msg || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData.code
    );
  }

  const data = await response.json();
  if (data.code !== 0 && data.code !== undefined) {
    throw new CozeApiError(data.msg || 'API Error', response.status, data.code);
  }

  return data.data as T;
}

export class CozeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number
  ) {
    super(message);
    this.name = 'CozeApiError';
  }
}
