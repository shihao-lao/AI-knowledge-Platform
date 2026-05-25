import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  documents as mockDocuments,
  knowledgeBases as mockKnowledgeBases,
} from '@/data/mock';
import {
  listDatasets,
  createDataset,
  updateDataset,
  deleteDataset,
  transformToKnowledgeBase,
} from '@/lib/coze-knowledge';
import {
  listKnowledgeFiles,
  uploadFile,
  createKnowledgeFiles,
  deleteKnowledgeFile,
  getDatasetProgress,
  transformToDocument,
} from '@/lib/coze-document';
import { cozeConfig } from '@/lib/coze-api';
import type { KnowledgeBase, KnowledgeDocument, Visibility, DocumentStatus } from '@/types';

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
  loading: boolean;
  error: string | null;

  loadKnowledgeBases: () => Promise<void>;
  loadDocuments: (kbId: string) => Promise<void>;
  addKnowledgeBase: (kb: KnowledgeBase) => Promise<void>;
  updateKnowledgeBase: (kbId: string, patch: Partial<KnowledgeBase>) => Promise<void>;
  removeKnowledgeBase: (kbId: string) => Promise<void>;
  addDocument: (doc: KnowledgeDocument) => void;
  uploadDocument: (kbId: string, file: File) => Promise<void>;
  updateDocument: (documentId: string, patch: Partial<KnowledgeDocument>) => void;
  removeDocument: (documentId: string, activeKbId: string) => Promise<void>;
  setExpandedDocId: (documentId: string) => void;
  resolveExpandedDocForKb: (kbId: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: mockKnowledgeBases,
  documents: mockDocuments,
  expandedDocId: mockDocuments[0]?.id ?? '',
  loading: false,
  error: null,

  loadKnowledgeBases: async () => {
    const token = cozeConfig.getToken();
    if (!token) {
      set({ knowledgeBases: mockKnowledgeBases, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const datasets = await listDatasets();
      const knowledgeBases = datasets.map(transformToKnowledgeBase);
      set({ knowledgeBases, loading: false });
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load knowledge bases',
        loading: false,
      });
    }
  },

  loadDocuments: async (kbId: string) => {
    const token = cozeConfig.getToken();
    if (!token) {
      set({
        documents: mockDocuments.filter((doc) => doc.knowledgeBaseId === kbId),
        error: null,
      });
      return;
    }

    set({ loading: true, error: null });
    try {
      const files = await listKnowledgeFiles(kbId);
      const documents = files.map((file) => transformToDocument(file, kbId));
      set((state) => ({
        documents: [
          ...state.documents.filter((doc) => doc.knowledgeBaseId !== kbId),
          ...documents,
        ],
        expandedDocId: documents[0]?.id || state.expandedDocId,
        loading: false,
      }));
    } catch (error) {
      console.error('Failed to load documents:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load documents',
        loading: false,
      });
    }
  },

  addKnowledgeBase: async (kb) => {
    const token = cozeConfig.getToken();
    if (!token) {
      set((state) => ({
        knowledgeBases: recalcDocStats([kb, ...state.knowledgeBases], state.documents),
      }));
      return;
    }

    try {
      await createDataset({
        name: kb.name,
        description: kb.description,
      });
      set((state) => ({
        knowledgeBases: recalcDocStats([kb, ...state.knowledgeBases], state.documents),
      }));
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      throw error;
    }
  },

  updateKnowledgeBase: async (kbId, patch) => {
    const token = cozeConfig.getToken();
    if (!token) {
      set((state) => ({
        knowledgeBases: state.knowledgeBases.map((kb) =>
          kb.id === kbId ? { ...kb, ...patch, updatedAt: new Date().toISOString() } : kb,
        ),
      }));
      return;
    }

    try {
      await updateDataset(kbId, patch);
      set((state) => ({
        knowledgeBases: state.knowledgeBases.map((kb) =>
          kb.id === kbId ? { ...kb, ...patch, updatedAt: new Date().toISOString() } : kb,
        ),
      }));
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
      throw error;
    }
  },

  removeKnowledgeBase: async (kbId) => {
    const token = cozeConfig.getToken();
    if (token) {
      try {
        await deleteDataset(kbId);
      } catch (error) {
        console.error('Failed to delete knowledge base:', error);
        throw error;
      }
    }

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

  uploadDocument: async (kbId, file) => {
    const token = cozeConfig.getToken();
    if (!token) throw new Error('Coze API is not configured');

    set({ loading: true, error: null });
    try {
      const fileId = await uploadFile(file);
      await createKnowledgeFiles(kbId, { file_ids: [fileId] });

      const newDoc: KnowledgeDocument = {
        id: fileId,
        knowledgeBaseId: kbId,
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        fileType: 'text',
        fileSize: file.size,
        content: '',
        status: 'uploading',
        processingProgress: 0,
        chunkCount: 0,
        uploadedBy: {
          id: '',
          name: '当前用户',
          email: '',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      get().addDocument(newDoc);

      const pollProgress = setInterval(async () => {
        try {
          const progress = await getDatasetProgress(kbId, fileId);
          if (progress.status === 'completed' || progress.status === 'failed') {
            clearInterval(pollProgress);
            get().updateDocument(fileId, {
              status: progress.status as DocumentStatus,
              processingProgress: progress.progress,
            });
            set({ loading: false });
          } else {
            get().updateDocument(fileId, {
              status: progress.status as DocumentStatus,
              processingProgress: progress.progress,
            });
          }
        } catch {
          clearInterval(pollProgress);
          set({ loading: false });
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to upload document:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to upload document',
        loading: false,
      });
      throw error;
    }
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
    const { documents } = get();
    const doc = documents.find((d) => d.id === documentId);
    const token = cozeConfig.getToken();

    if (token && doc) {
      try {
        await deleteKnowledgeFile(doc.knowledgeBaseId, documentId);
      } catch (error) {
        console.error('Failed to delete document:', error);
        throw error;
      }
    }

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
