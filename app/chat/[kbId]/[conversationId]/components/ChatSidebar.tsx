'use client';

import { Card, List, Typography } from 'antd';
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
      <Card size="small" title="引用来源" className="chat-side__card" styles={{ body: { paddingTop: 12 } }}>
        {liveCitations.length > 0 ? (
          <List
            size="small"
            split={false}
            dataSource={liveCitations}
            renderItem={(citation) => (
              <List.Item style={{ padding: '6px 0' }}>
                <CitationCard citation={citation} onOpen={onCitationOpen} />
              </List.Item>
            )}
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            发送问题后，回答引用的资料会显示在这里
          </Typography.Text>
        )}
      </Card>
      <ConversationHistory
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={onConversationSelect}
        onDelete={onConversationDelete}
      />
    </aside>
  );
}
