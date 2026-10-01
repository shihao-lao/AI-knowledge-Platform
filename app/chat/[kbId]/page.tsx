'use client';

import { Button, Empty, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { chatPath } from '@/lib/paths';
import { createWelcomeMessage } from '@/lib/chat';
import { api, type ApiKnowledge } from '@/lib/api-client';
import { ROUTES } from '@/lib/routes';

export default function ChatWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;

  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [loadingKbs, setLoadingKbs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam) ? kbIdParam : (knowledgeBases[0]?.id ?? '');

  useEffect(() => {
    let cancelled = false;

    api
      .listKnowledge()
      .then((result) => {
        if (!cancelled) setKnowledgeBases(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '知识库加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingKbs(false);
      });

    return () => {
      cancelled = true;
    };
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
          return;
        }

        // No conversations exist — create one via the API
        const kb = knowledgeBases.find((item) => item.id === activeKbId);
        const convResult = await api.createConversation(activeKbId, '新对话');
        if (cancelled) return;

        // Add welcome message
        const welcomeMsg = createWelcomeMessage(kb?.name ?? '当前知识库');
        await api.createMessage(convResult.data.id, {
          role: welcomeMsg.role,
          content: welcomeMsg.content,
        });

        if (!cancelled) router.replace(chatPath(activeKbId, convResult.data.id));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '初始化对话失败');
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [activeKbId, knowledgeBases, router]);

  // 失败或没有知识库时给出明确出口，避免用户停留在空白页
  if (error || (!loadingKbs && !activeKbId)) {
    return (
      <div className="auth-loading">
        <Empty description={error ?? '还没有知识库，先创建一个再开始 AI 对话'}>
          <Button type="primary" onClick={() => router.push(ROUTES.KNOWLEDGE_BASES)}>
            去创建知识库
          </Button>
        </Empty>
      </div>
    );
  }

  // 加载知识库、以及跳转到具体对话期间显示 loading
  return (
    <div className="auth-loading">
      <Spin size="large" />
    </div>
  );
}
