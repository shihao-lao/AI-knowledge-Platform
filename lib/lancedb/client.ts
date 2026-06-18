import { connect } from '@lancedb/lancedb';
import type { Connection } from '@lancedb/lancedb';
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

export async function ensureTable() {
  const db = await getLanceDB();
  const tableNames = await db.tableNames();
  if (!tableNames.includes(VECTOR_TABLE_NAME)) {
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
