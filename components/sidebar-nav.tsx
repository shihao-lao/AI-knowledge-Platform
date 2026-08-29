'use client';

import { BookOutlined, SettingOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSidebarNavItems, ROUTES } from '@/lib/routes';
import { useNavigation } from '@/lib/hooks/use-navigation';
import { useAuth } from '@/lib/hooks/use-auth';

interface SidebarNavProps {
  knowledgeBases: Array<{ id: string; name: string }>;
  activeKbId?: string;
  onSelectKb?: (kbId: string) => void;
}

export default function SidebarNav({ knowledgeBases, activeKbId, onSelectKb }: SidebarNavProps) {
  const pathname = usePathname();
  const { goToKnowledgeBase } = useNavigation();
  const { user } = useAuth();

  // 获取导航项
  const navItems = activeKbId ? getSidebarNavItems(activeKbId) : [];

  // 判断导航项是否激活
  const isActive = (path: string) => {
    if (path === ROUTES.KNOWLEDGE_BASES) {
      return pathname === ROUTES.KNOWLEDGE_BASES;
    }
    return pathname.startsWith(path);
  };

  return (
    <aside className="hub-sidebar">
      {/* 品牌标识 */}
      <div className="hub-brand">
        <span className="hub-brand__mark">知</span>
        <span>知识中枢</span>
      </div>

      {/* 主导航 */}
      <nav className="hub-nav">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.path}
            className={`hub-nav__item ${isActive(item.path) ? 'is-active' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
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
            className={`hub-kb-item ${kb.id === activeKbId ? 'is-active' : ''}`}
            onClick={() => onSelectKb?.(kb.id)}
          >
            <BookOutlined />
            <span className="hub-kb-item__name">{kb.name}</span>
          </button>
        ))}
      </div>

      {/* 底部操作 */}
      <div className="hub-sidebar-footer">
        <Link href={ROUTES.KNOWLEDGE_BASES} className="hub-nav__item">
          <span>📋</span>
          <span>全部知识库</span>
        </Link>
        <Link href={ROUTES.SETTINGS_PROFILE} className="hub-nav__item">
          <span>⚙️</span>
          <span>设置</span>
        </Link>
      </div>
    </aside>
  );
}
