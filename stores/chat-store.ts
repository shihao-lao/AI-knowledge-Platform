import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { conversations as mockConversations } from '@/data/mock';
import { createWelcomeMessage, buildInitialMessagesMap } from '@/lib/chat';
import type { Conversation, Message } from '@/types';

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;

  addConversation: (conversation: Conversation, welcomeMessages: Message[]) => string;
  updateConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  ensureConversationMessages: (conversationId: string, kbName: string) => void;
  setConversationMessages: (
    conversationId: string,
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void;
  syncConversationMeta: (conversationId: string, messages: Message[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: mockConversations,
  messagesByConversation: buildInitialMessagesMap(),

<<<<<<< HEAD
  fetchConversations: async (kbId?: string) => {
    set({ loading: true, conversations: [], total: 0, hasMore: true });
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
    const { loading } = get();
    if (loading) return;
    set({ loading: true });
    try {
      const offset = get().conversations.filter((c) => !kbId || c.knowledgeBaseId === kbId).length;
      const res = await api.conversations.list(kbId, PAGE_SIZE, offset);
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
=======
  addConversation: (conversation, welcomeMessages) => {
>>>>>>> parent of 590a572 (feat: 迁移至真实后端 API、优化对话布局与滚动体验)
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversation.id]: welcomeMessages,
      },
    }));
    return conversation.id;
  },

  updateConversation: (conversationId, patch) => {
    set((state) => ({
      conversations: state.conversations.map((chat) =>
        chat.id === conversationId ? { ...chat, ...patch, updatedAt: new Date().toISOString() } : chat,
      ),
    }));
  },

  ensureConversationMessages: (conversationId, kbName) => {
    const { messagesByConversation } = get();
    if (messagesByConversation[conversationId]) return;
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [createWelcomeMessage(kbName)],
      },
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
    get().updateConversation(conversationId, { messageCount: messages.length });
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

const EMPTY_ARRAY: never[] = [];
