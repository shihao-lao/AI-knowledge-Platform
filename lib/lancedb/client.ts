import { connect } from '@lancedb/lancedb';
import { LanceDB } from '@langchain/community/vectorstores/lancedb';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Connection, Table } from '@lancedb/lancedb';
import path from 'path';
import { VECTOR_TABLE_NAME, getVectorDimension } from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'lancedb');

let dbInstance: Connection | null = null;

export async function getLanceDB(): Promise<Connection> {
  if (!dbInstance) {
    const fs = await import('fs/promises');
    await fs.mkdir(DB_PATH, { recursive: true });
    dbInstance = await connect(DB_PATH);
  }
  return dbInstance;
}

export async function ensureTable(_embeddings?: unknown) {
  const db = await getLanceDB();
  const tableNames = await db.tableNames();
  if (!tableNames.includes(VECTOR_TABLE_NAME)) {
    // LangChain LanceDB wrapper spreads metadata as top-level columns.
    // Schema: vector, text, id, chunkId, documentId, filename, knowledgeId
    await db.createTable(VECTOR_TABLE_NAME, [
      {
        vector: Array(getVectorDimension()).fill(0) as number[],
        text: '_init_',
        id: '_init_',
        chunkId: '',
        documentId: '',
        filename: '',
        knowledgeId: '',
      },
    ]);
    const table = await db.openTable(VECTOR_TABLE_NAME);
    await table.delete('id = "_init_"');
  }
  return db;
}

export async function getVectorStore(embeddings: Embeddings): Promise<LanceDB> {
  const db = await getLanceDB();
  await ensureTable(embeddings);

  return new LanceDB(embeddings, {
    table: (await db.openTable(VECTOR_TABLE_NAME)) as unknown as Table,
    textKey: 'text',
  });
}
