'use client';

import { Typography } from 'antd';
import type { Citation, Conversation } from '@/types';
import CitationCard from '@/components/citation-card';
import ConversationHistory from './ConversationHistory';

interface ChatSidebarProps {
  liveCitations: Citation[];
  conversations: Conversation[];
  activeConversationId: string;
  onCitationOpen: (citation: Citation) => void;
  onConversationSelect: (conversationId: string) => void;
  onConversationDelete: (conversationId: string) => void;
}

export default function ChatSidebar({
  liveCitations,
  conversations,
  activeConversationId,
  onCitationOpen,
  onConversationSelect,
  onConversationDelete,
}: ChatSidebarProps) {
  return (
    <aside className="chat-side">
      <Typography.Title level={5}>引用来源</Typography.Title>
      <Typography.Text type="secondary">回答生成时实时同步</Typography.Text>
      <div className="chat-side__citations">
        {liveCitations.length > 0 ? (
          liveCitations.map((citation) => (
            <CitationCard
              key={`${citation.documentId}-${citation.chunkIndex}`}
              citation={citation}
              onOpen={onCitationOpen}
            />
          ))
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            发送问题后，相关引用会在这里显示
          </Typography.Text>
        )}
      </div>
      <ConversationHistory
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={onConversationSelect}
        onDelete={onConversationDelete}
      />
    </aside>
  );
}
