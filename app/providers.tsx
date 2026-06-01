'use client';

import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#4f46e5',
            colorInfo: '#4f46e5',
            borderRadius: 10,
            borderRadiusLG: 14,
            colorBgLayout: '#f8fafc',
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorBorder: '#e2e8f0',
            colorText: '#0f172a',
            colorTextSecondary: '#64748b',
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06)',
            boxShadowSecondary: '0 4px 16px rgba(79, 70, 229, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06)',
            fontFamily:
              '"Plus Jakarta Sans", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          },
          components: {
            Button: {
              controlHeight: 38,
              paddingInline: 18,
              primaryShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
            },
            Input: {
              controlHeight: 38,
              paddingInline: 12,
              activeBorderColor: '#4f46e5',
              hoverBorderColor: '#818cf8',
            },
            Card: {
              paddingLG: 24,
              paddingSM: 16,
            },
            Typography: {
              titleMarginBottom: 12,
            },
            Progress: {
              remainingColor: '#e2e8f0',
            },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
