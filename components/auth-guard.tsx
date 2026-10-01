'use client';

import { Spin } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getLoginUrl, isProtectedRoute, isPublicRoute } from '@/lib/routes';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 认证保护组件 - 包裹需要认证的页面
 * 首次加载时显示 loading，后续导航不再触发 loading 闪烁
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated } = useAuth();
  const needsAuth = isProtectedRoute(pathname);
  const isPublic = isPublicRoute(pathname);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  // 标记是否已经完成过首次加载
  useEffect(() => {
    if (!loading) {
      setHasEverLoaded(true);
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return; // 还在加载中，不做任何操作
    if (needsAuth && !isAuthenticated && !isPublic) {
      router.replace(getLoginUrl(pathname));
    }
  }, [loading, needsAuth, isAuthenticated, isPublic, router, pathname]);

  // 公开页面直接渲染
  if (isPublic) {
    return <>{children}</>;
  }

  // 首次加载中显示 loading（后续导航不再显示）
  if (loading && !hasEverLoaded) {
    return (
      <div className="auth-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 如果需要认证但未登录，不渲染内容（等待 useEffect 跳转）
  if (needsAuth && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
