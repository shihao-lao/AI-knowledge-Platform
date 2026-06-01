import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['antd', '@ant-design/icons'],
  serverExternalPackages: ['@lancedb/lancedb', 'apache-arrow'],
};

export default nextConfig;
