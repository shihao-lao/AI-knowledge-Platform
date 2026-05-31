import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createWelcomeMessage } from '@/lib/chat';
import type { Conversation, Message } from '@/types';

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  loading: boolean;
  total: number;
  hasMore: boolean;

  addConversation: (conversation: Conversation, welcomeMessages?: Message[]) => string;
  deleteConversation: (conversationId: string) => void;
  updateConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  ensureConversationMessages: (conversationId: string, kbName: string) => void;
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
  hasMore: false,

  addConversation: (conversation, welcomeMessages) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversation.id]: welcomeMessages ?? [],
      },
    }));
    return conversation.id;
  },

  deleteConversation: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.messagesByConversation;
      return {
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        messagesByConversation: rest,
      };
    });
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
export const useHasMore = () => useChatStore((s) => s.hasMore);
export const useConversationTotal = () => useChatStore((s) => s.total);

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
