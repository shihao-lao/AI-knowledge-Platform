import { NextRequest, NextResponse } from 'next/server';
import { createConversation, getConversations } from '@/lib/server/storage';

export async function GET(req: NextRequest) {
  const kbId = req.nextUrl.searchParams.get('kbId') ?? undefined;
  const limit = req.nextUrl.searchParams.get('limit');
  const offset = req.nextUrl.searchParams.get('offset');
  const result = getConversations(kbId, limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { knowledgeBaseId, title } = body as { knowledgeBaseId: string; title?: string };
  if (!knowledgeBaseId) {
    return NextResponse.json({ error: 'knowledgeBaseId is required' }, { status: 400 });
  }
  const result = createConversation(knowledgeBaseId, title);
  return NextResponse.json(result, { status: 201 });
}
