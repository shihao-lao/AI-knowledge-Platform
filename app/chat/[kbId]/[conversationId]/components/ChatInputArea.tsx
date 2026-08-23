'use client';

import { SendOutlined } from '@ant-design/icons';
import { Button, Input, Typography } from 'antd';

interface ChatInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
}

export default function ChatInputArea({ value, onChange, onSend, sending }: ChatInputAreaProps) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <div className="composer-wrap">
      <div className="composer">
        <Input.TextArea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={2000}
          autoSize={{ minRows: 1, maxRows: 6 }}
          placeholder="向当前知识库提问，Enter 发送，Shift+Enter 换行"
          disabled={sending}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <Button
          type="primary"
          shape="circle"
          className="composer__send"
          icon={<SendOutlined />}
          disabled={!canSend}
          loading={sending}
          onClick={onSend}
        />
      </div>
      <Typography.Text type="secondary" className="composer__hint">
        Enter 发送 · Shift+Enter 换行 · {value.length}/2000
      </Typography.Text>
    </div>
  );
}
