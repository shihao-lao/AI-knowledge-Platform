import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { api } = await load('lib/api-client.ts');
const structure = {
  basics: { name: '测试用户' },
  custom_sections: [{ id: 'custom-1', title: '开源贡献', content: '第一行\n第二行' }],
  layout: { sections: [{ key: 'custom-1', title: '开源贡献' }] },
};

let responseText = JSON.stringify({ data: { id: 'resume-1', structured: structure, content: '完整原文' } });
let timedOut = false;
globalThis.XMLHttpRequest = class {
  upload = {};
  status = 201;
  open() {}
  setRequestHeader() {}
  send() {
    this.responseText = responseText;
    queueMicrotask(() => (timedOut ? this.ontimeout() : this.onload()));
  }
};
const uploaded = await api.uploadResume(new Blob(['synthetic resume']));
assert.equal(uploaded.data.content, '完整原文');
assert.equal(uploaded.data.structured.customSections[0].content, '第一行\n第二行');
assert.equal(uploaded.data.structured.layout.sections[0].key, 'custom-1');

let savedBody;
globalThis.fetch = async (_url, options) => {
  savedBody = JSON.parse(options.body);
  return { ok: true, json: async () => ({ data: { id: 'resume-1', structured: structure } }) };
};
await api.updateResumeStructure('resume-1', uploaded.data.structured);
assert.equal(savedBody.structured.customSections[0].content, '第一行\n第二行');
assert.deepEqual(savedBody.structured.layout.sections, structure.layout.sections);

responseText = '<html>invalid response</html>';
await assert.rejects(api.uploadResume(new Blob(['file'])), /无效数据/);
timedOut = true;
await assert.rejects(api.uploadResume(new Blob(['file'])), /超时/);
console.log('Resume upload mapping, multiline save, malformed response and timeout checks passed');
