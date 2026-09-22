'use client';

import { useRouter, useParams } from 'next/navigation';
import { useCallback } from 'react';
import { ROUTES } from '@/lib/routes';

/**
 * 导航 Hook - 统一管理页面跳转
 */
export function useNavigation() {
  const router = useRouter();
  const params = useParams();

  // 获取当前知识库 ID
  const currentKbId = typeof params.kbId === 'string' ? params.kbId : undefined;

  // 导航到知识库
  const goToKnowledgeBase = useCallback(
    (kbId?: string) => {
      if (kbId) {
        router.push(ROUTES.KNOWLEDGE(kbId));
      } else {
        router.push(ROUTES.KNOWLEDGE_BASES);
      }
    },
    [router],
  );

  // 导航到对话
  const goToChat = useCallback(
    (kbId?: string, conversationId?: string) => {
      const targetKbId = kbId || currentKbId;
      if (!targetKbId) {
        console.warn('导航到对话需要知识库 ID');
        return;
      }
      if (conversationId) {
        router.push(ROUTES.CHAT_CONVERSATION(targetKbId, conversationId));
      } else {
        router.push(ROUTES.CHAT(targetKbId));
      }
    },
    [router, currentKbId],
  );

  // 导航到题库
  const goToQuestions = useCallback(
    (kbId?: string) => {
      const targetKbId = kbId || currentKbId;
      if (!targetKbId) {
        console.warn('导航到题库需要知识库 ID');
        return;
      }
      router.push(ROUTES.QUESTIONS(targetKbId));
    },
    [router, currentKbId],
  );

  // 导航到统计
  const goToStatistics = useCallback(
    (kbId?: string) => {
      const targetKbId = kbId || currentKbId;
      if (!targetKbId) {
        console.warn('导航到统计需要知识库 ID');
        return;
      }
      router.push(ROUTES.STATISTICS(targetKbId));
    },
    [router, currentKbId],
  );

  // 导航到简历
  const goToResumes = useCallback(() => {
    router.push(ROUTES.RESUMES);
  }, [router]);

  // 导航到设置
  const goToSettings = useCallback(() => {
    router.push(ROUTES.SETTINGS_PROFILE);
  }, [router]);

  // 导航到登录
  const goToLogin = useCallback(
    (redirectTo?: string) => {
      if (redirectTo) {
        router.push(`${ROUTES.LOGIN}?from=${encodeURIComponent(redirectTo)}`);
      } else {
        router.push(ROUTES.LOGIN);
      }
    },
    [router],
  );

  // 导航到注册
  const goToRegister = useCallback(() => {
    router.push(ROUTES.REGISTER);
  }, [router]);

  // 返回上一页
  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  // 刷新当前页面
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return {
    currentKbId,
    goToKnowledgeBase,
    goToChat,
    goToQuestions,
    goToStatistics,
    goToResumes,
    goToSettings,
    goToLogin,
    goToRegister,
    goBack,
    refresh,
  };
}
