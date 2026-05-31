import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/services/document-service';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = [
  'text/plain', 'text/markdown', 'text/x-markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/json',
];

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.markdown', '.pdf', '.docx', '.json'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const knowledgeId = formData.get('knowledgeId');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
    }

    if (!knowledgeId || typeof knowledgeId !== 'string') {
      return NextResponse.json({ error: 'knowledgeId 不能为空' }, { status: 400 });
    }

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      }, { status: 413 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: '文件不能为空' }, { status: 400 });
    }

    // MIME check
    if (!ALLOWED_MIMES.includes(file.type) && file.type !== '') {
      // Also check file extension
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: `不支持的文件类型: ${file.type || ext}` }, { status: 400 });
      }
    }

    // Extension check
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `不支持的文件扩展名: ${ext}` }, { status: 400 });
    }

    // Filename check - prevent path traversal
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return NextResponse.json({ error: '文件名包含非法字符' }, { status: 400 });
    }

    const doc = await documentService.upload(knowledgeId, file);

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    console.error('[Document API] upload error:', err);
    return NextResponse.json({ error: '文件上传失败' }, { status: 500 });
  }
}
