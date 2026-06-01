import { create } from 'zustand';
import type { KnowledgeBase, KnowledgeDocument } from '@/types';

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

export const useExpandedDocId = () => useKnowledgeStore((s) => s.expandedDocId);
