/**
 * 路由配置 - 统一管理所有页面路由
 */

// ========== 路由路径定义 ==========

export const ROUTES = {
  // 公开页面
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // 需要认证的页面
  KNOWLEDGE_BASES: '/knowledge-bases',
  KNOWLEDGE: (kbId: string) => `/knowledge/${kbId}` as const,
  CHAT: (kbId: string) => `/chat/${kbId}` as const,
  CHAT_CONVERSATION: (kbId: string, conversationId: string) => `/chat/${kbId}/${conversationId}` as const,
  QUESTIONS: (kbId: string) => `/questions/${kbId}` as const,
  STATISTICS: (kbId: string) => `/statistics/${kbId}` as const,
  RESUMES: '/resumes',
  SETTINGS_PROFILE: '/settings/profile',
} as const;

// ========== 公开路由（不需要认证） ==========

export const PUBLIC_ROUTES = [ROUTES.HOME, ROUTES.LOGIN, ROUTES.REGISTER] as const;

// ========== 认证保护路由 ==========

export const PROTECTED_ROUTES = [
  ROUTES.KNOWLEDGE_BASES,
  '/knowledge/',
  '/chat/',
  '/questions/',
  // 不带尾斜杠才能同时覆盖 /statistics 与 /statistics/[kbId]
  '/statistics',
  ROUTES.RESUMES,
  ROUTES.SETTINGS_PROFILE,
] as const;

// ========== 路由检查工具函数 ==========

/**
 * 检查路径是否是公开路由
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route);
}

/**
 * 检查路径是否需要认证
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * 获取登录后的重定向地址
 */
export function getLoginRedirect(redirectTo?: string): string {
  const unsafe = [...(redirectTo ?? '')].some(
    (char) => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
  );
  if (redirectTo?.startsWith('/') && !unsafe) {
    const base = 'https://local.invalid';
    try {
      const target = new URL(redirectTo, base);
      if (target.origin === base) return target.pathname + target.search + target.hash;
    } catch {
      // Invalid destinations fall back to the knowledge base list.
    }
  }
  return ROUTES.KNOWLEDGE_BASES;
}

/**
 * 获取未认证时的登录地址
 */
export function getLoginUrl(currentPath?: string): string {
  if (currentPath && currentPath !== ROUTES.HOME) {
    return `${ROUTES.LOGIN}?from=${encodeURIComponent(currentPath)}`;
  }
  return ROUTES.LOGIN;
}

// ========== 导航配置 ==========

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
}

/**
 * 获取侧边栏导航项
 */
export function getSidebarNavItems(kbId: string): NavItem[] {
  return [
    {
      key: 'knowledge',
      label: '知识库',
      icon: '📚',
      path: ROUTES.KNOWLEDGE(kbId),
    },
    {
      key: 'chat',
      label: 'AI 对话',
      icon: '💬',
      path: ROUTES.CHAT(kbId),
    },
    {
      key: 'questions',
      label: '面试题库',
      icon: '❓',
      path: ROUTES.QUESTIONS(kbId),
    },
    {
      key: 'resumes',
      label: '简历分析',
      icon: '📄',
      path: ROUTES.RESUMES,
    },
    {
      key: 'statistics',
      label: '引用统计',
      icon: '📊',
      path: ROUTES.STATISTICS(kbId),
    },
  ];
}

/**
 * 获取首页功能卡片配置
 */
export function getFeatureCards() {
  return [
    {
      icon: 'BookOutlined',
      title: '智能知识库',
      desc: '上传 PDF/Word/Markdown 文档，AI 自动解析、语义索引，让资料变成可对话的知识资产。',
      href: ROUTES.KNOWLEDGE_BASES,
    },
    {
      icon: 'MessageOutlined',
      title: 'AI 面试官',
      desc: '模拟真实面试：AI 出题、追问、点评，每次回答后附参考答案与评分，帮你查漏补缺。',
      href: ROUTES.LOGIN,
    },
    {
      icon: 'EditOutlined',
      title: '刷题练习',
      desc: '结构化题库（类目/难度/关键词），作答即时评估打分，遗漏要点清晰标注。',
      href: ROUTES.LOGIN,
    },
    {
      icon: 'FileSearchOutlined',
      title: '简历诊断',
      desc: '上传简历，AI 从 HR 视角全面分析：评分、优势亮点、问题不足、改进建议、面试追问预测。',
      href: ROUTES.LOGIN,
    },
    {
      icon: 'TrophyOutlined',
      title: '掌握度追踪',
      desc: '按技术类目和难度统计正确率，直观掌握薄弱环节，针对性强化复习。',
      href: ROUTES.LOGIN,
    },
    {
      icon: 'SolutionOutlined',
      title: '引用溯源',
      desc: '每次回答标注资料来源，[1][2] 标记一键跳转原文，面试准备有据可依。',
      href: ROUTES.KNOWLEDGE_BASES,
    },
  ];
}
