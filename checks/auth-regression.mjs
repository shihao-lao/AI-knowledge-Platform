import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { getLoginRedirect } = await load('lib/routes.ts');
for (const path of ['//evil.test', '/\\evil.test', '/\n/evil.test', 'https://evil.test']) {
  assert.equal(getLoginRedirect(path), '/knowledge-bases', path);
}
assert.equal(getLoginRedirect('/questions/kb?x=1'), '/questions/kb?x=1');
globalThis.window = { location: { pathname: '/login', search: '?from=%2Fquestions', href: '/login' } };
globalThis.localStorage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
globalThis.fetch = async () => new Response(JSON.stringify({ detail: '密码错误' }), { status: 401 });
const { api } = await load('lib/api-client.ts');
await assert.rejects(api.login('test@example.com', 'wrong'), /密码错误/);
assert.equal(window.location.href, '/login');
window.location.pathname = '/questions';
await assert.rejects(api.listKnowledge(), /登录已过期/);
assert.match(window.location.href, /^\/login\?from=/);
console.log('Auth redirect and 401 regression checks passed');
