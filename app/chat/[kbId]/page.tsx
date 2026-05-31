'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { chatPath } from '@/lib/paths';
import { createWelcomeMessage } from '@/lib/chat';
import { useChatStore, useConversationsByKb } from '@/stores/chat-store';
import { listDatasets, type DatasetInfo } from '@/app/api/kb';
import type { Conversation } from '@/types';

export default function ChatWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;

  const [cozeDatasets, setCozeDatasets] = useState<DatasetInfo[]>([]);
  const addConversation = useChatStore((s) => s.addConversation);

  const activeKbId =
    kbIdParam && cozeDatasets.some((kb) => kb.dataset_id === kbIdParam)
      ? kbIdParam
      : cozeDatasets[0]?.dataset_id ?? '';
  const activeKb = cozeDatasets.find((item) => item.dataset_id === activeKbId) ?? cozeDatasets[0];
  const kbConversations = useConversationsByKb(activeKbId);

  useEffect(() => {
    listDatasets().then((result) => {
      if (result.code === 0 && result.data?.dataset_list) {
        setCozeDatasets(result.data.dataset_list);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeKbId) return;
    if (kbConversations[0]) {
      router.replace(chatPath(activeKbId, kbConversations[0].id));
    } else {
      // 没有对话时自动创建新对话
      const conversationId = `chat_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const newChat: Conversation = {
        id: conversationId,
        knowledgeBaseId: activeKbId,
        title: '新对话',
        messageCount: 1,
        createdAt: now,
        updatedAt: now,
      };
      addConversation(newChat, [createWelcomeMessage(activeKb?.name ?? '当前知识库')]);
      router.replace(chatPath(activeKbId, conversationId));
    }
  }, [activeKbId, kbConversations, router, addConversation, activeKb?.name]);

  return null;
}
