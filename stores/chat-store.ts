import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/lib/api';
import type { Conversation, Message } from '@/types';

const PAGE_SIZE = 20;

function buildWelcomeMessage(kbName: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `你好，我已准备好基于「${kbName}」中的资料回答问题。开始输入你的问题吧，我会尽量附上可验证的引用来源。`,
    citations: [],
    createdAt: new Date().toISOString(),
  };
}

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  loading: boolean;
  total: number;
  hasMore: boolean;

  fetchConversations: (kbId?: string, reset?: boolean) => Promise<void>;
  loadMoreConversations: (kbId?: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  addConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  setConversationMessages: (
    conversationId: string,
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void;
  syncConversationMeta: (conversationId: string, messages: Message[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  loading: false,
  total: 0,
  hasMore: true,

  fetchConversations: async (kbId?: string, _reset = true) => {
    set({ loading: true });
    try {
      const res = await api.conversations.list(kbId, PAGE_SIZE, 0);
      if (res.code === 0) {
        const { items, total } = res.data;
        set({
          conversations: items as Conversation[],
          total,
          hasMore: items.length < total,
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  loadMoreConversations: async (kbId?: string) => {
    const { conversations, loading } = get();
    if (loading) return;
    set({ loading: true });
    try {
      const res = await api.conversations.list(kbId, PAGE_SIZE, conversations.length);
      if (res.code === 0) {
        const { items, total } = res.data;
        set((state) => ({
          conversations: [...state.conversations, ...items],
          total,
          hasMore: state.conversations.length + items.length < total,
        }));
      }
    } finally {
      set({ loading: false });
    }
  },

  loadMessages: async (conversationId: string) => {
    const res = await api.conversations.get(conversationId);
    if (res.code === 0 && res.data?.messages) {
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: res.data.messages as Message[],
        },
      }));
    }
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      total: state.total + 1,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversation.id]: [buildWelcomeMessage('当前知识库')],
      },
    }));
  },

  deleteConversation: async (conversationId: string) => {
    await api.conversations.delete(conversationId);
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== conversationId);
      const { [conversationId]: _, ...rest } = state.messagesByConversation;
      return { conversations, messagesByConversation: rest, total: state.total - 1 };
    });
  },

  updateConversation: (conversationId, patch) => {
    set((state) => ({
      conversations: state.conversations.map((chat) =>
        chat.id === conversationId ? { ...chat, ...patch, updatedAt: new Date().toISOString() } : chat,
      ),
    }));
  },

  setConversationMessages: (conversationId, updater) => {
    set((state) => {
      const current = state.messagesByConversation[conversationId] ?? [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        messagesByConversation: { ...state.messagesByConversation, [conversationId]: next },
      };
    });
  },

  syncConversationMeta: (conversationId, messages) => {
    set((state) => ({
      conversations: state.conversations.map((chat) =>
        chat.id === conversationId ? { ...chat, messageCount: messages.length, updatedAt: new Date().toISOString() } : chat,
      ),
    }));
  },
}));

export const useConversations = () => useChatStore((s) => s.conversations);

export function useConversationsByKb(kbId: string) {
  return useChatStore(
    useShallow((s) => {
      const chats = s.conversations.filter((chat) => chat.knowledgeBaseId === kbId);
      return chats.length ? chats : EMPTY_ARRAY;
    }),
  );
}

export function useConversationMessages(conversationId: string) {
  return useChatStore(
    useShallow((s) => {
      const msgs = s.messagesByConversation[conversationId];
      return msgs?.length ? msgs : EMPTY_ARRAY;
    }),
  );
}

export const useHasMore = () => useChatStore((s) => s.hasMore);
export const useConversationTotal = () => useChatStore((s) => s.total);

const EMPTY_ARRAY: never[] = [];
