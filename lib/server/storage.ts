import fs from 'node:fs';
import path from 'node:path';
import type { Conversation, Message } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'server');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_DIR)) fs.mkdirSync(MESSAGES_DIR, { recursive: true });
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

export function getConversations(kbId?: string, limit?: number, offset?: number): { items: Conversation[]; total: number } {
  const all = readJSON<Conversation[]>(CONVERSATIONS_FILE, []);
  const sorted = all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const filtered = kbId ? sorted.filter((c) => c.knowledgeBaseId === kbId) : sorted;
  const start = offset ?? 0;
  const end = limit ? start + limit : filtered.length;
  return { items: filtered.slice(start, end), total: filtered.length };
}

export function deleteConversation(id: string): boolean {
  const all = readJSON<Conversation[]>(CONVERSATIONS_FILE, []);
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;
  writeJSON(CONVERSATIONS_FILE, filtered);
  // Remove messages file
  const msgPath = path.join(MESSAGES_DIR, `${id}.json`);
  if (fs.existsSync(msgPath)) fs.unlinkSync(msgPath);
  return true;
}

export function getConversation(id: string): Conversation | undefined {
  return getConversations().items.find((c) => c.id === id);
}

export function createConversation(knowledgeBaseId: string, title?: string): { conversation: Conversation; messages: Message[] } {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    knowledgeBaseId,
    title: title ?? '新对话',
    messageCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  const all = readJSON<Conversation[]>(CONVERSATIONS_FILE, []);
  all.unshift(conversation);
  writeJSON(CONVERSATIONS_FILE, all);

  const welcome: Message = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '你好，我已准备好回答你的问题。开始输入吧，我会尽量给出详细的回答。',
    citations: [],
    createdAt: now,
  };
  writeJSON(path.join(MESSAGES_DIR, `${conversation.id}.json`), [welcome]);

  return { conversation, messages: [welcome] };
}

export function getMessages(conversationId: string): Message[] {
  return readJSON<Message[]>(path.join(MESSAGES_DIR, `${conversationId}.json`), []);
}

export function appendMessages(conversationId: string, messages: Message[]) {
  const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
  const existing = readJSON<Message[]>(filePath, []);
  existing.push(...messages);
  writeJSON(filePath, existing);

  // update conversation meta
  const all = readJSON<Conversation[]>(CONVERSATIONS_FILE, []);
  const idx = all.findIndex((c) => c.id === conversationId);
  if (idx !== -1) {
    all[idx].messageCount = existing.length;
    all[idx].updatedAt = new Date().toISOString();
    if (all[idx].title === '新对话') {
      const firstUser = messages.find((m) => m.role === 'user');
      if (firstUser) {
        all[idx].title = firstUser.content.length > 24 ? `${firstUser.content.slice(0, 24)}…` : firstUser.content;
      }
    }
    writeJSON(CONVERSATIONS_FILE, all);
  }
}
