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
