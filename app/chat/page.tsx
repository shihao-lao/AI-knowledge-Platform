import { redirect } from 'next/navigation';
import { defaultChatPath } from '@/lib/paths';

export default function ChatIndexPage() {
  redirect(defaultChatPath());
}
