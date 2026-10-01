'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import HubShell from '@/components/hub-shell';
import { api, type ApiKnowledge } from '@/lib/api-client';
import { ROUTES } from '@/lib/routes';
import { knowledgePath, chatPath, statisticsPath, questionsPath, resumesPath } from '@/lib/paths';

interface AppShellProps {
  children: React.ReactNode;
  activeNav?: string;
}

export default function AppShell({ children, activeNav }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);

  // 从 URL 中提取当前 kbId
  const pathParts = pathname.split('/').filter(Boolean);
  const currentKbId =
    pathParts.length >= 2 && ['knowledge', 'chat', 'questions', 'statistics'].includes(pathParts[0])
      ? pathParts[1]
      : '';

  useEffect(() => {
    api
      .listKnowledge()
      .then((r) => setKnowledgeBases(r.data))
      .catch(() => {});
  }, []);

  const isActive = (key: string) => activeNav === key;

  // 当前页面没有 kbId 时（如知识库列表页）回退到第一个知识库，
  // 避免导航项变成点了没反应的死链
  const navKbId = currentKbId || knowledgeBases[0]?.id || '';

  return (
    <HubShell>
      <aside className="hub-sidebar" id="app-sidebar">
        {/* 品牌（移动端顶栏已有，抽屉内隐藏） */}
        <div className="hub-brand hub-sidebar__brand">
          <span className="hub-brand__mark">知</span>
          <span>知识中枢</span>
        </div>

        {/* 主导航 */}
        <nav className="hub-nav">
          <Link
            href={currentKbId ? knowledgePath(currentKbId) : ROUTES.KNOWLEDGE_BASES}
            className={`hub-nav__item ${isActive('knowledge') ? 'is-active' : ''}`}
          >
            <span>📚</span>
            <span>知识库</span>
          </Link>
          <Link
            href={navKbId ? chatPath(navKbId) : ROUTES.KNOWLEDGE_BASES}
            className={`hub-nav__item ${isActive('chat') ? 'is-active' : ''}`}
            title={navKbId ? undefined : '请先创建知识库'}
          >
            <span>💬</span>
            <span>AI 对话</span>
          </Link>
          <Link
            href={navKbId ? questionsPath(navKbId) : ROUTES.KNOWLEDGE_BASES}
            className={`hub-nav__item ${isActive('questions') ? 'is-active' : ''}`}
            title={navKbId ? undefined : '请先创建知识库'}
          >
            <span>❓</span>
            <span>面试题库</span>
          </Link>
          <Link href={resumesPath()} className={`hub-nav__item ${isActive('resumes') ? 'is-active' : ''}`}>
            <span>📄</span>
            <span>简历分析</span>
          </Link>
          <Link
            href={navKbId ? statisticsPath(navKbId) : ROUTES.KNOWLEDGE_BASES}
            className={`hub-nav__item ${isActive('statistics') ? 'is-active' : ''}`}
            title={navKbId ? undefined : '请先创建知识库'}
          >
            <span>📊</span>
            <span>引用统计</span>
          </Link>
        </nav>

        {/* 知识库列表 */}
        <div className="hub-side-section">
          <div className="hub-section-title">
            <span>我的知识库</span>
            <span>{knowledgeBases.length}</span>
          </div>
          {knowledgeBases.map((kb) => (
            <button
              type="button"
              key={kb.id}
              className={`hub-kb ${currentKbId === kb.id ? 'is-active' : ''}`}
              onClick={() => router.push(knowledgePath(kb.id))}
            >
              <span>{kb.name}</span>
              <small>{kb.documentCount ?? 0} 份知识</small>
            </button>
          ))}
        </div>

        {/* 底部 */}
        <div className="hub-sidebar__bottom">
          <Link href={ROUTES.KNOWLEDGE_BASES} className="hub-nav__item">
            <span>📦</span>
            <span>知识库管理</span>
          </Link>
          <Link href={ROUTES.SETTINGS_MODEL} className="hub-nav__item">
            <span>🤖</span>
            <span>模型配置</span>
          </Link>
          <Link href={ROUTES.SETTINGS_PROFILE} className="hub-nav__item">
            <span>⚙️</span>
            <span>设置</span>
          </Link>
        </div>
      </aside>

      <div className="hub-main">{children}</div>
    </HubShell>
  );
}
