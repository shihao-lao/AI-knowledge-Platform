# 后端迁移审查问题修复

本次修复针对认证、RAG、练习评估和占位 API。Next.js 继续负责前端，业务处理在 Python 中完成。

| 问题 | 修改方式 |
| --- | --- |
| JWT 使用公开默认密钥 | 读取服务端 `SECRET_KEY`；启动和签发/验证时拒绝缺失、过短或已知示例值。 |
| 登录回跳可指向外站 | 排除反斜杠、空白和控制字符，解析 URL 后校验同源；无效路径回到知识库列表。 |
| 错误密码被视为登录过期 | 登录和注册的 401 保留服务端错误；受保护请求的 401 才清除会话并跳转。 |
| 聊天不执行 RAG | 前端默认开启检索；Python 从当前用户知识库读取文档分块与题目，使用 BGE、Milvus、BM25 和 RRF。 |
| 练习可访问他人的题目 | 通过题目所属知识库的 `user_id` 查询，未授权时不调用模型、不写记录。 |
| 练习与统计字段缺失 | 返回 `record_id`、`key_points`、`reference_summary` 及分类、难度、最近记录等字段；前端客户端统一转换为 camelCase。 |
| 启停、统计和删除返回占位成功 | 文档启停写数据库；详情返回有序分块；引用统计读取已持久化消息；简历删除校验归属并删除文件和记录。 |
| 评分按关键词字符计分 | 先解析关键词 JSON，再调用 OpenAI 兼容模型；严格验证分数与结构，模型失败或结果无效时不保存评分。 |

## RAG 行为

- 向量集合按知识库 ID 与嵌入模型名称隔离。文档上传、题目导入、启停或删除后尝试同步索引。
- SQL 数据是检索权限与有效内容的依据。向量搜索限制有效 ID，结果再次过滤；禁用、删除和其他知识库的内容不能进入当前上下文。
- 索引使用 upsert，进程内按内容摘要跳过重复编码；重启后首次检索会重新同步已有数据，因此旧文档和题目也可进入索引。
- Milvus 或嵌入模型暂不可用时，使用当前知识库的真实关键词结果并记录降级日志，后续请求重试。中文检索支持字符与二元词切分。
- 引用中的文档 ID 和分块序号来自数据库元数据。题目内容可用于回答，但当前文档引用卡不会把题目伪装成文档链接。
- 重建较大知识库的首个请求可能较慢；此实现尚未提供独立后台索引队列。

## 本地配置

在 `background/.env` 中设置随机 `SECRET_KEY`，参考 `background/.env.example` 的生成命令。不要使用示例值。

聊天需要 `MIMO_API_KEY`、`MIMO_BASE_URL` 和 `MIMO_MODEL`。评分优先使用同一组 MiMo 配置，未配置 MiMo 时使用 `OPENAI_API_KEY`、`OPENAI_API_BASE` 和 `OPENAI_MODEL`。

语义检索需要运行 Milvus，并设置 `MILVUS_HOST`、`MILVUS_PORT`。默认嵌入模型为 `BAAI/bge-small-zh-v1.5`；首次使用需下载模型。向量不可用不会伪造语义检索结果。

## 验证

项目根目录：

```bash
node checks/auth-regression.mjs
npm run lint
npm run build
```

在 `background/` 中安装测试依赖后：

```bash
python -m pip install -e ".[dev]"
python -m pytest tests/test_auth_security.py tests/test_review_fixes.py tests/test_llm_evaluation.py -q
```

回归测试使用独立内存 SQLite；Milvus、嵌入模型及外部评分 API 使用测试替身，聊天测试实际经过 prompt、SSE 和消息落库。外部模型测试使用真实 OpenAI 客户端配合模拟 HTTP 响应，验证合法和异常输出。

这些检查不等于真实 Milvus 与生产模型的端到端验收，也不代表此前整次迁移的其他部署问题已经解决。
