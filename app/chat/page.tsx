import { redirect } from 'next/navigation';
import { knowledgePath } from '@/lib/paths';

export default function ChatPage() {
  redirect(knowledgePath());
}
