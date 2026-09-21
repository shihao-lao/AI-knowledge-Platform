import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { documentStatus, indexStatusText } = await load('lib/document-status.ts');
assert.equal(documentStatus('ready'), 'completed');
assert.equal(documentStatus('completed'), 'completed');
assert.equal(documentStatus('embedding'), 'embedding');
assert.equal(documentStatus('failed'), 'failed');
assert.match(indexStatusText('keyword_only'), /仅关键词/);
assert.match(indexStatusText('indexed'), /索引已完成/);
assert.match(indexStatusText(), /待确认/);

let status = 422;
let body = { detail: 'PDF 没有可提取的文本，扫描件请先进行 OCR 识别后上传' };
globalThis.XMLHttpRequest = class {
  upload = {};
  open() {}
  setRequestHeader() {}
  send() {
    this.status = status;
    this.responseText = JSON.stringify(body);
    queueMicrotask(() => this.onload());
  }
};
const { api } = await load('lib/api-client.ts');
await assert.rejects(api.uploadDocument('kb', new Blob(['file'])), /OCR/);
status = 201;
body = { data: { id: 'doc', status: 'completed', index_status: 'keyword_only', chunk_count: 1 } };
const uploaded = await api.uploadDocument('kb', new Blob(['file']));
assert.equal(documentStatus(uploaded.data.status), 'completed');
assert.equal(uploaded.data.indexStatus, 'keyword_only');
console.log('Upload status, fallback and parser error checks passed');
