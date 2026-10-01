'use client';

import { Button, Form, Input, Modal } from 'antd';
import { useState } from 'react';

interface CreateDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, content: string) => Promise<void>;
}

export default function CreateDocumentModal({ open, onClose, onSubmit }: CreateDocumentModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    let values: { title: string; content: string };
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败，antd 已在表单项上展示错误
    }

    setSubmitting(true);
    try {
      await onSubmit(values.title.trim(), values.content);
      form.resetFields();
      onClose();
    } catch {
      // 提交失败：调用方已提示错误，保持弹窗打开以便重试
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
      <Form form={form} layout="vertical" style={{ marginTop: 'var(--space-4)' }}>
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
