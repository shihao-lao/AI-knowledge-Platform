'use client';

import { FileAddOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Radio, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';
import type { Visibility } from '@/types';

export interface ManualKbValues {
  name: string;
  description: string;
  visibility: Visibility;
  initialContent?: string;
}

interface CreateKnowledgeBaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreateManual: (values: ManualKbValues) => void;
  onCreateImport: (values: { name: string; description: string; visibility: Visibility; files: File[] }) => void;
}

export default function CreateKnowledgeBaseModal({
  open,
  onClose,
  onCreateManual,
  onCreateImport,
}: CreateKnowledgeBaseModalProps) {
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [form] = Form.useForm();
  const [files, setFiles] = useState<File[]>([]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (mode === 'manual') {
        onCreateManual({
          name: values.name,
          description: values.description || '',
          visibility: values.visibility,
          initialContent: values.initialContent,
        });
      } else {
        onCreateImport({
          name: values.name,
          description: values.description || '',
          visibility: values.visibility,
          files,
        });
      }
      form.resetFields();
      setFiles([]);
      onClose();
    } catch {
      // validation failed
    }
  };

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: true,
    accept: '.pdf,.md,.markdown,.txt,.csv,.xls,.xlsx,.doc,.docx',
    beforeUpload: (file) => {
      setFiles((prev) => [...prev, file as File]);
      return false;
    },
    onRemove: (file) => {
      setFiles((prev) => prev.filter((f) => f.name !== file.name || f.size !== file.size));
    },
  };

  return (
    <Modal
      title="创建知识库"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      width={520}
      className="kb-create-modal"
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="create" type="primary" onClick={handleOk}>
          创建
        </Button>,
      ]}
    >
      <div className="kb-create-choices">
        <button
          type="button"
          className={`kb-create-choice ${mode === 'manual' ? 'is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <span className="kb-create-choice__icon">
            <PlusOutlined />
          </span>
          <strong>手动创建</strong>
          <span>从零开始，手动添加内容</span>
        </button>
        <button
          type="button"
          className={`kb-create-choice ${mode === 'import' ? 'is-active' : ''}`}
          onClick={() => setMode('import')}
        >
          <span className="kb-create-choice__icon kb-create-choice__icon--import">
            <ImportOutlined />
          </span>
          <strong>导入文件</strong>
          <span>上传文档自动构建知识库</span>
        </button>
      </div>

      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item label="知识库名称" name="name" rules={[{ required: true, message: '请输入知识库名称' }]}>
          <Input placeholder="例如：前端开发手册" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea placeholder="简要描述知识库用途（可选）" rows={2} />
        </Form.Item>
        <Form.Item label="可见性" name="visibility" initialValue="private">
          <Radio.Group>
            <Radio value="private">私有</Radio>
            <Radio value="public">公开</Radio>
          </Radio.Group>
        </Form.Item>
        {mode === 'manual' && (
          <Form.Item label="初始内容" name="initialContent">
            <Input.TextArea placeholder="粘贴或输入初始知识内容（可选）" rows={4} />
          </Form.Item>
        )}
        {mode === 'import' && (
          <Form.Item label="上传文件">
            <Upload {...uploadProps}>
              <Button icon={<FileAddOutlined />}>选择文件</Button>
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              支持 PDF、Markdown、Word、Excel、纯文本
            </Typography.Text>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
