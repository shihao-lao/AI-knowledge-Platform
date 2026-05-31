'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { chatPath } from '@/lib/paths';
import { createWelcomeMessage } from '@/lib/chat';
import { api, type ApiKnowledge } from '@/lib/api-client';

export default function ChatWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;

  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam)
      ? kbIdParam
      : knowledgeBases[0]?.id ?? '';

  useEffect(() => {
    api.listKnowledge().then((result) => setKnowledgeBases(result.data));
  }, []);

  useEffect(() => {
    if (!activeKbId) return;

    let cancelled = false;

    const init = async () => {
      try {
        // Check for existing conversations in the database
        const result = await api.listConversations(activeKbId);
        if (cancelled) return;

        if (result.data.length > 0) {
          router.replace(chatPath(activeKbId, result.data[0].id));
        } else {
          // No conversations exist — create one via the API
          const kb = knowledgeBases.find((kb) => kb.id === activeKbId);
          const convResult = await api.createConversation(activeKbId, '新对话');
          if (cancelled) return;

          // Add welcome message
          const welcomeMsg = createWelcomeMessage(kb?.name ?? '当前知识库');
          await api.createMessage(convResult.data.id, {
            role: welcomeMsg.role,
            content: welcomeMsg.content,
          });

          router.replace(chatPath(activeKbId, convResult.data.id));
        }
      } catch (err) {
        console.error('初始化对话失败:', err);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [activeKbId, knowledgeBases, router]);

  return null;
}
