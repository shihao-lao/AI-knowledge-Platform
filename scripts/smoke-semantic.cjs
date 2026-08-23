/* 语义检索验证：用改写后的问法验证 BGE 语义召回（对比哈希方案搜不到的场景） */
const BASE = 'http://localhost:3000';

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, json: await res.json() };
}

(async () => {
  const login = await post('/api/auth/login', { email: 'local@local.dev', password: 'admin123' });
  const cookie = login.json.data ? login.setCookie || '' : '';
  // 手动取 cookie
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'local@local.dev', password: 'admin123' }),
  });
  const authCookie = loginRes.headers.get('set-cookie').split(';')[0];

  const kbs = await get('/api/knowledge', authCookie);
  const coffeeKb = kbs.json.data.find((k) => k.name.includes('咖啡'));

  const queries = [
    '咖啡怎么分辨好坏',     // 改写：文档标题是"咖啡好坏的区分"
    '什么样的咖啡算高端',   // 改写："咖啡如何区分高端与低端"
    '烘焙有哪些讲究',       // 改写：内容里的"烘焙"话题
    '咖啡怎么冲泡',         // 无直接匹配
  ];
  for (const q of queries) {
    const res = await post('/api/knowledge/search', { query: q, knowledgeId: coffeeKb.id, topK: 3 }, authCookie);
    const chunks = res.json.chunks || [];
    console.log(`query="${q}" -> ${chunks.length} chunks`);
    chunks.slice(0, 3).forEach((c) => console.log(`   score=${c.score} src=${c.source}`));
  }
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
