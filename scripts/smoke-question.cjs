/* Phase D 题库端到端验证：导入 → 列表/筛选 → 问答引用题目 → 删除 */
const BASE = 'http://localhost:3000';
const fs = require('node:fs');

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function login() {
  const res = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'local@local.dev', password: 'admin123' }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

(async () => {
  const cookie = await login();
  const auth = { Cookie: cookie };

  // 0. 前端知识库
  const kbs = await req('/api/knowledge', { headers: auth });
  const kb = kbs.json.data.find((k) => k.name.includes('前端'));
  console.log('KB:', kb ? kb.name : 'NOT FOUND');

  // 1. 导入样例题目
  const samples = JSON.parse(fs.readFileSync('scripts/sample-questions.json', 'utf-8'));
  const imp = await req('/api/question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ knowledgeId: kb.id, questions: samples }),
  });
  console.log('import:', imp.status, JSON.stringify(imp.json.data));

  // 2. 列表 + 筛选
  const list = await req(`/api/question?knowledgeId=${kb.id}`, { headers: auth });
  console.log('list count:', list.json.data.length, '| categories:', list.json.categories.join(','));
  const filtered = await req(`/api/question?knowledgeId=${kb.id}&difficulty=hard`, { headers: auth });
  console.log('difficulty=hard count:', filtered.json.data.length);
  const byCat = await req(`/api/question?knowledgeId=${kb.id}&category=React`, { headers: auth });
  console.log('category=React count:', byCat.json.data.length);

  // 3. 问答：问一道题 → 应命中题目卡并带引用
  const conv = await req('/api/conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ knowledgeId: kb.id, title: '题库验证' }),
  });
  const convId = conv.json.data.id;
  const chat = await req('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ conversationId: convId, question: '解释一下闭包是什么' }),
  });
  const events = chat.text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5).trim()));
  const done = events.find((e) => e.type === 'done');
  console.log('chat done citations:', done ? done.citations.length : 'N/A');
  if (done) done.citations.forEach((c) => console.log(`  cit: ${c.documentTitle} (score ${c.confidenceScore})`));

  // 4. 删除第一题
  const first = list.json.data[0];
  const del = await req(`/api/question/${first.id}`, { method: 'DELETE', headers: auth });
  const afterDel = await req(`/api/question?knowledgeId=${kb.id}`, { headers: auth });
  console.log('delete:', del.status, '| count after:', afterDel.json.data.length, '(expect', list.json.data.length - 1, ')');
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
