import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/icons'],
};

export default nextConfig;
