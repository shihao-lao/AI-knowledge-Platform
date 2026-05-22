import { create } from 'zustand';
import {
  conversations as mockConversations,
  documents as mockDocuments,
  knowledgeBases as mockKnowledgeBases,
} from '@/data/mock';
import { createWelcomeMessage, buildInitialMessagesMap } from '@/lib/chat-helpers';
import type { Conversation, KnowledgeBase, KnowledgeDocument, Message } from '@/types/domain';

function recalcKbStats(kbList: KnowledgeBase[], documents: KnowledgeDocument[], conversations: Conversation[]) {
  return kbList.map((kb) => {
    const documentCount = documents.filter((doc) => doc.knowledgeBaseId === kb.id).length;
    const conversationCount = conversations.filter((chat) => chat.knowledgeBaseId === kb.id).length;
    return {
      ...kb,
      stats: {
        ...kb.stats,
        documentCount,
        conversationCount,
        lastActiveAt: new Date().toISOString(),
      },
    };
  });
}

interface WorkspaceState {
  knowledgeBases: KnowledgeBase[];
  documents: KnowledgeDocument[];
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  expandedDocId: string;

  addKnowledgeBase: (kb: KnowledgeBase) => void;
  addDocument: (doc: KnowledgeDocument) => void;
  updateDocument: (documentId: string, patch: Partial<KnowledgeDocument>) => void;
  removeDocument: (documentId: string, activeKbId: string) => void;
  addConversation: (conversation: Conversation, welcomeMessages: Message[]) => string;
  updateConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  ensureConversationMessages: (conversationId: string, kbName: string) => void;
  setConversationMessages: (
    conversationId: string,
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void;
  syncConversationMeta: (conversationId: string, messages: Message[]) => void;
  setExpandedDocId: (documentId: string) => void;
  resolveExpandedDocForKb: (kbId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  knowledgeBases: mockKnowledgeBases,
  documents: mockDocuments,
  conversations: mockConversations,
  messagesByConversation: buildInitialMessagesMap(),
  expandedDocId: mockDocuments[0]?.id ?? '',

  addKnowledgeBase: (kb) => {
    set((state) => {
      const knowledgeBases = [kb, ...state.knowledgeBases];
      return { knowledgeBases: recalcKbStats(knowledgeBases, state.documents, state.conversations) };
    });
  },

  addDocument: (doc) => {
    set((state) => {
      const documents = [doc, ...state.documents];
      return {
        documents,
        expandedDocId: doc.id,
        knowledgeBases: recalcKbStats(state.knowledgeBases, documents, state.conversations),
      };
    });
  },

  updateDocument: (documentId, patch) => {
    set((state) => {
      const documents = state.documents.map((doc) =>
        doc.id === documentId ? { ...doc, ...patch, updatedAt: new Date().toISOString() } : doc,
      );
      return {
        documents,
        knowledgeBases: recalcKbStats(state.knowledgeBases, documents, state.conversations),
      };
    });
  },

  removeDocument: (documentId, activeKbId) => {
    set((state) => {
      const documents = state.documents.filter((doc) => doc.id !== documentId);
      let expandedDocId = state.expandedDocId;
      if (expandedDocId === documentId) {
        expandedDocId = documents.find((doc) => doc.knowledgeBaseId === activeKbId)?.id ?? '';
      }
      return {
        documents,
        expandedDocId,
        knowledgeBases: recalcKbStats(state.knowledgeBases, documents, state.conversations),
      };
    });
  },

  addConversation: (conversation, welcomeMessages) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversation.id]: welcomeMessages,
      },
      knowledgeBases: recalcKbStats(state.knowledgeBases, state.documents, [conversation, ...state.conversations]),
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

  setExpandedDocId: (documentId) => set({ expandedDocId: documentId }),

  resolveExpandedDocForKb: (kbId) => {
    const { documents, expandedDocId } = get();
    const current = documents.find((doc) => doc.id === expandedDocId);
    if (current?.knowledgeBaseId === kbId) return;
    const firstDoc = documents.find((doc) => doc.knowledgeBaseId === kbId);
    set({ expandedDocId: firstDoc?.id ?? '' });
  },
}));

export const useKnowledgeBases = () => useWorkspaceStore((s) => s.knowledgeBases);
export const useDocuments = () => useWorkspaceStore((s) => s.documents);
export const useConversations = () => useWorkspaceStore((s) => s.conversations);
export const useExpandedDocId = () => useWorkspaceStore((s) => s.expandedDocId);

export function useDocumentsByKb(kbId: string) {
  return useWorkspaceStore((s) => s.documents.filter((doc) => doc.knowledgeBaseId === kbId));
}

export function useConversationsByKb(kbId: string) {
  return useWorkspaceStore((s) => s.conversations.filter((chat) => chat.knowledgeBaseId === kbId));
}

export function useConversationMessages(conversationId: string) {
  return useWorkspaceStore((s) => s.messagesByConversation[conversationId] ?? []);
}
