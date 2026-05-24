import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUploadedFile, getFileType } from '@/lib/document';
import type { FileType, DocumentStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get('kbId');

    const where = kbId ? { knowledgeBaseId: kbId } : {};
    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const knowledgeBaseId = formData.get('knowledgeBaseId') as string;

      if (!file) {
        return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
      }

      if (!knowledgeBaseId) {
        return NextResponse.json({ error: '请指定知识库ID' }, { status: 400 });
      }

      let user;
      const users = await prisma.user.findMany({ take: 1 });
      if (users.length > 0) {
        user = users[0];
      } else {
        user = await prisma.user.create({
          data: {
            name: '默认用户',
            email: `default_${Date.now()}@example.com`,
            role: 'editor',
          },
        });
      }

      let content = '';
      let fileType: FileType = getFileType(file.name);

      try {
        const parsed = await parseUploadedFile(file);
        fileType = parsed.type;
        content = parsed.content;
      } catch {
        content = `文件《${file.name}》已上传，等待解析。`;
      }

      const document = await prisma.document.create({
        data: {
          knowledgeBaseId,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          fileType,
          fileSize: file.size,
          status: 'uploading',
          processingProgress: 0,
          chunkCount: 0,
          embeddingModel: 'text-embedding-3-large',
          content,
          uploadedById: user.id,
        },
      });

      setTimeout(() => simulateDocumentProcessing(document.id), 1000);

      return NextResponse.json({ message: '文档上传成功', document }, { status: 201 });
    } else {
      const body = await request.json();

      if (!body.knowledgeBaseId || !body.title) {
        return NextResponse.json(
          { error: '缺少必要参数：knowledgeBaseId 和 title' },
          { status: 400 }
        );
      }

      let user;
      const users = await prisma.user.findMany({ take: 1 });
      if (users.length > 0) {
        user = users[0];
      } else {
        user = await prisma.user.create({
          data: {
            name: '默认用户',
            email: `default_${Date.now()}@example.com`,
            role: 'editor',
          },
        });
      }

      const document = await prisma.document.create({
        data: {
          ...body,
          uploadedById: user.id,
        },
      });

      return NextResponse.json({ message: '文档创建成功', document }, { status: 201 });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

function simulateDocumentProcessing(docId: string) {
  const stages: Array<{ status: DocumentStatus; progress: number }> = [
    { status: 'parsing', progress: 28 },
    { status: 'chunking', progress: 58 },
    { status: 'embedding', progress: 84 },
    { status: 'completed', progress: 100 },
  ];

  let i = 0;
  const interval = setInterval(async () => {
    if (i >= stages.length) {
      clearInterval(interval);

      try {
        const { processDocumentForRAG } = await import('@/lib/chunker');
        await processDocumentForRAG(docId);
      } catch (error) {
        console.error('Failed to process document for RAG:', error);
      }
      return;
    }

    await prisma.document.update({
      where: { id: docId },
      data: {
        status: stages[i].status,
        processingProgress: stages[i].progress,
        chunkCount: stages[i].progress > 50 ? Math.floor(Math.random() * 80) + 20 : 0,
      },
    });
    i++;
  }, 2000);
}
