import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { processDocumentForRAG } from '../lib/chunker';
import { performRAGRetrieval } from '../lib/rag';

async function testRAGFlow() {
  console.log('🧪 开始测试 RAG 流程...\n');

  try {
    const knowledgeBases = await prisma.knowledgeBase.findMany();
    if (knowledgeBases.length === 0) {
      console.log('❌ 没有找到知识库，请先运行种子数据脚本');
      return;
    }

    const kb = knowledgeBases[0];
    console.log(`📚 使用知识库: ${kb.name} (${kb.id})\n`);

    const documents = await prisma.document.findMany({
      where: { knowledgeBaseId: kb.id },
    });

    console.log(`📄 找到 ${documents.length} 个文档:`);
    documents.forEach((doc) => {
      console.log(`   - ${doc.title} (状态: ${doc.status})`);
    });
    console.log('');

    let chunksCount = await prisma.documentChunk.count({
      where: { knowledgeBaseId: kb.id },
    });

    if (chunksCount === 0) {
      console.log('🔧 正在处理文档并生成向量切片...');
      for (const doc of documents) {
        try {
          const chunks = await processDocumentForRAG(doc.id);
          console.log(`   ✅ ${doc.title}: ${chunks} 个切片`);
        } catch (error) {
          console.error(`   ❌ 处理 ${doc.title} 失败:`, error);
        }
      }

      chunksCount = await prisma.documentChunk.count({
        where: { knowledgeBaseId: kb.id },
      });
      console.log(`\n✅ 总共生成了 ${chunksCount} 个向量切片\n`);
    } else {
      console.log(`✅ 已有 ${chunksCount} 个向量切片\n`);
    }

    const testQueries = [
      'Vite 为什么启动快？',
      '什么是 RAG 检索增强生成？',
      '如何上传文档到知识库？',
      'React 和 Vue 有什么区别？',
    ];

    console.log('🔍 开始测试 RAG 检索:\n');
    for (const query of testQueries) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`❓ 问题: ${query}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const result = await performRAGRetrieval(query, kb.id);

      if (result.retrievedChunks.length === 0) {
        console.log('⚠️  未找到相关文档片段');
      } else {
        console.log(`\n📊 检索到 ${result.retrievedChunks.length} 个相关片段:\n`);

        result.retrievedChunks.forEach((chunk, index) => {
          console.log(`   [片段 ${index + 1}] 相似度: ${(chunk.similarity * 100).toFixed(1)}%`);
          console.log(`   来源: ${chunk.documentTitle}`);
          console.log(`   预览: ${chunk.preview}\n`);
        });

        console.log('📝 生成的引用:');
        result.citations.forEach((citation, index) => {
          console.log(
            `   ${index + 1}. ${citation.documentTitle} (置信度: ${
              (citation.confidenceScore * 100).toFixed(0)
            }%)`
          );
        });
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ RAG 流程测试完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ RAG 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRAGFlow();
