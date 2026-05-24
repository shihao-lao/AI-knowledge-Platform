import type {
  Citation,
  Conversation,
  KnowledgeBase,
  KnowledgeDocument,
  Message,
  User,
} from '@/types';
import {
  currentUser as mockUser,
  knowledgeBases as mockKnowledgeBases,
  documents as mockDocuments,
  citations as mockCitations,
  conversations as mockConversations,
  initialMessages as mockMessages,
} from '@/data/mock';

interface Store {
  users: User[];
  knowledgeBases: KnowledgeBase[];
  documents: KnowledgeDocument[];
  citations: Citation[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
}

function initializeStore(): Store {
  const messagesMap: Record<string, Message[]> = {};
  mockConversations.forEach((chat) => {
    messagesMap[chat.id] = chat.id === 'chat_001' ? mockMessages : [];
  });

  return {
    users: [mockUser],
    knowledgeBases: [...mockKnowledgeBases],
    documents: [...mockDocuments],
    citations: [...mockCitations],
    conversations: [...mockConversations],
    messages: messagesMap,
  };
}

const store: Store = initializeStore();

export function getUsers() {
  return store.users;
}

export function getUserById(id: string) {
  return store.users.find((u) => u.id === id);
}

export function getUserByEmail(email: string) {
  return store.users.find((u) => u.email === email);
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const newUser: User = {
    ...user,
    id: `u_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  store.users.push(newUser);
  return newUser;
}

export function getKnowledgeBases() {
  return store.knowledgeBases;
}

export function getKnowledgeBaseById(id: string) {
  return store.knowledgeBases.find((kb) => kb.id === id);
}

export function createKnowledgeBase(
  data: Omit<KnowledgeBase, 'id' | 'stats' | 'createdAt' | 'updatedAt'>
): KnowledgeBase {
  const newKb: KnowledgeBase = {
    ...data,
    id: `kb_${Date.now()}`,
    stats: {
      documentCount: 0,
      conversationCount: 0,
      memberCount: 1,
      lastActiveAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.knowledgeBases.push(newKb);
  return newKb;
}

export function updateKnowledgeBase(
  id: string,
  data: Partial<Pick<KnowledgeBase, 'name' | 'description' | 'visibility'>>
): KnowledgeBase | null {
  const kb = store.knowledgeBases.find((k) => k.id === id);
  if (!kb) return null;
  Object.assign(kb, data, { updatedAt: new Date().toISOString() });
  return kb;
}

export function deleteKnowledgeBase(id: string): boolean {
  const index = store.knowledgeBases.findIndex((k) => k.id === id);
  if (index === -1) return false;
  store.knowledgeBases.splice(index, 1);
  store.documents = store.documents.filter((d) => d.knowledgeBaseId !== id);
  store.conversations = store.conversations.filter((c) => c.knowledgeBaseId !== id);
  return true;
}

export function getDocuments(knowledgeBaseId?: string) {
  if (knowledgeBaseId) {
    return store.documents.filter((d) => d.knowledgeBaseId === knowledgeBaseId);
  }
  return store.documents;
}

export function getDocumentById(id: string) {
  return store.documents.find((d) => d.id === id);
}

export function createDocument(
  data: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>
): KnowledgeDocument {
  const newDoc: KnowledgeDocument = {
    ...data,
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.documents.push(newDoc);

  const kb = store.knowledgeBases.find((k) => k.id === data.knowledgeBaseId);
  if (kb) {
    kb.stats.documentCount++;
    kb.stats.lastActiveAt = new Date().toISOString();
    kb.updatedAt = new Date().toISOString();
  }

  return newDoc;
}

export function updateDocument(
  id: string,
  data: Partial<Pick<KnowledgeDocument, 'status' | 'processingProgress' | 'chunkCount' | 'content'>>
): KnowledgeDocument | null {
  const doc = store.documents.find((d) => d.id === id);
  if (!doc) return null;
  Object.assign(doc, data, { updatedAt: new Date().toISOString() });
  return doc;
}

export function deleteDocument(id: string): boolean {
  const index = store.documents.findIndex((d) => d.id === id);
  if (index === -1) return false;
  const doc = store.documents[index];
  store.documents.splice(index, 1);

  const kb = store.knowledgeBases.find((k) => k.id === doc.knowledgeBaseId);
  if (kb && kb.stats.documentCount > 0) {
    kb.stats.documentCount--;
  }
  return true;
}

export function getConversations(knowledgeBaseId?: string) {
  if (knowledgeBaseId) {
    return store.conversations.filter((c) => c.knowledgeBaseId === knowledgeBaseId);
  }
  return store.conversations;
}

export function getConversationById(id: string) {
  return store.conversations.find((c) => c.id === id);
}

export function createConversation(
  data: Omit<Conversation, 'id' | 'messageCount' | 'createdAt' | 'updatedAt'>
): Conversation {
  const newConv: Conversation = {
    ...data,
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    messageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.conversations.push(newConv);
  store.messages[newConv.id] = [];

  const kb = store.knowledgeBases.find((k) => k.id === data.knowledgeBaseId);
  if (kb) {
    kb.stats.conversationCount++;
    kb.stats.lastActiveAt = new Date().toISOString();
    kb.updatedAt = new Date().toISOString();
  }

  return newConv;
}

export function deleteConversation(id: string): boolean {
  const index = store.conversations.findIndex((c) => c.id === id);
  if (index === -1) return false;
  const conv = store.conversations[index];
  store.conversations.splice(index, 1);
  delete store.messages[conv.id];

  const kb = store.knowledgeBases.find((k) => k.id === conv.knowledgeBaseId);
  if (kb && kb.stats.conversationCount > 0) {
    kb.stats.conversationCount--;
  }
  return true;
}

export function getMessages(conversationId: string) {
  return store.messages[conversationId] || [];
}

export function addMessage(conversationId: string, message: Message): Message {
  if (!store.messages[conversationId]) {
    store.messages[conversationId] = [];
  }
  store.messages[conversationId].push(message);

  const conv = store.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.messageCount = store.messages[conversationId].length;
    conv.updatedAt = new Date().toISOString();
  }

  return message;
}
