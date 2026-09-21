"""Aggregate persisted citations within a user's knowledge base."""
import json
import math
from collections import Counter
from sqlalchemy import select, func
from app.infrastructure.database.models import Knowledge, Conversation, Message, Document, Chunk
from app.infrastructure.database.session import get_session_context


async def get_citation_stats(knowledge_id: str, user_id: str) -> dict:
    async with get_session_context() as session:
        if not await session.scalar(select(Knowledge.id).where(
            Knowledge.id == knowledge_id, Knowledge.user_id == user_id
        )):
            raise ValueError('知识库不存在')
        documents = (await session.scalars(select(Document).where(Document.knowledge_id == knowledge_id))).all()
        names = {d.id: d.filename for d in documents}
        chunks = (await session.scalars(select(Chunk).join(Document).where(
            Document.knowledge_id == knowledge_id))).all()
        chunk_map = {c.id: c for c in chunks}
        messages = (await session.scalars(select(Message).join(Conversation).where(
            Conversation.knowledge_id == knowledge_id, Message.role == 'assistant'))).all()
        conversations = await session.scalar(select(func.count()).select_from(Conversation).where(
            Conversation.knowledge_id == knowledge_id))
    groups = {}
    for message in messages:
        try:
            citations = json.loads(message.citations or '[]')
        except (ValueError, TypeError):
            continue
        if not isinstance(citations, list):
            continue
        for citation in citations:
            if not isinstance(citation, dict):
                continue
            doc_id = citation.get('documentId', citation.get('document_id'))
            if not isinstance(doc_id, str):
                continue
            chunk_index = citation.get('chunkIndex', citation.get('chunk_index', 0))
            # Support older chat records that stored a chunk ID as documentId.
            if doc_id in chunk_map:
                chunk = chunk_map[doc_id]
                doc_id, chunk_index = chunk.document_id, chunk.chunk_index
            if doc_id not in names:
                continue
            try:
                confidence = float(citation.get('confidenceScore', citation.get('confidence_score', 0)))
                chunk_index = int(chunk_index)
            except (ValueError, TypeError):
                continue
            if not math.isfinite(confidence):
                continue
            group = groups.setdefault(doc_id, {'scores': [], 'chunks': Counter()})
            group['scores'].append(max(0, min(1, confidence)))
            group['chunks'][chunk_index] += 1
    rows = [dict(document_id=doc_id, document_title=names[doc_id], citation_count=len(g['scores']),
                 average_confidence=sum(g['scores']) / len(g['scores']),
                 chunk_breakdown=[dict(chunk_index=i, count=n) for i, n in g['chunks'].most_common()])
            for doc_id, g in groups.items()]
    rows.sort(key=lambda row: row['citation_count'], reverse=True)
    return {'summary': dict(total_citations=sum(r['citation_count'] for r in rows),
        unique_documents_cited=len(rows), total_conversations=conversations,
        total_assistant_messages=len(messages)), 'documents': rows}
