'use client';

import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from '@/lib/hooks/use-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: 'var(--color-primary)',
            borderRadius: 10,
            colorBgLayout: 'var(--color-bg)',
            colorBgContainer: 'var(--color-surface)',
            colorBgElevated: 'var(--color-surface)',
            colorBorder: 'var(--color-border)',
            colorText: 'var(--color-text)',
            colorTextSecondary: 'var(--color-text-secondary)',
            colorSuccess: 'var(--color-success)',
            colorWarning: 'var(--color-warning)',
            colorError: 'var(--color-error)',
            colorInfo: 'var(--color-info)',
            fontFamily:
              '"Plus Jakarta Sans", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          },
          components: {
            Button: {
              controlHeight: 38,
              paddingInline: 18,
            },
            Input: {
              controlHeight: 38,
              paddingInline: 12,
            },
            Card: {
              paddingLG: 20,
            },
            // 未指定 color 的 Tag 背景由 antd 从 colorBgContainer 派生，
            // 而这里是 CSS 变量，antd 无法解析颜色导致派生出纯黑（文字几乎不可见）。
            // 直接给定与主题一致的取值即可，同时保留深色模式。
            Tag: {
              defaultBg: 'var(--color-border)',
              defaultColor: 'var(--color-text-secondary)',
            },
          },
        }}
      >
        <App>
          <AuthProvider>{children}</AuthProvider>
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
