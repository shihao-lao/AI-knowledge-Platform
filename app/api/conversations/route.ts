import { NextRequest, NextResponse } from 'next/server';
import { getConversations, createConversation, getKnowledgeBaseById } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get('kbId');

    const conversations = getConversations(kbId || undefined);
    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { knowledgeBaseId, title } = body;

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: '请指定知识库ID' }, { status: 400 });
    }

    const kb = getKnowledgeBaseById(knowledgeBaseId);
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const conversation = createConversation({
      knowledgeBaseId,
      title: title || `新对话 - ${new Date().toLocaleString('zh-CN')}`,
    });

    return NextResponse.json({ message: '对话创建成功', conversation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
