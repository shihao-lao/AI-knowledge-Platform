import { conversations, knowledgeBases } from '@/data/mock';

export const DEFAULT_KB_ID = knowledgeBases[0].id;

const defaultConversation = conversations.find((chat) => chat.knowledgeBaseId === DEFAULT_KB_ID);

export function knowledgePath(kbId: string = DEFAULT_KB_ID) {
  return `/knowledge/${kbId}`;
}

export function chatPath(kbId: string = DEFAULT_KB_ID, conversationId?: string) {
  if (conversationId) return `/chat/${kbId}/${conversationId}`;
  return `/chat/${kbId}`;
}

export function defaultKnowledgePath() {
  return knowledgePath(DEFAULT_KB_ID);
}

export function defaultChatPath() {
  if (defaultConversation) return chatPath(DEFAULT_KB_ID, defaultConversation.id);
  return chatPath(DEFAULT_KB_ID);
}

export type WorkspaceMode = 'knowledge' | 'chat';

export function getWorkspaceMode(pathname: string): WorkspaceMode {
  return pathname.startsWith('/chat') ? 'chat' : 'knowledge';
}
