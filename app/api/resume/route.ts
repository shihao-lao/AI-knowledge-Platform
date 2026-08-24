import { NextRequest, NextResponse } from 'next/server';
import { resumeService } from '@/lib/services/resume-service';
import { requireUser, AuthError } from '@/lib/server/auth';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.markdown', '.pdf', '.docx'];
const ALLOWED_MIMES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// GET /api/resume — 简历列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const resume = await resumeService.findById(id, user.id);
      if (!resume) {
        return NextResponse.json({ error: '简历不存在' }, { status: 404 });
      }
      return NextResponse.json({ data: resume });
    }

    const list = await resumeService.list(user.id);
    return NextResponse.json({ data: list });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Resume API] GET error:', err);
    return NextResponse.json({ error: '获取简历列表失败' }, { status: 500 });
  }
}

// POST /api/resume/analyze — 上传并分析简历
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择要上传的简历文件' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 20MB' }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: '文件不能为空' }, { status: 400 });
    }

    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `不支持的文件格式：${ext}，支持 ${ALLOWED_EXTENSIONS.join(' ')}` }, { status: 400 });
    }
    if (file.type && !ALLOWED_MIMES.includes(file.type) && file.type !== '') {
      return NextResponse.json({ error: `不支持的文件类型：${file.type}` }, { status: 400 });
    }
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return NextResponse.json({ error: '文件名包含非法字符' }, { status: 400 });
    }

    const result = await resumeService.analyze(user.id, file);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[Resume API] POST error:', err);
    return NextResponse.json({ error: '简历分析失败' }, { status: 500 });
  }
}

// DELETE /api/resume?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
    }

    const deleted = await resumeService.delete(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Resume API] DELETE error:', err);
    return NextResponse.json({ error: '删除简历失败' }, { status: 500 });
  }
}
