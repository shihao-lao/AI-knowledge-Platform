/**
 * Embedding 语义对比：local 哈希 vs BGE，检验语义检索能力
 * 运行: npx tsx scripts/compare-embedding.ts
 * 首次运行 BGE 会下载模型（约 30-100MB），请保持网络通畅。
 */
import { LocalHashEmbeddings } from '../lib/embedding/local-embedding';
import { BgeEmbeddings } from '../lib/embedding/bge';

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const PAIRS: Array<[string, string, string]> = [
  ['同义：事件循环 vs Event Loop', 'JS 的事件循环机制是怎样的', 'What is the Event Loop in JavaScript?'],
  ['同义：闭包 vs 作用域链', '解释一下闭包', '什么是作用域链'],
  ['同义：咖啡烘焙 vs 咖啡豆烘烤', '咖啡烘焙有哪些阶段', '咖啡豆烘烤的温度要求'],
  ['无关：闭包 vs 咖啡', '什么是闭包', '咖啡的种类'],
];

async function main() {
  const local = new LocalHashEmbeddings(512);
  const bge = new BgeEmbeddings();

  console.log('== local 哈希 embedding ==');
  for (const [name, q, d] of PAIRS) {
    const [qv, dv] = await Promise.all([local.embedQuery(q), local.embedQuery(d)]);
    console.log(`  ${name}: cos=${cosine(qv, dv).toFixed(4)}`);
  }

  console.log('\n== BGE（首次运行会下载模型）==');
  for (const [name, q, d] of PAIRS) {
    const [qv, dv] = await Promise.all([bge.embedQuery(q), bge.embedQuery(d)]);
    console.log(`  ${name}: cos=${cosine(qv, dv).toFixed(4)}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('对比失败:', err);
  process.exit(1);
});
