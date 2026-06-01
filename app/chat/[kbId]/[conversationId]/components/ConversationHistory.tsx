'use client';

import { DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import { App, Typography } from 'antd';
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
    <div className="chat-history-panel">
      <Typography.Title level={5}>历史对话</Typography.Title>
      {conversations.map((chat) => (
        <div className={`chat-history ${activeConversationId === chat.id ? 'is-active' : ''}`} key={chat.id}>
          <button type="button" className="chat-history__btn" onClick={() => onSelect(chat.id)}>
            <MessageOutlined />
            <span>{chat.title}</span>
          </button>
          <button
            type="button"
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
          >
            <DeleteOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}
