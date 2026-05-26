import { NextRequest, NextResponse } from 'next/server';
import { createDocument, getDocuments } from '@/lib/server/kb-storage';
import type { DocumentStatus, FileType } from '@/types';

export async function GET(req: NextRequest) {
  const kbId = req.nextUrl.searchParams.get('kbId') ?? undefined;
  return NextResponse.json(getDocuments(kbId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { knowledgeBaseId, title, fileName, fileType, fileSize, content } = body as {
    knowledgeBaseId: string;
    title: string;
    fileName: string;
    fileType: FileType;
    fileSize: number;
    content: string;
  };
  if (!knowledgeBaseId || !title) {
    return NextResponse.json({ error: 'knowledgeBaseId and title are required' }, { status: 400 });
  }
  const doc = createDocument({
    knowledgeBaseId,
    title,
    fileName: fileName ?? `${title}.md`,
    fileType: fileType ?? 'markdown',
    fileSize: fileSize ?? 0,
    status: 'completed' as DocumentStatus,
    processingProgress: 100,
    chunkCount: Math.max(1, Math.ceil((content?.length ?? 0) / 500)),
    uploadedBy: {
      id: 'u_001',
      name: '林知夏',
      email: 'lin@example.com',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    content: content ?? '',
  });
  return NextResponse.json(doc, { status: 201 });
}
