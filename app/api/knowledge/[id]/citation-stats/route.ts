import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { Citation } from '@/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const kb = await prisma.knowledge.findUnique({ where: { id } });
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        role: 'assistant',
        conversation: { knowledgeId: id },
      },
      select: { citations: true, conversationId: true },
    });

    type DocAcc = {
      title: string;
      count: number;
      totalScore: number;
      chunkCounts: Map<number, number>;
      conversationIds: Set<string>;
    };

    const docMap = new Map<string, DocAcc>();
    let totalCitations = 0;
    const conversationIdsWithCitations = new Set<string>();

    for (const msg of messages) {
      let citations: Citation[] = [];
      try {
        citations = JSON.parse(msg.citations || '[]');
      } catch {
        continue;
      }
      if (!Array.isArray(citations) || citations.length === 0) continue;

      conversationIdsWithCitations.add(msg.conversationId);

      for (const c of citations) {
        totalCitations++;
        const key = c.documentId;
        if (!docMap.has(key)) {
          docMap.set(key, {
            title: c.documentTitle,
            count: 0,
            totalScore: 0,
            chunkCounts: new Map(),
            conversationIds: new Set(),
          });
        }
        const acc = docMap.get(key)!;
        acc.count++;
        acc.totalScore += c.confidenceScore;
        acc.chunkCounts.set(c.chunkIndex, (acc.chunkCounts.get(c.chunkIndex) ?? 0) + 1);
        acc.conversationIds.add(msg.conversationId);
      }
    }

    const documents = Array.from(docMap.entries())
      .map(([documentId, acc]) => {
        const chunkBreakdown = Array.from(acc.chunkCounts.entries())
          .map(([chunkIndex, count]) => ({ chunkIndex, count }))
          .sort((a, b) => b.count - a.count);

        return {
          documentId,
          documentTitle: acc.title,
          citationCount: acc.count,
          averageConfidence: acc.count > 0 ? Math.round((acc.totalScore / acc.count) * 1000) / 1000 : 0,
          chunkBreakdown,
        };
      })
      .sort((a, b) => b.citationCount - a.citationCount);

    return NextResponse.json({
      data: {
        summary: {
          totalCitations,
          uniqueDocumentsCited: docMap.size,
          totalConversations: conversationIdsWithCitations.size,
          totalAssistantMessages: messages.filter((m) => {
            try {
              const arr = JSON.parse(m.citations || '[]');
              return Array.isArray(arr) && arr.length > 0;
            } catch {
              return false;
            }
          }).length,
        },
        documents,
      },
    });
  } catch (err) {
    console.error('[CitationStats API] error:', err);
    return NextResponse.json({ error: '获取引用统计失败' }, { status: 500 });
  }
}
