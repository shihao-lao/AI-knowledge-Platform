import { NextRequest, NextResponse } from 'next/server';
import { getConversationById, deleteConversation, getMessages } from '@/lib/store';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conv = getConversationById(id);
    if (!conv) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    const messages = getMessages(id);

    return NextResponse.json({ conversation: conv, messages });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = deleteConversation(id);
    if (!success) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
