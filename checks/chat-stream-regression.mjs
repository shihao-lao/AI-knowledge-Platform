import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync('lib/chat-api.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { sendChatMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const encoder = new TextEncoder();
const delta = 'data: {"type":"delta","content":"半段回答"}\n\n';

async function run(chunks, readError = false) {
  const events = [];
  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          if (chunks.length) controller.enqueue(chunks.shift());
          else if (readError) controller.error(new Error('connection reset'));
          else controller.close();
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  await sendChatMessage(
    { conversationId: 'conv', question: '问题' },
    {
      onDelta: (content) => events.push(['delta', content]),
      onCompleted: (content, citations) => events.push(['completed', content, citations]),
      onError: (error) => events.push(['error', error]),
    },
  );
  return { events, cancelled };
}

test('EOF without DONE retains deltas and reports interruption, never completion', async () => {
  const { events } = await run([encoder.encode(delta)]);
  assert.deepEqual(events[0], ['delta', '半段回答']);
  assert.equal(events.filter(([type]) => type === 'completed').length, 0);
  assert.equal(events.filter(([type]) => type === 'error').length, 1);
  assert.match(events.at(-1)[1], /回答中断/);
});

test('DONE handles every byte boundary, including UTF-8 and CRLF', async () => {
  const stream = encoder.encode(
    (delta + 'data: {"type":"citations","citations":[{"documentId":"doc"}]}\n\ndata:[DONE]\n\n').replaceAll(
      '\n',
      '\r\n',
    ),
  );
  for (let i = 1; i < stream.length; i++) {
    const { events } = await run([stream.slice(0, i), stream.slice(i)]);
    assert.deepEqual(events, [
      ['delta', '半段回答'],
      ['completed', '半段回答', [{ documentId: 'doc' }]],
    ]);
  }
});

test('server error preserves deltas and stops the stream', async () => {
  const { events } = await run([
    encoder.encode(delta + 'data: {"type":"error","message":"模型异常"}\n\ndata: [DONE]\n\n'),
  ]);
  assert.deepEqual(events, [
    ['delta', '半段回答'],
    ['error', '模型异常'],
  ]);
});

test('malformed JSON must not turn into a successful partial answer', async () => {
  const { events } = await run([encoder.encode(delta + 'data: {broken}\n\ndata: [DONE]\n\n')]);
  assert.equal(events.at(-1)[0], 'error');
  assert.equal(
    events.some(([type]) => type === 'completed'),
    false,
  );
});

test('unframed DONE is an interrupted event', async () => {
  const { events } = await run([encoder.encode(delta + 'data: [DONE]')]);
  assert.equal(events.at(-1)[0], 'error');
});

test('read failure after a delta reports interruption once', async () => {
  const { events } = await run([encoder.encode(delta)], true);
  assert.equal(events[0][1], '半段回答');
  assert.equal(events.at(-1)[0], 'error');
  assert.match(events.at(-1)[1], /回答中断/);
});

test('multi-line events and comments are valid SSE', async () => {
  const { events } = await run([
    encoder.encode(': heartbeat\n\ndata: {"type":"delta",\ndata: "content":"hello"}\n\ndata: [DONE]\n\n'),
  ]);
  assert.deepEqual(events, [
    ['delta', 'hello'],
    ['completed', 'hello', []],
  ]);
});

test('retry sends the original request ID so the server can reuse its messages', async () => {
  const requestId = 'b3d0c9e5-07d1-40d6-a73d-f50617c9f7dd';
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return new Response('data: [DONE]\n\n');
  };
  const callbacks = {
    onDelta() {},
    onCompleted() {},
    onError(error) {
      throw new Error(error);
    },
  };
  await sendChatMessage({ conversationId: 'conv', question: '问题', requestId }, callbacks);
  await sendChatMessage({ conversationId: 'conv', question: '问题', requestId }, callbacks);
  assert.deepEqual(
    bodies.map((body) => body.request_id),
    [requestId, requestId],
  );
});
