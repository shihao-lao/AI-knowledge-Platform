'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiUser } from '@/lib/api-client';

interface AuthContextType {
  user: ApiUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ data: ApiUser; accessToken: string }>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取当前用户
  const fetchUser = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const currentUser = await api.me();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    // 登录成功后立即更新用户状态
    setUser(result.data);
    return result;
  }, []);

  // 注册
  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await api.register(name, email, password);
      // 注册成功后获取用户信息
      await fetchUser();
      return true;
    },
    [fetchUser],
  );

  // 登出
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('登出失败:', err);
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  // 初始加载
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refresh: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 认证 Hook - 管理用户登录状态
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
