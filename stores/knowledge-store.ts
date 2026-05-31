import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { KnowledgeBase, KnowledgeDocument, Visibility } from '@/types';

export function buildKnowledgeBase(values: { name: string; description?: string; visibility: Visibility }): KnowledgeBase {
  const now = new Date().toISOString();
  return {
    id: `kb_${crypto.randomUUID().slice(0, 8)}`,
    name: values.name,
    description: values.description ?? '',
    visibility: values.visibility,
    stats: { documentCount: 0, conversationCount: 0, memberCount: 1, lastActiveAt: now },
    createdAt: now,
    updatedAt: now,
  };
}

function recalcDocStats(kbList: KnowledgeBase[], documents: KnowledgeDocument[]) {
  return kbList.map((kb) => ({
    ...kb,
    stats: {
      ...kb.stats,
      documentCount: documents.filter((doc) => doc.knowledgeBaseId === kb.id).length,
      lastActiveAt: new Date().toISOString(),
    },
  }));
}

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  documents: KnowledgeDocument[];
  expandedDocId: string;

  addKnowledgeBase: (kb: KnowledgeBase) => void;
  updateKnowledgeBase: (kbId: string, patch: Partial<KnowledgeBase>) => void;
  removeKnowledgeBase: (kbId: string) => void;
  addDocument: (doc: KnowledgeDocument) => void;
  updateDocument: (documentId: string, patch: Partial<KnowledgeDocument>) => void;
  removeDocument: (documentId: string, activeKbId: string) => void;
  setExpandedDocId: (documentId: string) => void;
  resolveExpandedDocForKb: (kbId: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  documents: [],
  expandedDocId: '',

  addKnowledgeBase: (kb) => {
    set((state) => ({
      knowledgeBases: recalcDocStats([kb, ...state.knowledgeBases], state.documents),
    }));
  },

  updateKnowledgeBase: (kbId, patch) => {
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === kbId ? { ...kb, ...patch, updatedAt: new Date().toISOString() } : kb,
      ),
    }));
  },

  removeKnowledgeBase: (kbId) => {
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== kbId),
      documents: state.documents.filter((doc) => doc.knowledgeBaseId !== kbId),
    }));
  },

  addDocument: (doc) => {
    set((state) => {
      const documents = [doc, ...state.documents];
      return {
        documents,
        expandedDocId: doc.id,
        knowledgeBases: recalcDocStats(state.knowledgeBases, documents),
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
        knowledgeBases: recalcDocStats(state.knowledgeBases, documents),
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
        knowledgeBases: recalcDocStats(state.knowledgeBases, documents),
      };
    });
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

export const useKnowledgeBases = () => useKnowledgeStore((s) => s.knowledgeBases);
export const useDocuments = () => useKnowledgeStore((s) => s.documents);
export const useExpandedDocId = () => useKnowledgeStore((s) => s.expandedDocId);

export function useDocumentsByKb(kbId: string) {
  return useKnowledgeStore(
    useShallow((s) => {
      const docs = s.documents.filter((doc) => doc.knowledgeBaseId === kbId);
      return docs.length ? docs : EMPTY_ARRAY;
    }),
  );
}

const EMPTY_ARRAY: never[] = [];
