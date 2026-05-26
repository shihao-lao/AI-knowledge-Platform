import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { KnowledgeBase, KnowledgeDocument, Visibility } from '@/types';
import { api } from '@/lib/api';

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
  loading: boolean;

  fetchKnowledgeBases: () => Promise<void>;
  fetchDocuments: (kbId?: string) => Promise<void>;
  addKnowledgeBase: (kb: KnowledgeBase) => Promise<void>;
  updateKnowledgeBase: (kbId: string, patch: Partial<KnowledgeBase>) => Promise<void>;
  removeKnowledgeBase: (kbId: string) => Promise<void>;
  addDocument: (doc: KnowledgeDocument) => Promise<void>;
  updateDocument: (documentId: string, patch: Partial<KnowledgeDocument>) => void;
  removeDocument: (documentId: string, activeKbId: string) => Promise<void>;
  setExpandedDocId: (documentId: string) => void;
  resolveExpandedDocForKb: (kbId: string) => void;
}

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

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  documents: [],
  expandedDocId: '',
  loading: false,

  fetchKnowledgeBases: async () => {
    set({ loading: true });
    try {
      const res = await api.kb.list();
      if (res.code === 0) {
        set({ knowledgeBases: res.data });
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchDocuments: async (kbId) => {
    if (!kbId) return;
    try {
      const res = await api.documents.list(kbId);
      if (res.code === 0) {
        set((state) => ({
          documents: [
            ...state.documents.filter((d) => d.knowledgeBaseId !== kbId),
            ...res.data,
          ],
        }));
      }
    } catch {}
  },

  addKnowledgeBase: async (kb) => {
    set((state) => ({
      knowledgeBases: [kb, ...state.knowledgeBases.filter((existing) => existing.id !== kb.id)],
    }));
  },

  updateKnowledgeBase: async (kbId, patch) => {
    await api.kb.update(kbId, patch);
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === kbId ? { ...kb, ...patch, updatedAt: new Date().toISOString() } : kb,
      ),
    }));
  },

  removeKnowledgeBase: async (kbId) => {
    await api.kb.delete(kbId);
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== kbId),
      documents: state.documents.filter((doc) => doc.knowledgeBaseId !== kbId),
    }));
  },

  addDocument: async (doc) => {
    set((state) => ({
      documents: [doc, ...state.documents],
      expandedDocId: doc.id,
    }));

    setTimeout(() => {
      get().updateDocument(doc.id, { status: 'completed', processingProgress: 100, chunkCount: 5 });
    }, 3000);
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

  removeDocument: async (documentId, activeKbId) => {
    await api.documents.delete(documentId);
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
