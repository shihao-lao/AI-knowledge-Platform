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
  expandedDocIds: string[];

  addKnowledgeBase: (kb: KnowledgeBase) => void;
  updateKnowledgeBase: (kbId: string, patch: Partial<KnowledgeBase>) => void;
  removeKnowledgeBase: (kbId: string) => void;
  addDocument: (doc: KnowledgeDocument) => void;
  updateDocument: (documentId: string, patch: Partial<KnowledgeDocument>) => void;
  removeDocument: (documentId: string) => void;
  toggleExpandedDocId: (documentId: string) => void;
  collapseAllDocs: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  knowledgeBases: [],
  documents: [],
  expandedDocIds: [],

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
        expandedDocIds: [doc.id],
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

  removeDocument: (documentId) => {
    set((state) => {
      const documents = state.documents.filter((doc) => doc.id !== documentId);
      return {
        documents,
        expandedDocIds: state.expandedDocIds.filter((id) => id !== documentId),
        knowledgeBases: recalcDocStats(state.knowledgeBases, documents),
      };
    });
  },

  toggleExpandedDocId: (documentId) => {
    set((state) => {
      const ids = state.expandedDocIds;
      const next = ids.includes(documentId) ? ids.filter((id) => id !== documentId) : [...ids, documentId];
      return { expandedDocIds: next };
    });
  },

  collapseAllDocs: () => set({ expandedDocIds: [] }),
}));

export const useExpandedDocIds = () => useKnowledgeStore((s) => s.expandedDocIds);
