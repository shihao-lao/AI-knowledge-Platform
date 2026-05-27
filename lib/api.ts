const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  kb: {
    list: async () => {
      const res = await fetch(`${API_BASE}/api/kb`);
      return { code: 0, data: await res.json() };
    },
    create: async (data: { name: string; description?: string; visibility?: string }) => {
      const res = await fetch(`${API_BASE}/api/kb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { code: res.ok ? 0 : 1, data: await res.json() };
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/kb/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { code: res.ok ? 0 : 1, data: await res.json() };
    },
    delete: async (id: string) => {
      await fetch(`${API_BASE}/api/kb/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { code: 0, data: null };
    },
  },

  documents: {
    list: async (kbId: string) => {
      const res = await fetch(`${API_BASE}/api/documents?kbId=${encodeURIComponent(kbId)}`);
      return { code: 0, data: await res.json() };
    },
    create: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { code: res.ok ? 0 : 1, data: await res.json() };
    },
    delete: async (id: string) => {
      await fetch(`${API_BASE}/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { code: 0, data: null };
    },
  },

  conversations: {
    list: async (kbId?: string, limit?: number, offset?: number) => {
      const params = new URLSearchParams();
      if (kbId) params.set('kbId', kbId);
      if (limit) params.set('limit', String(limit));
      if (offset) params.set('offset', String(offset));
      const qs = params.toString();
      const res = await fetch(`${API_BASE}/api/conversations${qs ? `?${qs}` : ''}`);
      return { code: 0, data: await res.json() };
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(id)}`);
      return { code: res.ok ? 0 : 1, data: await res.json() };
    },
    create: async (knowledgeBaseId: string, title?: string) => {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId, title }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      return { code: res.ok ? 0 : 1, data };
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { code: res.ok ? 0 : 1, data: null };
    },
  },

  chat: {
    send: (conversationId: string, content: string) =>
      fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content }),
      }),
  },
};
