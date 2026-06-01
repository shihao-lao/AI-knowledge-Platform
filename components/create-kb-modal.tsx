'use client';

import { Button, Form, Input, Modal, Radio } from 'antd';
import { useState } from 'react';
import type { Visibility } from '@/types';

export interface CreateKbValues {
  name: string;
  description: string;
  visibility: Visibility;
}

interface CreateKnowledgeBaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (values: CreateKbValues) => void;
}

export default function CreateKnowledgeBaseModal({ open, onClose, onCreate }: CreateKnowledgeBaseModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      onCreate({
        name: values.name,
        description: values.description || '',
        visibility: values.visibility,
      });
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
      title="创建知识库"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      width={480}
      className="kb-create-modal"
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="create" type="primary" onClick={handleOk} loading={submitting}>
          创建
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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
      </Form>
    </Modal>
  );
}
