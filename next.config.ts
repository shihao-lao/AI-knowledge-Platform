import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/icons'],
  serverExternalPackages: ['@lancedb/lancedb', 'apache-arrow', '@huggingface/transformers'],
};

export default nextConfig;
