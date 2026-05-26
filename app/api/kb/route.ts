import { NextRequest, NextResponse } from 'next/server';
import { createKnowledgeBase, getKnowledgeBases } from '@/lib/server/kb-storage';
import type { Visibility } from '@/types';

export async function GET() {
  return NextResponse.json(getKnowledgeBases());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, visibility } = body as { name: string; description?: string; visibility: Visibility };
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const kb = createKnowledgeBase({ name: name.trim(), description: description ?? '', visibility: visibility ?? 'private' });
  return NextResponse.json(kb, { status: 201 });
}
