'use client';

import { Spin } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getLoginUrl, isProtectedRoute } from '@/lib/routes';

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

  useEffect(() => {
    // 如果需要认证但未登录，跳转到登录页
    if (!loading && needsAuth && !isAuthenticated) {
      router.replace(getLoginUrl(pathname));
    }
  }, [loading, needsAuth, isAuthenticated, router, pathname]);

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
