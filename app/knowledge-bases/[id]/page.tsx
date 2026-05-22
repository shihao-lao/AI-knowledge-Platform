import { redirect } from 'next/navigation';
import { knowledgePath } from '@/lib/paths';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyKnowledgeBasePage({ params }: PageProps) {
  const { id } = await params;
  redirect(knowledgePath(id));
}
