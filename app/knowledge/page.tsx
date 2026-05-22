import { redirect } from 'next/navigation';
import { defaultKnowledgePath } from '@/lib/paths';

export default function KnowledgeIndexPage() {
  redirect(defaultKnowledgePath());
}
