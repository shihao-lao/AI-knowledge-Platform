'use client';

import { Button, Empty, Spin, Tag, Typography, message } from 'antd';
import { CopyOutlined, CheckOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { KnowledgeDocument } from '@/types';
import { formatSize, fileTypeText } from '@/lib/document';

type TabKey = 'summary' | 'skill';

interface KnowledgeSidebarProps {
  expandedDoc: KnowledgeDocument | null;
  onGoToChat: () => void;
}

export default function KnowledgeSidebar({ expandedDoc, onGoToChat }: KnowledgeSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  // 摘要状态
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // 专家 Skill 状态
  const [skill, setSkill] = useState('');
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState('');
  const [copied, setCopied] = useState(false);

  // 文档切换时自动触发 AI 摘要
  useEffect(() => {
    if (!expandedDoc?.content) {
      setSummary('');
      setSummaryError('');
      setSkill('');
      setSkillError('');
      return;
    }

    let cancelled = false;
    setSummary('');
    setSummaryError('');
    setSummaryLoading(true);

    fetch('/api/mimo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'summary', title: expandedDoc.title, content: expandedDoc.content }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setSummary(json.data);
      })
      .catch((err) => {
        if (!cancelled) setSummaryError(err.message || '生成摘要失败');
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expandedDoc?.id, expandedDoc?.content, expandedDoc?.title]);

  // 切换到专家 Skill 时触发生成
  useEffect(() => {
    if (activeTab !== 'skill' || !expandedDoc?.content || skill) return;

    let cancelled = false;
    setSkill('');
    setSkillError('');
    setSkillLoading(true);

    fetch('/api/mimo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skill', title: expandedDoc.title, content: expandedDoc.content }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setSkill(json.data);
      })
      .catch((err) => {
        if (!cancelled) setSkillError(err.message || '生成专家 Skill 失败');
      })
      .finally(() => {
        if (!cancelled) setSkillLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, expandedDoc?.id, expandedDoc?.content, expandedDoc?.title, skill]);

  // 文档切换时重置 Skill 状态
  useEffect(() => {
    setSkill('');
    setSkillError('');
    setActiveTab('summary');
    setCopied(false);
  }, [expandedDoc?.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(skill);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动选择复制');
    }
  };

  return (
    <aside className="insight-panel">
      <div className="insight-panel__head">
        <Typography.Title level={5}>文档属性与智能洞察</Typography.Title>
      </div>
      {expandedDoc ? (
        <>
          {/* 文档标题与描述 */}
          <div className="property-list">
            <div>
              <span>文档标题</span>
              <strong>{expandedDoc.title}</strong>
            </div>
            <div>
              <span>文档描述</span>
              <strong className="sidebar-desc">
                {expandedDoc.content
                  ? expandedDoc.content.slice(0, 120) + (expandedDoc.content.length > 120 ? '...' : '')
                  : '暂无描述'}
              </strong>
            </div>
            <div>
              <span>文档类型</span>
              <strong>{fileTypeText[expandedDoc.fileType]}</strong>
            </div>
            <div>
              <span>文件大小</span>
              <strong>{formatSize(expandedDoc.fileSize)}</strong>
            </div>
            {expandedDoc.charCount != null && expandedDoc.charCount > 0 && (
              <div>
                <span>字符长度</span>
                <strong>{expandedDoc.charCount.toLocaleString()} 字符</strong>
              </div>
            )}
            <div>
              <span>上传者</span>
              <strong>{expandedDoc.uploadedBy.name}</strong>
            </div>
            <div>
              <span>知识切片</span>
              <strong>{expandedDoc.chunkCount || '处理中'} 段</strong>
            </div>
          </div>

          <div className="tag-row">
            <Tag color="blue">知识库</Tag>
            <Tag color="green">可问答</Tag>
            <Tag color="gold">中文资料</Tag>
          </div>

          {/* AI 智能摘要 & 专家 Skill */}
          <section className="ai-summary">
            <div className="ai-summary__tabs">
              <button
                type="button"
                className={activeTab === 'summary' ? 'is-active' : ''}
                onClick={() => setActiveTab('summary')}
              >
                摘要
              </button>
              <button
                type="button"
                className={activeTab === 'skill' ? 'is-active' : ''}
                onClick={() => setActiveTab('skill')}
              >
                专家 Skill
              </button>
            </div>

            {/* 摘要面板 */}
            {activeTab === 'summary' && (
              <>
                <Typography.Title level={5}>
                  <RobotOutlined className="sidebar-icon" />
                  AI 智能摘要
                </Typography.Title>

                {summaryLoading && (
                  <Spin>
                    <div className="sidebar-loading">
                      <Typography.Text type="secondary">正在生成摘要...</Typography.Text>
                    </div>
                  </Spin>
                )}

                {summaryError && (
                  <Typography.Paragraph type="danger" className="sidebar-error">
                    {summaryError}
                  </Typography.Paragraph>
                )}

                {summary && (
                  <Typography.Paragraph className="sidebar-summary">
                    {summary}
                  </Typography.Paragraph>
                )}

                {!summaryLoading && !summaryError && !summary && (
                  <Typography.Paragraph type="secondary" className="sidebar-placeholder">
                    暂无摘要，请上传文档后自动生成。
                  </Typography.Paragraph>
                )}
              </>
            )}

            {/* 专家 Skill 面板 */}
            {activeTab === 'skill' && (
              <>
                <div className="sidebar-skill-header">
                  <Typography.Title level={5}>
                    <ThunderboltOutlined className="sidebar-icon" />
                    专家 Skill
                  </Typography.Title>
                  {skill && (
                    <Button
                      type="text"
                      size="small"
                      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                      onClick={handleCopy}
                    >
                      {copied ? '已复制' : '复制'}
                    </Button>
                  )}
                </div>

                {skillLoading && (
                  <Spin>
                    <div className="sidebar-loading">
                      <Typography.Text type="secondary">正在生成专家 Skill...</Typography.Text>
                    </div>
                  </Spin>
                )}

                {skillError && (
                  <Typography.Paragraph type="danger" className="sidebar-error">
                    {skillError}
                  </Typography.Paragraph>
                )}

                {skill && (
                  <div className="sidebar-skill-content">
                    <Typography.Paragraph className="sidebar-skill-text">
                      {skill}
                    </Typography.Paragraph>
                  </div>
                )}

                {!skillLoading && !skillError && !skill && (
                  <Typography.Paragraph type="secondary" className="sidebar-placeholder">
                    基于文档内容自动生成专家级 System Prompt，可直接复制使用。
                  </Typography.Paragraph>
                )}
              </>
            )}

            <Button type="primary" block onClick={onGoToChat} className="sidebar-action">
              基于此文档提问
            </Button>
          </section>
        </>
      ) : (
        <Empty description="点击左侧知识条目查看属性" />
      )}
    </aside>
  );
}
