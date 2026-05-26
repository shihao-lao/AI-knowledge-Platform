import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, getDocument, updateDocument } from '@/lib/server/kb-storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await req.json();
  const doc = updateDocument(id, patch);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteDocument(id);
  if (!ok) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
