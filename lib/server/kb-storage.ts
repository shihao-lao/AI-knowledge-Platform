import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeBase, KnowledgeDocument } from '@/types';
import { titleToSlug } from '@/lib/slug';

const DATA_DIR = path.join(process.cwd(), 'data', 'server');
const KB_FILE = path.join(DATA_DIR, 'knowledge-bases.json');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function writeJSON<T>(filePath: string, data: T) {
  ensureDirs();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Knowledge Bases

export function getKnowledgeBases(): KnowledgeBase[] {
  const all = readJSON<KnowledgeBase[]>(KB_FILE, []);
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getKnowledgeBase(id: string): KnowledgeBase | undefined {
  return getKnowledgeBases().find((kb) => kb.id === id);
}

export function createKnowledgeBase(data: Omit<KnowledgeBase, 'id' | 'createdAt' | 'updatedAt' | 'stats'> & { stats?: KnowledgeBase['stats'] }): KnowledgeBase {
  const now = new Date().toISOString();
  const kb: KnowledgeBase = {
    ...data,
    id: titleToSlug(data.name),
    stats: data.stats ?? { documentCount: 0, conversationCount: 0, memberCount: 1, lastActiveAt: now },
    createdAt: now,
    updatedAt: now,
  };
  const all = readJSON<KnowledgeBase[]>(KB_FILE, []);
  all.unshift(kb);
  writeJSON(KB_FILE, all);
  return kb;
}

export function updateKnowledgeBase(id: string, patch: Partial<KnowledgeBase>): KnowledgeBase | undefined {
  const all = readJSON<KnowledgeBase[]>(KB_FILE, []);
  const idx = all.findIndex((kb) => kb.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJSON(KB_FILE, all);
  return all[idx];
}

export function deleteKnowledgeBase(id: string): boolean {
  const all = readJSON<KnowledgeBase[]>(KB_FILE, []);
  const filtered = all.filter((kb) => kb.id !== id);
  if (filtered.length === all.length) return false;
  writeJSON(KB_FILE, filtered);
  // Also remove docs
  const docs = readJSON<KnowledgeDocument[]>(DOCS_FILE, []);
  writeJSON(DOCS_FILE, docs.filter((d) => d.knowledgeBaseId !== id));
  return true;
}

// Documents

export function getDocuments(kbId?: string): KnowledgeDocument[] {
  const all = readJSON<KnowledgeDocument[]>(DOCS_FILE, []);
  const sorted = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return kbId ? sorted.filter((d) => d.knowledgeBaseId === kbId) : sorted;
}

export function getDocument(id: string): KnowledgeDocument | undefined {
  return getDocuments().find((d) => d.id === id);
}

export function createDocument(doc: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>): KnowledgeDocument {
  const now = new Date().toISOString();
  const newDoc: KnowledgeDocument = {
    ...doc,
    id: `doc_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const all = readJSON<KnowledgeDocument[]>(DOCS_FILE, []);
  all.unshift(newDoc);
  writeJSON(DOCS_FILE, all);
  // Update KB stats
  recalcKbStats(doc.knowledgeBaseId);
  return newDoc;
}

export function updateDocument(id: string, patch: Partial<KnowledgeDocument>): KnowledgeDocument | undefined {
  const all = readJSON<KnowledgeDocument[]>(DOCS_FILE, []);
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJSON(DOCS_FILE, all);
  return all[idx];
}

export function deleteDocument(id: string): boolean {
  const all = readJSON<KnowledgeDocument[]>(DOCS_FILE, []);
  const doc = all.find((d) => d.id === id);
  if (!doc) return false;
  const filtered = all.filter((d) => d.id !== id);
  writeJSON(DOCS_FILE, filtered);
  recalcKbStats(doc.knowledgeBaseId);
  return true;
}

function recalcKbStats(kbId: string) {
  const docs = getDocuments(kbId);
  updateKnowledgeBase(kbId, {
    stats: {
      documentCount: docs.length,
      conversationCount: 0,
      memberCount: 1,
      lastActiveAt: new Date().toISOString(),
    },
  });
}
