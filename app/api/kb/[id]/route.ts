import { NextRequest, NextResponse } from 'next/server';
import { deleteKnowledgeBase, getKnowledgeBase, updateKnowledgeBase } from '@/lib/server/kb-storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kb = getKnowledgeBase(id);
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
  return NextResponse.json(kb);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await req.json();
  const kb = updateKnowledgeBase(id, patch);
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
  return NextResponse.json(kb);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteKnowledgeBase(id);
  if (!ok) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
