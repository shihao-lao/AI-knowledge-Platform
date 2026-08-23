/* Phase B 端到端验证：登录 → 检索 → 建会话 → 聊天(SSE) → 引用 → 落库 */
const BASE = 'http://localhost:3000';

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE or empty */ }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') };
}

async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, json: await res.json() };
}

(async () => {
  // 1. 登录
  const login = await post('/api/auth/login', { email: 'local@local.dev', password: 'admin123' });
  if (login.status !== 200) { console.log('LOGIN FAILED', login.status); process.exit(1); }
  const cookie = login.setCookie.split(';')[0];
  console.log('login ok, cookie len:', cookie.length);

  // 2. 找包含"咖啡"的知识库并检索
  const kbs = await get('/api/knowledge', cookie);
  const coffeeKb = kbs.json.data.find((k) => k.name.includes('咖啡'));
  if (!coffeeKb) { console.log('coffee KB not found; KBs:', kbs.json.data.map((k) => k.name).join(' | ')); process.exit(1); }
  console.log('coffee KB:', coffeeKb.id, coffeeKb.name);

  const search = await post('/api/knowledge/search', { query: '咖啡', knowledgeId: coffeeKb.id, topK: 5 }, cookie);
  console.log('search chunks:', search.json.chunks.length, search.json.chunks.map((c) => `score=${c.score}`).join(', '));

  // 3. 建会话并发消息
  const conv = await post('/api/conversation', { knowledgeId: coffeeKb.id, title: 'e2e-cit' }, cookie);
  const convId = conv.json.data.id;
  console.log('conversation:', convId);

  const chat = await post('/api/chat', { conversationId: convId, question: '咖啡' }, cookie);
  console.log('chat status:', chat.status);
  const events = chat.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5).trim()));
  console.log('SSE events:', events.length, 'types:', [...new Set(events.map((e) => e.type))].join(','));
  const answer = events.filter((e) => e.type === 'answer').map((e) => e.content).join('');
  const done = events.find((e) => e.type === 'done');
  console.log('answer chars:', answer.length);
  console.log('done citations:', done ? done.citations.length : 'N/A');
  if (done) done.citations.forEach((c, i) => console.log(`  cit[${i + 1}] doc=${c.documentTitle} chunk=${c.chunkIndex} score=${c.confidenceScore}`));

  // 4. 落库校验
  const msgs = await get(`/api/conversation/${convId}/message`, cookie);
  const asst = msgs.json.data.find((m) => m.role === 'assistant');
  console.log('persisted messages:', msgs.json.data.length, '| assistant citations:', asst ? asst.citations.length : 'N/A');
  console.log('answer contains [1]:', answer.includes('[1]'));
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
