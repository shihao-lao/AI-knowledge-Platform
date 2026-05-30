export function knowledgePath(kbId?: string) {
  return kbId ? `/knowledge/${kbId}` : '/knowledge-bases';
}

export function chatPath(kbId: string, conversationId?: string) {
  if (conversationId) return `/chat/${kbId}/${conversationId}`;
  return `/chat/${kbId}`;
}
