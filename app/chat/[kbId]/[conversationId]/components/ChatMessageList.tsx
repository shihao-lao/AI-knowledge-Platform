'use client';

import { useEffect, useRef } from 'react';
import { Avatar } from 'antd';
import type { Message, User } from '@/types';
import MarkdownMessage from '@/components/markdown-message';

interface ChatMessageListProps {
  messages: Message[];
  currentUser: User;
}

export default function ChatMessageList({ messages, currentUser }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((item) => (
        <article className={`message-row ${item.role === 'user' ? 'is-user' : ''}`} key={item.id}>
          <Avatar src={item.role === 'user' ? currentUser.avatar : undefined}>
            {item.role === 'user' ? '我' : 'AI'}
          </Avatar>
          <div className="message-bubble">
            {item.streaming && !item.content ? (
              <span className="thinking-dots">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <MarkdownMessage>{item.content}</MarkdownMessage>
            )}
          </div>
        </article>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
