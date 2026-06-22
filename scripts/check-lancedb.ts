import { connect } from '@lancedb/lancedb';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'lancedb');

async function main() {
  const db = await connect(DB_PATH);
  const tableNames = await db.tableNames();
  console.log('Tables:', tableNames);

  if (tableNames.includes('knowledge_chunks')) {
    const table = await db.openTable('knowledge_chunks');
    const count = await table.countRows();
    console.log('\nTotal rows:', count);

    // 查看前 5 条
    const rows = await table.query().limit(5).toArray();
    console.log('\nSample rows:');
    rows.forEach((row, i) => {
      console.log(`\n--- Row ${i + 1} ---`);
      console.log('id:', row.id);
      console.log('chunkId:', row.chunkId);
      console.log('documentId:', row.documentId);
      console.log('knowledgeId:', row.knowledgeId);
      console.log('filename:', row.filename);
      console.log('text:', (row.text as string)?.substring(0, 150) + '...');
      console.log('vector length:', (row.vector as number[])?.length);
    });

    // 按 knowledgeId 分组统计
    const allRows = await table.query().toArray();
    const byKnowledgeId: Record<string, number> = {};
    const byDocumentId: Record<string, { count: number; filename: string }> = {};

    for (const row of allRows) {
      const kbId = row.knowledgeId as string;
      const docId = row.documentId as string;
      const filename = row.filename as string;

      byKnowledgeId[kbId] = (byKnowledgeId[kbId] || 0) + 1;
      if (!byDocumentId[docId]) {
        byDocumentId[docId] = { count: 0, filename };
      }
      byDocumentId[docId].count++;
    }

    console.log('\n=== By Knowledge Base ===');
    for (const [kbId, count] of Object.entries(byKnowledgeId)) {
      console.log(`  ${kbId}: ${count} chunks`);
    }

    console.log('\n=== By Document ===');
    for (const [docId, info] of Object.entries(byDocumentId)) {
      console.log(`  ${info.filename} (${docId}): ${info.count} chunks`);
    }
  }
}

main().catch(console.error);
