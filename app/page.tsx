import { redirect } from 'next/navigation';
import { defaultKnowledgePath } from '@/lib/paths';

export default function HomePage() {
  redirect(defaultKnowledgePath());
}
