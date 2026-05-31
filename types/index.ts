export type Role = 'admin' | 'editor' | 'viewer';
export type Visibility = 'public' | 'private';
export type FileType = 'pdf' | 'markdown' | 'text' | 'word' | 'excel';
export type DocumentStatus = 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'failed';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  stats: {
    documentCount: number;
    conversationCount: number;
    memberCount: number;
    lastActiveAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  status: DocumentStatus;
  processingProgress: number;
  chunkCount: number;
  charCount?: number;
  embeddingModel?: string;
  uploadedBy: User;
  createdAt: string;
  updatedAt: string;
  content: string;
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  preview: string;
  confidenceScore: number;
  color?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  knowledgeBaseId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
