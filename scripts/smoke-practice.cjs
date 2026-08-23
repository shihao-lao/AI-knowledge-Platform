/* Phase E 验证：模拟面试模式 + 答题评估 + 掌握度统计 */
const BASE = 'http://localhost:3000';

async function login() {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'local@local.dev', password: 'admin123' }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

(async () => {
  const cookie = await login();
  const auth = { Cookie: cookie };
  const kbs = await (await fetch(BASE + '/api/knowledge', { headers: auth })).json();
  const kb = kbs.data.find((k) => k.name.includes('前端'));

  // 1. 模拟面试模式
  const conv = await (await fetch(BASE + '/api/conversation', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ knowledgeId: kb.id, title: '模拟面试' }),
  })).json();
  const chat = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ conversationId: conv.data.id, question: '开始面试', mode: 'interview' }),
  });
  const events = (await chat.text()).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5).trim()));
  const answer = events.filter((e) => e.type === 'answer').map((e) => e.content).join('');
  const done = events.find((e) => e.type === 'done');
  console.log('interview chat:', chat.status, '| answer chars:', answer.length, '| citations:', done ? done.citations.length : 'N/A');
  console.log('interview answer sample:', answer.slice(0, 70));

  // 2. 答题评估
  const qs = await (await fetch(BASE + '/api/question?knowledgeId=' + kb.id, { headers: auth })).json();
  const q = qs.data[0];
  const ev = await fetch(BASE + '/api/practice/evaluate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ questionId: q.id, userAnswer: '我的回答：先讲原理，再举例说明……' }),
  });
  const evData = await ev.json();
  console.log('evaluate:', ev.status, '| score:', evData.data.score, '| feedback len:', evData.data.feedback.length, '| keyPoints:', evData.data.keyPoints.length);

  // 3. 掌握度统计
  const stats = await (await fetch(BASE + '/api/practice/stats?knowledgeId=' + kb.id, { headers: auth })).json();
  console.log('stats:', JSON.stringify({ total: stats.data.total, avg: stats.data.averageScore, byCategory: stats.data.byCategory, byDifficulty: stats.data.byDifficulty }));

  // 4. 无题目知识库的面试模式应正常（咖啡库有文档无题目？先看咖啡库题目数）
  const coffeeKb = kbs.data.find((k) => k.name.includes('咖啡'));
  const coffeeQs = await (await fetch(BASE + '/api/question?knowledgeId=' + coffeeKb.id, { headers: auth })).json();
  console.log('coffee kb questions:', coffeeQs.data.length);
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
