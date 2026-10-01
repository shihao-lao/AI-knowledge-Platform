'use client';

import { MenuOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/lib/routes';

interface HubShellProps {
  /** 直接放 <aside class="hub-sidebar"> 与 <main class="hub-main">，保持各页原有结构 */
  children: React.ReactNode;
}

/**
 * 应用外壳：桌面端是「固定侧栏 + 主区」；移动端把侧栏收进抽屉，
 * 顶部只留一条品牌栏，避免导航占满整个首屏。
 */
export default function HubShell({ children }: HubShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // 跳转后自动收起抽屉
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className={`hub-shell${navOpen ? ' is-nav-open' : ''}`}>
      <header className="hub-mobile-bar">
        <Link href={ROUTES.HOME} className="hub-brand">
          <span className="hub-brand__mark">知</span>
          <span>知识中枢</span>
        </Link>
        <button
          type="button"
          className="hub-mobile-toggle"
          aria-label={navOpen ? '关闭导航' : '打开导航'}
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          onClick={() => setNavOpen((open) => !open)}
        >
          <MenuOutlined />
        </button>
      </header>

      {children}

      {/* 移动端遮罩：点击任意处关闭抽屉 */}
      <button
        type="button"
        className="hub-nav-backdrop"
        aria-label="关闭导航"
        tabIndex={-1}
        onClick={() => setNavOpen(false)}
      />
    </div>
  );
}
