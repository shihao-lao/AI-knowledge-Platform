'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { chatPath } from '@/lib/paths';
import { useKnowledgeBases } from '@/stores/knowledge-store';
import { useConversationsByKb } from '@/stores/chat-store';

export default function ChatWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;

  const kbList = useKnowledgeBases();
  const activeKbId = kbIdParam && kbList.some((kb) => kb.id === kbIdParam) ? kbIdParam : kbList[0]?.id ?? '';
  const kbConversations = useConversationsByKb(activeKbId);

  useEffect(() => {
    if (kbConversations[0]) {
      router.replace(chatPath(activeKbId, kbConversations[0].id));
    } else {
      router.replace(chatPath(activeKbId));
    }
  }, [activeKbId, kbConversations, router]);

  return null;
}
