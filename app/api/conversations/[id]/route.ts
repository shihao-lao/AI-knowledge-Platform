import { NextResponse } from 'next/server';
import { deleteConversation, getConversation, getMessages } from '@/lib/server/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  const messages = getMessages(id);
  return NextResponse.json({ conversation, messages });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteConversation(id);
  if (!ok) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
