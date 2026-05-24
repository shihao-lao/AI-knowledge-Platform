'use client';

import { EditOutlined, ImportOutlined, InboxOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Space, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useState } from 'react';
import type { Visibility } from '@/types';
import { uploadAccept } from '@/lib/document';

export type CreateKbMode = 'choose' | 'manual' | 'import';

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

const visibilityOptions = [
  { value: 'private', label: '私有（仅团队成员）' },
  { value: 'public', label: '公开（组织内可见）' },
];

const MANUAL_FORM_ID = 'create-kb-manual-form';
const IMPORT_FORM_ID = 'create-kb-import-form';

function ManualKbFormPanel({ onSubmit }: { onSubmit: (values: ManualKbValues) => void }) {
  const [form] = Form.useForm<ManualKbValues>();

  return (
    <Form
      id={MANUAL_FORM_ID}
      form={form}
      layout="vertical"
      initialValues={{ visibility: 'private' as Visibility }}
      onFinish={onSubmit}
    >
      <Form.Item label="知识库名称" name="name" rules={[{ required: true, message: '请输入知识库名称' }]}>
        <Input placeholder="例如：前端开发手册" maxLength={50} />
      </Form.Item>
      <Form.Item label="描述" name="description" rules={[{ required: true, message: '请输入描述' }]}>
        <Input.TextArea placeholder="简要说明知识库用途" rows={3} maxLength={200} />
      </Form.Item>
      <Form.Item label="可见范围" name="visibility" rules={[{ required: true }]}>
        <Select options={visibilityOptions} />
      </Form.Item>
      <Form.Item label="首篇知识（可选）" name="initialContent">
        <Input.TextArea placeholder="可直接写入 Markdown 或纯文本，创建后作为首份文档" rows={6} />
      </Form.Item>
    </Form>
  );
}

function ImportKbFormPanel({
  fileList,
  onFileListChange,
  onSubmit,
}: {
  fileList: UploadFile[];
  onFileListChange: (list: UploadFile[]) => void;
  onSubmit: (values: { name: string; description: string; visibility: Visibility }) => void;
}) {
  const [form] = Form.useForm<{ name: string; description: string; visibility: Visibility }>();

  return (
    <Form
      id={IMPORT_FORM_ID}
      form={form}
      layout="vertical"
      initialValues={{ visibility: 'private' as Visibility }}
      onFinish={onSubmit}
    >
      <Form.Item label="知识库名称" name="name" rules={[{ required: true, message: '请输入知识库名称' }]}>
        <Input placeholder="例如：产品需求文档" maxLength={50} />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea placeholder="可选，导入后可在知识库中继续补充" rows={2} maxLength={200} />
      </Form.Item>
      <Form.Item label="可见范围" name="visibility" rules={[{ required: true }]}>
        <Select options={visibilityOptions} />
      </Form.Item>
      <Form.Item label="导入文件" required>
        <Upload.Dragger
          multiple
          accept={uploadAccept}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: nextList }) => onFileListChange(nextList)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处</p>
          <p className="ant-upload-hint">支持 PDF、Word、Excel、Markdown、TXT 等格式</p>
        </Upload.Dragger>
      </Form.Item>
    </Form>
  );
}

function CreateKnowledgeBaseModal({ open, onClose, onCreateManual, onCreateImport }: CreateKnowledgeBaseModalProps) {
  const [mode, setMode] = useState<CreateKbMode>('choose');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const resetModal = () => {
    setMode('choose');
    setFileList([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleAfterClose = () => {
    resetModal();
  };

  const submitManual = (values: ManualKbValues) => {
    onCreateManual(values);
    handleClose();
  };

  const submitImport = (values: { name: string; description: string; visibility: Visibility }) => {
    const files = fileList
      .map((item) => item.originFileObj)
      .filter((file): file is NonNullable<UploadFile['originFileObj']> => !!file);
    if (!files.length) {
      message.warning('请至少选择一个文件');
      return;
    }
    onCreateImport({ ...values, files });
    handleClose();
  };

  const modalTitle = mode === 'choose' ? '新建知识库' : mode === 'manual' ? '自己写知识库' : '导入创建知识库';
  const activeFormId = mode === 'manual' ? MANUAL_FORM_ID : IMPORT_FORM_ID;

  const footer =
    mode === 'choose' ? (
      <Button onClick={handleClose}>取消</Button>
    ) : (
      <Space>
        <Button onClick={() => setMode('choose')}>上一步</Button>
        <Button onClick={handleClose}>取消</Button>
        <Button type="primary" htmlType="submit" form={activeFormId}>
          {mode === 'manual' ? '创建知识库' : '导入并创建'}
        </Button>
      </Space>
    );

  return (
    <Modal
      className="kb-create-modal"
      title={modalTitle}
      open={open}
      onCancel={handleClose}
      afterClose={handleAfterClose}
      footer={footer}
      width={560}
      destroyOnHidden
      maskClosable={false}
    >
      {mode === 'choose' && (
        <div className="kb-create-choices">
          <button type="button" className="kb-create-choice" onClick={() => setMode('manual')}>
            <span className="kb-create-choice__icon">
              <EditOutlined />
            </span>
            <strong>自己写</strong>
            <Typography.Text type="secondary">填写名称与描述，可附带首篇知识正文</Typography.Text>
          </button>
          <button type="button" className="kb-create-choice" onClick={() => setMode('import')}>
            <span className="kb-create-choice__icon kb-create-choice__icon--import">
              <ImportOutlined />
            </span>
            <strong>直接导入</strong>
            <Typography.Text type="secondary">上传 PDF、Word、Excel、Markdown 等文件自动建库</Typography.Text>
          </button>
        </div>
      )}

      {mode === 'manual' && open && <ManualKbFormPanel onSubmit={submitManual} />}
      {mode === 'import' && open && (
        <ImportKbFormPanel fileList={fileList} onFileListChange={setFileList} onSubmit={submitImport} />
      )}
    </Modal>
  );
}

export default CreateKnowledgeBaseModal;
