'use client';

import { ImportOutlined } from '@ant-design/icons';
import { Button, Upload } from 'antd';
import type { UploadProps } from 'antd';

interface KnowledgeUploaderProps {
  onUpload: (file: File) => void;
}

export default function KnowledgeUploader({ onUpload }: KnowledgeUploaderProps) {
  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    accept: '.pdf,.md,.markdown,.txt,.csv,.xls,.xlsx,.doc,.docx',
    beforeUpload: async (file) => {
      await onUpload(file as File);
      return false;
    },
  };

  return (
    <Upload {...uploadProps}>
      <Button type="primary" icon={<ImportOutlined />}>
        导入并提取关键点
      </Button>
    </Upload>
  );
}
