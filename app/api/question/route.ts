import { NextRequest, NextResponse } from 'next/server';
import { questionService } from '@/lib/services/question-service';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

function serializeQuestion(q: { keywords: string }): Record<string, unknown> {
  const { keywords: rawKeywords, ...rest } = q;
  let keywords: string[] = [];
  try {
    const parsed: unknown = JSON.parse(rawKeywords);
    if (Array.isArray(parsed)) keywords = parsed;
  } catch {
    keywords = [];
  }
  return { ...rest, keywords };
}

// GET /api/question?knowledgeId=xxx&category=&difficulty=&keyword=
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');
    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId 不能为空' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const questions = await questionService.list(knowledgeId, {
      category: searchParams.get('category') ?? undefined,
      difficulty: searchParams.get('difficulty') ?? undefined,
      keyword: searchParams.get('keyword') ?? undefined,
    });
    const categories = await questionService.categories(knowledgeId);

    return NextResponse.json({ data: questions.map(serializeQuestion), categories });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Question API] list error:', err);
    return NextResponse.json({ error: '获取题目列表失败' }, { status: 500 });
  }
}

// POST /api/question { knowledgeId, questions: [...] }
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { knowledgeId, questions } = body ?? {};

    if (typeof knowledgeId !== 'string' || !knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId 不能为空' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions 不能为空' }, { status: 400 });
    }

    const result = await questionService.import(knowledgeId, user.id, questions);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[Question API] import error:', err);
    return NextResponse.json({ error: '导入题目失败' }, { status: 500 });
  }
}
