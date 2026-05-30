'use client';

import { MessageOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type { Conversation } from '@/types';

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelect: (conversationId: string) => void;
}

export default function ConversationHistory({
  conversations,
  activeConversationId,
  onSelect,
}: ConversationHistoryProps) {
  return (
    <div className="chat-history-panel">
      <Typography.Title level={5}>历史对话</Typography.Title>
      {conversations.map((chat) => (
        <button
          className={`chat-history ${activeConversationId === chat.id ? 'is-active' : ''}`}
          type="button"
          key={chat.id}
          onClick={() => onSelect(chat.id)}
        >
          <MessageOutlined />
          <span>{chat.title}</span>
        </button>
      ))}
    </div>
  );
}
