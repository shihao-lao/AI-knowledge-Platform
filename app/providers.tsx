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
            borderRadius: 10,
            colorBgLayout: '#f8fafc',
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorBorder: '#e2e8f0',
            colorText: '#0f172a',
            colorTextSecondary: '#64748b',
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
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
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
