import { NextRequest, NextResponse } from 'next/server';
import { generateDocSummary, generateExpertSkill } from '@/lib/mimo-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, title, content } = body as { action: string; title: string; content: string };

    if (!action || !title || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (content.length > 50000) {
      return NextResponse.json({ error: '内容过长' }, { status: 400 });
    }

    let result: string;

    if (action === 'summary') {
      result = await generateDocSummary(title, content);
    } else if (action === 'skill') {
      result = await generateExpertSkill(title, content);
    } else {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
