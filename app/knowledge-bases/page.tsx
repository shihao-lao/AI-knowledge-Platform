'use client';

import {
  BookOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Collapse, Descriptions, Divider, Empty, Input, Row, Space, Spin, Statistic, Tag, Tooltip, Typography, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listDatasets, createDataset, uploadFile, type DatasetInfo } from '@/app/api/kb';
import CreateKnowledgeBaseModal from '@/components/create-kb-modal';
import { knowledgePath } from '@/lib/paths';
import type { Visibility } from '@/types';

/** 格式化文件大小 */
function formatFileSize(sizeStr: string): string {
  const size = parseInt(sizeStr, 10);
  if (isNaN(size) || size === 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** 格式化时间戳 */
function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '-';
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return formatTimestamp(timestamp);
}

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cozeDatasets, setCozeDatasets] = useState<DatasetInfo[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((datasetId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  }, []);

  // 从 Coze API 获取知识库列表
  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const result = await listDatasets();
      if (result.code === 0 && result.data?.dataset_list) {
        setCozeDatasets(result.data.dataset_list);
        message.success(`已加载 ${result.data.dataset_list.length} 个知识库`);
      } else {
        message.error(result.msg || '获取知识库列表失败');
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时获取知识库列表
  useEffect(() => {
    fetchDatasets();
  }, []);

  const filteredKbs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return cozeDatasets;
    return cozeDatasets.filter(
      (kb) => kb.name.toLowerCase().includes(keyword) || kb.description.toLowerCase().includes(keyword),
    );
  }, [cozeDatasets, search]);

  const handleCreateManualKb = async (values: { name: string; description: string; visibility: Visibility; initialContent?: string }) => {
    const hide = message.loading('正在创建知识库...', 0);
    try {
      const result = await createDataset({
        name: values.name,
        format_type: 0,
      });
      if (result.code === 0 && result.data?.dataset_id) {
        message.success(`知识库「${values.name}」已创建`);
        await fetchDatasets();
        router.push(knowledgePath(result.data.dataset_id));
      } else {
        message.error(result.msg || '创建知识库失败');
      }
    } catch {
      message.error('创建知识库失败，请检查网络连接');
    } finally {
      hide();
    }
  };

  const handleCreateImportKb = async (values: {
    name: string;
    description: string;
    visibility: Visibility;
    files: File[];
  }) => {
    const hide = message.loading('正在创建知识库...', 0);
    try {
      const result = await createDataset({
        name: values.name,
        format_type: 0,
      });
      if (result.code === 0 && result.data?.dataset_id) {
        const datasetId = result.data.dataset_id;
        if (values.files.length > 0) {
          message.loading({ content: `正在上传 ${values.files.length} 个文件...`, key: 'upload', duration: 0 });
          for (const file of values.files) {
            await uploadFile(file, datasetId);
          }
          message.success({ content: `已上传 ${values.files.length} 个文件`, key: 'upload' });
        }
        message.success(`知识库「${values.name}」已创建`);
        await fetchDatasets();
        router.push(knowledgePath(datasetId));
      } else {
        message.error(result.msg || '创建知识库失败');
      }
    } catch {
      message.error('创建知识库失败，请检查网络连接');
    } finally {
      hide();
    }
  };

  return (
    <main className="simple-page">
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2}>知识库管理</Typography.Title>
          <Typography.Text type="secondary">创建、搜索并管理你的团队知识库。</Typography.Text>
        </div>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索知识库"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDatasets} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setKbModalOpen(true)}>
            新建知识库
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {filteredKbs.length === 0 ? (
          <Empty description="暂无知识库" />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredKbs.map((kb) => {
              const isExpanded = expandedIds.has(kb.dataset_id);
              return (
                <Col xs={24} md={12} xl={8} key={kb.dataset_id}>
                  <Card
                    className="kb-card"
                    actions={[
                      <Link href={knowledgePath(kb.dataset_id)} key="open">
                        打开
                      </Link>,
                      <span key="detail" onClick={() => toggleExpand(kb.dataset_id)} style={{ cursor: 'pointer' }}>
                        {isExpanded ? <CloseOutlined /> : <EyeOutlined />}
                        <span style={{ marginLeft: 4 }}>{isExpanded ? '收起' : '详情'}</span>
                      </span>,
                      <DeleteOutlined key="delete" />,
                    ]}
                  >
                    <Space align="start" style={{ width: '100%' }}>
                      <span className="kb-card__icon">
                        {kb.icon_url ? (
                          <img src={kb.icon_url} alt={kb.name} style={{ width: 48, height: 48, borderRadius: 8 }} />
                        ) : (
                          <BookOutlined style={{ fontSize: 48 }} />
                        )}
                      </span>
                      <div style={{ flex: 1 }}>
                        <Typography.Title level={4} style={{ marginBottom: 4 }}>
                          {kb.name}
                        </Typography.Title>
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ marginBottom: 8, minHeight: 44 }}
                        >
                          {kb.description || '暂无描述'}
                        </Typography.Paragraph>
                        <Space size={4} wrap>
                          <Tag color="blue">
                            <FileOutlined /> {kb.file_list?.length ?? kb.doc_count} 份文档
                          </Tag>
                          {kb.bot_used_count > 0 && (
                            <Tag color="green">
                              <RobotOutlined /> {kb.bot_used_count} 个 Bot
                            </Tag>
                          )}
                          {kb.processing_file_list && kb.processing_file_list.length > 0 && (
                            <Tag color="processing">
                              处理中 {kb.processing_file_list.length} 个文件
                            </Tag>
                          )}
                          {kb.failed_file_list && kb.failed_file_list.length > 0 && (
                            <Tag color="error">
                              失败 {kb.failed_file_list.length} 个文件
                            </Tag>
                          )}
                        </Space>
                      </div>
                    </Space>

                    <div className="kb-card__stats">
                      <Statistic
                        title="文档"
                        value={kb.file_list?.length ?? kb.doc_count}
                        prefix={<FileOutlined />}
                      />
                      <Statistic
                        title="大小"
                        value={formatFileSize(kb.all_file_size)}
                      />
                      {kb.hit_count > 0 && (
                        <Statistic
                          title="命中"
                          value={kb.hit_count}
                          prefix={<ThunderboltOutlined />}
                        />
                      )}
                    </div>

                    <div className="kb-card__meta">
                      <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                        <Tooltip title={`创建者: ${kb.creator_name}`}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {kb.avatar_url ? (
                              <img
                                src={kb.avatar_url}
                                alt={kb.creator_name}
                                style={{ width: 16, height: 16, borderRadius: '50%', marginRight: 4, verticalAlign: 'middle' }}
                              />
                            ) : (
                              <UserOutlined style={{ marginRight: 4 }} />
                            )}
                            {kb.creator_name}
                          </Typography.Text>
                        </Tooltip>
                        <Tooltip title={formatTimestamp(kb.create_time)}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            创建于 {formatRelativeTime(kb.create_time)}
                          </Typography.Text>
                        </Tooltip>
                      </Space>
                    </div>
                  </Card>

                  {/* 详情面板 */}
                  {isExpanded && (
                    <Card
                      size="small"
                      style={{ marginTop: -1, borderTop: '2px solid #1677ff' }}
                      title={
                        <Space>
                          <InfoCircleOutlined />
                          <span>{kb.name} — 详细信息</span>
                        </Space>
                      }
                      extra={
                        <CloseOutlined
                          style={{ cursor: 'pointer', color: '#999' }}
                          onClick={() => toggleExpand(kb.dataset_id)}
                        />
                      }
                    >
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="知识库 ID">{kb.dataset_id}</Descriptions.Item>
                        <Descriptions.Item label="空间 ID">{kb.space_id}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Tag color={kb.status === 1 ? 'green' : 'default'}>
                            {kb.status === 1 ? '正常' : `状态 ${kb.status}`}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="格式类型">{kb.format_type === 0 ? '文本' : `类型 ${kb.format_type}`}</Descriptions.Item>
                        <Descriptions.Item label="创建者">
                          <Space size={4}>
                            {kb.avatar_url && (
                              <img src={kb.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                            )}
                            {kb.creator_name}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建者 ID">{kb.creator_id}</Descriptions.Item>
                        <Descriptions.Item label="创建时间">{formatTimestamp(kb.create_time)}</Descriptions.Item>
                        <Descriptions.Item label="更新时间">{formatTimestamp(kb.update_time)}</Descriptions.Item>
                        <Descriptions.Item label="文档数">{kb.file_list?.length ?? kb.doc_count}</Descriptions.Item>
                        <Descriptions.Item label="切片数">{kb.slice_count}</Descriptions.Item>
                        <Descriptions.Item label="总大小">{formatFileSize(kb.all_file_size)}</Descriptions.Item>
                        <Descriptions.Item label="命中次数">{kb.hit_count}</Descriptions.Item>
                        <Descriptions.Item label="Bot 引用">{kb.bot_used_count}</Descriptions.Item>
                        <Descriptions.Item label="可编辑">{kb.can_edit ? '是' : '否'}</Descriptions.Item>
                        <Descriptions.Item label="描述" span={2}>
                          {kb.description || '暂无描述'}
                        </Descriptions.Item>
                      </Descriptions>

                      {kb.file_list && kb.file_list.length > 0 && (
                        <>
                          <Divider orientation="left" plain style={{ margin: '12px 0 8px' }}>
                            文件列表
                          </Divider>
                          <Space wrap size={[8, 8]}>
                            {kb.file_list.map((file, index) => (
                              <Tag key={index} icon={<FileOutlined />}>
                                {file}
                              </Tag>
                            ))}
                          </Space>
                        </>
                      )}

                      {kb.processing_file_list && kb.processing_file_list.length > 0 && (
                        <>
                          <Divider orientation="left" plain style={{ margin: '12px 0 8px' }}>
                            处理中的文件
                          </Divider>
                          <Space wrap size={[8, 8]}>
                            {kb.processing_file_list.map((file, index) => (
                              <Tag key={index} color="processing">
                                {file}
                              </Tag>
                            ))}
                          </Space>
                        </>
                      )}

                      {kb.failed_file_list && kb.failed_file_list.length > 0 && (
                        <>
                          <Divider orientation="left" plain style={{ margin: '12px 0 8px' }}>
                            失败的文件
                          </Divider>
                          <Space wrap size={[8, 8]}>
                            {kb.failed_file_list.map((file, index) => (
                              <Tag key={index} color="error">
                                {file}
                              </Tag>
                            ))}
                          </Space>
                        </>
                      )}
                    </Card>
                  )}
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>

      <CreateKnowledgeBaseModal
        open={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        onCreateManual={handleCreateManualKb}
        onCreateImport={handleCreateImportKb}
      />
    </main>
  );
}
