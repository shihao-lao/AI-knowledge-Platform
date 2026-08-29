'use client';

import { Spin } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getLoginUrl, isProtectedRoute, isPublicRoute } from '@/lib/routes';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 认证保护组件 - 包裹需要认证的页面
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated } = useAuth();
  const needsAuth = isProtectedRoute(pathname);
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    // 如果需要认证但未登录，跳转到登录页
    // 公开页面（登录、注册、首页）不需要认证保护
    if (!loading && needsAuth && !isAuthenticated && !isPublic) {
      router.replace(getLoginUrl(pathname));
    }
  }, [loading, needsAuth, isAuthenticated, isPublic, router, pathname]);

  // 公开页面直接渲染，不需要认证检查
  if (isPublic) {
    return <>{children}</>;
  }

  // 加载中显示 loading
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 如果需要认证但未登录，不渲染内容
  if (needsAuth && !isAuthenticated) {
    return null;
  }

  // 渲染子组件
  return <>{children}</>;
}
