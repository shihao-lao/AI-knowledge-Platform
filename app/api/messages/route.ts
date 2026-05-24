import { NextRequest, NextResponse } from 'next/server';
import { getMessages, getConversationById } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: '缺少 conversationId 参数' }, { status: 400 });
    }

    const conv = getConversationById(conversationId);
    if (!conv) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    const messages = getMessages(conversationId);

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
