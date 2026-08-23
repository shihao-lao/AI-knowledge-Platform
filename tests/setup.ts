import { vi } from 'vitest';

// server-only 标记包在非 Next 运行时导入即抛错，测试中替换为空模块
vi.mock('server-only', () => ({}));

// 纯函数测试不触数据库，避免实例化真实 PrismaClient
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));
