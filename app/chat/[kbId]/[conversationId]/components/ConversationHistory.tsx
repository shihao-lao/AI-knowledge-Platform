'use client';

import { DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import { App, Button, Card, List, Typography } from 'antd';
import type { Conversation } from '@/types';

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}

export default function ConversationHistory({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
}: ConversationHistoryProps) {
  const { modal } = App.useApp();

  return (
    <Card size="small" title="历史对话" className="chat-side__card" styles={{ body: { paddingTop: 8 } }}>
      <List
        size="small"
        dataSource={conversations}
        locale={{ emptyText: <Typography.Text type="secondary">暂无对话</Typography.Text> }}
        renderItem={(chat) => {
          const active = activeConversationId === chat.id;
          return (
            <List.Item
              className={`chat-history ${active ? 'is-active' : ''}`}
              onClick={() => onSelect(chat.id)}
              style={{ padding: 0, cursor: 'pointer' }}
            >
              <Button
                type="text"
                block
                icon={<MessageOutlined />}
                className="chat-history__btn"
                onClick={() => onSelect(chat.id)}
              >
                <span className="chat-history__title">{chat.title}</span>
                <Typography.Text type="secondary" className="chat-history__count">
                  {chat.messageCount} 条
                </Typography.Text>
              </Button>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                className="chat-history__delete"
                onClick={(e) => {
                  e.stopPropagation();
                  modal.confirm({
                    title: '确定删除此对话？',
                    content: '删除后不可恢复',
                    okText: '删除',
                    cancelText: '取消',
                    okButtonProps: { danger: true },
                    onOk: () => onDelete(chat.id),
                  });
                }}
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
