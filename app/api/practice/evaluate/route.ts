import { NextRequest, NextResponse } from 'next/server';
import { practiceService, PracticeNotFoundError } from '@/lib/server/practice-service';
import { requireUser, AuthError } from '@/lib/server/auth';

// POST /api/practice/evaluate { questionId, userAnswer }
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { questionId, userAnswer } = body ?? {};

    if (typeof questionId !== 'string' || !questionId) {
      return NextResponse.json({ error: 'questionId 不能为空' }, { status: 400 });
    }
    if (typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      return NextResponse.json({ error: '回答不能为空' }, { status: 400 });
    }
    if (userAnswer.length > 20000) {
      return NextResponse.json({ error: '回答过长' }, { status: 400 });
    }

    const result = await practiceService.evaluate(questionId, user.id, userAnswer.trim());
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PracticeNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[Practice API] evaluate error:', err);
    return NextResponse.json({ error: '评估失败' }, { status: 500 });
  }
}
