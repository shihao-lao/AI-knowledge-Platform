'use client';

import { FileAddOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useRef } from 'react';

interface KnowledgeUploaderProps {
  onUpload: (file: File) => void;
  onCreateManual?: () => void;
}

export default function KnowledgeUploader({ onUpload, onCreateManual }: KnowledgeUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => onUpload(file));
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const menuItems: MenuProps['items'] = [
    ...(onCreateManual
      ? [
          {
            key: 'manual',
            label: '手动创建',
            icon: <FileAddOutlined />,
            onClick: () => onCreateManual(),
          },
        ]
      : []),
    {
      key: 'import',
      label: '导入文件',
      icon: <UploadOutlined />,
      onClick: () => fileInputRef.current?.click(),
    },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.markdown,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
        <Button type="primary" icon={<ImportOutlined />}>
          导入并提取关键点
        </Button>
      </Dropdown>
    </>
  );
}
