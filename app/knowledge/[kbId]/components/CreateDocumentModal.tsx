'use client';

import { Button, Form, Input, Modal } from 'antd';
import { useState } from 'react';

interface CreateDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, content: string) => void;
}

export default function CreateDocumentModal({ open, onClose, onSubmit }: CreateDocumentModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      onSubmit(values.title, values.content);
      form.resetFields();
      onClose();
    } catch {
      // validation failed
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="手动创建文档"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="create" type="primary" onClick={handleOk} loading={submitting}>
          导入
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="文档标题" name="title" rules={[{ required: true, message: '请输入文档标题' }]}>
          <Input placeholder="例如：React Hooks 使用指南" />
        </Form.Item>
        <Form.Item label="文档内容" name="content" rules={[{ required: true, message: '请输入文档内容' }]}>
          <Input.TextArea placeholder="在此粘贴或输入文档内容..." rows={12} showCount maxLength={50000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
