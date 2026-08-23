/* Phase B 历史窗口 + 摘要机制验证 */
const BASE = 'http://localhost:3000';

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE */ }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') };
}

async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, json: await res.json() };
}

(async () => {
  const login = await post('/api/auth/login', { email: 'local@local.dev', password: 'admin123' });
  const cookie = login.setCookie.split(';')[0];
  const kbs = await get('/api/knowledge', cookie);
  const coffeeKb = kbs.json.data.find((k) => k.name.includes('咖啡'));
  const conv = await post('/api/conversation', { knowledgeId: coffeeKb.id, title: 'history-test' }, cookie);
  const convId = conv.json.data.id;

  // 连发 14 条消息（共 28 条记录；窗口=12，超过后触发摘要）
  for (let i = 1; i <= 14; i++) {
    const chat = await post('/api/chat', { conversationId: convId, question: `问题${i}` }, cookie);
    if (chat.status !== 200) { console.log(`msg ${i} FAILED: ${chat.status}`); process.exit(1); }
  }
  console.log('14 messages sent');

  const conv2 = await get(`/api/conversation/${convId}`, cookie);
  console.log('messageCount:', conv2.json.data.messageCount, '(expect 28)');
  console.log('summary populated:', conv2.json.data.summary ? 'YES' : 'NO');
  if (conv2.json.data.summary) {
    console.log('summary sample:', conv2.json.data.summary.slice(0, 60));
  }

  // 摘要缓存后再次发消息，确认 summary 未重复变化（仍是同一条）
  await post('/api/chat', { conversationId: convId, question: '问题15' }, cookie);
  const conv3 = await get(`/api/conversation/${convId}`, cookie);
  console.log('summary stable after another msg:', conv3.json.data.summary === conv2.json.data.summary ? 'YES' : 'NO');
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
