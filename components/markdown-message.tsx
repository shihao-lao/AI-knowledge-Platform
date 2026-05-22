'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrism from 'rehype-prism-plus';

interface MarkdownMessageProps {
  children: string;
}

function MarkdownMessage({ children }: MarkdownMessageProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypePrism]}>
      {children}
    </ReactMarkdown>
  );
}

export default MarkdownMessage;
