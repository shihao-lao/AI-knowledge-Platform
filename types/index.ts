export type Role = 'admin' | 'editor' | 'viewer';
export type FileType = 'markdown' | 'text' | 'word';
export type DocumentStatus = 'pending' | 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'failed';

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
  indexStatus?: 'indexed' | 'keyword_only' | 'unknown';
  processingProgress: number;
  chunkCount: number;
  charCount?: number;
  enabled: boolean;
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
  error?: string;
  retryQuestion?: string;
  requestId?: string;
  generationStatus?: 'completed' | 'generating' | 'failed' | 'interrupted';
}

export interface Conversation {
  id: string;
  knowledgeBaseId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeBasics {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
}

export interface ResumeEducation {
  school: string;
  degree: string;
  major: string;
  start: string;
  end: string;
  description: string;
}

export interface ResumeExperience {
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  role: string;
  start: string;
  end: string;
  description: string;
  bullets: string[];
  tech: string[];
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  date: string;
  description: string;
}

export interface StructuredResume {
  basics: ResumeBasics;
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: ResumeSkillGroup[];
  certifications: ResumeCertification[];
  customSections: Array<{ id: string; title: string; content: string }>;
  layout: { sections: Array<{ key: string; title: string }> };
}

export function emptyStructuredResume(): StructuredResume {
  return {
    basics: { name: '', title: '', email: '', phone: '', location: '', website: '', summary: '' },
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    customSections: [],
    layout: { sections: [] },
  };
}
