import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { conversations as mockConversations } from '@/data/mock';
import { createWelcomeMessage, buildInitialMessagesMap } from '@/lib/chat';
import {
  listConversations,
  deleteConversation as cozeDeleteConversation,
  chatStream,
} from '@/lib/coze-chat';
import { cozeConfig } from '@/lib/coze-api';
import type { Conversation, Message } from '@/types';

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  loading: boolean;
  error: string | null;
  streamingMessage: string | null;

  loadConversations: () => Promise<void>;
  addConversation: (conversation: Conversation, welcomeMessages: Message[]) => string;
  updateConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  removeConversation: (conversationId: string) => Promise<void>;
  ensureConversationMessages: (conversationId: string, kbName: string) => void;
  setConversationMessages: (
    conversationId: string,
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void;
  syncConversationMeta: (conversationId: string, messages: Message[]) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    onStream?: (text: string) => void,
  ) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: mockConversations,
  messagesByConversation: buildInitialMessagesMap(),
  loading: false,
  error: null,
  streamingMessage: null,

  loadConversations: async () => {
    const token = cozeConfig.getToken();
    if (!token) {
      set({ conversations: mockConversations, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const conversations = await listConversations();
      set({ conversations, loading: false });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        loading: false,
      });
    }
  },

  addConversation: (conversation, welcomeMessages) => {
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

  removeConversation: async (conversationId) => {
    const token = cozeConfig.getToken();
    if (token) {
      try {
        await cozeDeleteConversation(conversationId);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        throw error;
      }
    }

    set((state) => ({
      conversations: state.conversations.filter((chat) => chat.id !== conversationId),
      messagesByConversation: Object.fromEntries(
        Object.entries(state.messagesByConversation).filter(([id]) => id !== conversationId)
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

  sendMessage: async (conversationId, content, onStream) => {
    const token = cozeConfig.getToken();
    if (!token) throw new Error('Coze API is not configured');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    get().setConversationMessages(conversationId, (prev) => [...prev, userMessage]);
    set({ streamingMessage: '', loading: true });

    try {
      let fullContent = '';

      for await (const event of chatStream({
        conversation_id: conversationId,
        additional_messages: [
          {
            role: 'user',
            type: 'question',
            content,
            content_type: 'text',
          },
        ],
      })) {
        if (event.event === 'message') {
          fullContent += event.data;
          set({ streamingMessage: fullContent });
          onStream?.(fullContent);
        }
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        citations: [],
        createdAt: new Date().toISOString(),
      };

      get().setConversationMessages(conversationId, (prev) => [...prev, assistantMessage]);
      set({ streamingMessage: null, loading: false });
      get().syncConversationMeta(conversationId, [
        ...(get().messagesByConversation[conversationId] || []),
        assistantMessage,
      ]);
    } catch (error) {
      console.error('Failed to send message:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
        streamingMessage: null,
        loading: false,
      });
      throw error;
    }
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
