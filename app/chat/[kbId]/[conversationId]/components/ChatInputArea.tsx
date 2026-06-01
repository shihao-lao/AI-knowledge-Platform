'use client';

import { Button, Input } from 'antd';
import { SendOutlined } from '@ant-design/icons';

interface ChatInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
}

export default function ChatInputArea({ value, onChange, onSend, sending }: ChatInputAreaProps) {
  return (
    <div className="composer">
      <Input.TextArea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={2000}
        autoSize={{ minRows: 1, maxRows: 5 }}
        placeholder="向当前知识库提问，按 Enter 发送"
        disabled={sending}
        onPressEnter={(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <Button type="primary" icon={<SendOutlined />} onClick={onSend} loading={sending} disabled={sending} />
    </div>
  );
}
