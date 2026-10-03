# main 分支业务逻辑审查

- 日期：2026-10-03。
- 源码基线：`e5ad5cf98028efcf5f5c921277219df2e2e334dc`（修复分支已合并到 main）。
- 方法：采用 [ASu-skills 的 project-guide 源码事实核验流程](https://github.com/Hisn00w/ASu-skills/blob/main/skills/project-guide/SKILL.md)，沿用户操作、接口、服务、数据结果检查，记录真实调用、失败恢复和清理路径。按本次请求交付业务审查，不生成求职课程或面经。
- 覆盖：认证与资源归属、模型配置、资料上传和删除、检索与引用、普通聊天、题目导入与练习、模拟面试、统计、简历解析与编辑导出、摘要和 Skill 生成。
- 验证：源码检查及 5 项内存数据库/模拟依赖验证；未访问生产数据库、未发送真实模型请求、未做部署压测。性能和线上代理行为仍需实测。
- P1：优先处理的数据边界、隐私、可用性问题；P2：随后处理的数据正确性、可靠性和展示问题。优先级是本次审查建议，并非生产事故结论。

## 一、已经合理的设计

1. **身份与资源归属在后端控制。** 新增消息通过对话、知识库、用户验证；客户端只能提交用户角色，欢迎语由后端生成，历史 system 消息不会被普通聊天当作系统指令。这条修复已合并，不再计为遗留缺陷。
2. **密钥与目标地址绑定。** 更换模型服务地址不能继承旧地址密钥；测试自定义地址须提供自己的密钥。此前“只改地址就带走服务端密钥”的问题已修复。
3. **模拟面试已经有持久化流程。** 保存题目快照、当前题、逐题评价、总结并写入 PracticeRecord；评分使用短事务、占位令牌和过期恢复；软删题目保留在途面试和历史成绩。源码：[面试服务](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/interview_service.py:74)。
4. **检索以 SQL 为有效资料来源并支持降级。** 文档禁用、题目软删会在返回上下文前过滤；向量或精排不可用时可继续关键词/RRF 检索。源码：[资料集合与召回](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/retrieval_service.py:77)。降级能保持服务可用，但分数含义仍需改进，见 F10。

## 二、遗留问题和修复建议

| 编号 | 优先级       | 问题                                                 | 判断依据                       |
| ---- | ------------ | ---------------------------------------------------- | ------------------------------ |
| F01  | P1           | 简历重新解析绕过用户模型配置                         | 模拟调用确认                   |
| F02  | P1           | 文档上传缺少应用层大小上限，解析阻塞事件循环         | 调用链确认，影响规模待测       |
| F03  | P1           | 删除知识库后上传文件和向量集合未完整清理             | 删除链路确认                   |
| F04  | P1，部署相关 | 限流信任客户端可提供的代理头                         | 组件验证确认，线上入口条件待查 |
| F05  | P2           | 普通聊天失败和重试缺少回合状态与幂等                 | 持久化与重试链路确认           |
| F06  | P2           | 单题评分等待模型期间占用数据库连接，重试可能重复记分 | 服务事务链路确认               |
| F07  | P2           | 同一批 JSON 内的重复题目被重复导入                   | 实际服务调用确认               |
| F08  | P2           | 快速切换对话可能显示旧请求返回的聊天历史             | 前端异步状态链路确认           |
| F09  | P2           | 引用编号错位，题目引用缺失，全文跳转不定位           | 后端验证与前端链路确认         |
| F10  | P2           | 检索分数被展示为答案置信度                           | 分数计算与展示语义不一致       |
| F11  | P2           | “引用消息数”和“相关对话数”的计数范围错误             | 模拟统计调用确认               |
| F12  | P2           | 长文摘要和 Skill 只使用前 3000 字且未告知范围        | 请求构造确认                   |
| F13  | P2           | 简历编辑后评分报告缺少版本关联                       | 数据更新与页面展示确认         |

### F01：简历重新解析没有传当前用户

- **触发：** 用户配置自己的模型，点击简历重新解析。
- **事实：** 上传时传入 user_id，重新解析却调用 `parse_resume_structure(content)`；该函数用默认的 user_id=None 解析模型配置。
- **影响：** 有服务端模型时，会使用服务端供应商；没有服务端模型时，可能退回规则解析。用户选择的模型无法生效；服务端与用户供应商不同还会改变简历文本发送的目标。
- **位置：** [重新解析调用](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/resume_service.py:262)、[解析器配置选择](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/infrastructure/llm/resume_structure.py:409)。
- **建议：** 补传 user_id，检查所有模型调用的身份传递，并记录实际模型来源。
- **验收：** 用户配置 A、服务端配置 B，上传和重新解析均使用 A；无用户配置时按明确的兜底规则使用 B。
- **验证结果：** 模拟解析器实际收到的参数仅为正文，未收到当前用户 ID。

### F02：文档上传资源边界和处理状态不完整

- **触发：** 上传大文件、复杂 PDF/DOCX，或多用户并发上传。
- **事实：** 接口一次性 `await file.read()`，服务无文档大小上限；异步 ETL 中直接同步解析、分块。上传请求等待整个解析及索引流程完成，数据库会话在校验知识库后跨解析阶段保持打开。
- **影响：** 大文件增加内存压力，同步解析占用事件循环；请求断开后的处理状态不容易追踪。具体延迟与承载能力尚未测量。简历上传也先完整读取，再在服务层检查大小。
- **位置：** [文档读取](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/api/routes/document.py:47)、[同步 ETL](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/etl/pipeline.py:46)、[上传处理](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/document_service.py:25)。
- **建议：** 分块读取并累计限制大小，限制页数/解压规模/提取文字量；将解析移出事件循环。进一步将上传、解析、索引建成后台任务，返回任务 ID，展示阶段、失败原因和重试入口。
- **验收：** 超限文件返回 413；解析任务可查询、可恢复；上传期间轻量请求可正常处理。上线前测量内存峰值、解析耗时和并发连接占用。

### F03：删除知识库未完成数据清理

- **触发：** 删除有上传资料的知识库；或单独删除文档时磁盘 unlink 失败。
- **事实：** 知识库删除只删 ORM 对象并提交，级联删除数据库文档/分块不会调用文档服务的文件删除逻辑；也没有清理该知识库向量集合的步骤。单文档删除捕获文件删除异常后仍删除数据库记录并返回成功。
- **影响：** 页面显示已删除，但本地原文件、向量数据可能残留；数据库记录消失后缺少自动清理和重试入口。当前检索的归属校验、SQL 有效 ID 过滤仍有效，不能据此断言会跨用户泄露资料。
- **位置：** [知识库删除](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/knowledge_service.py:140)、[单文档清理](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/document_service.py:232)、[知识库文档级联关系](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/infrastructure/database/models.py:120)、[向量集合命名](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/retrieval_service.py:52)。
- **建议：** 删除前记录文件与向量清理任务，提交后由可重试任务执行；提供“删除中/已清理/清理失败”状态。清理须覆盖旧 embedding 模型对应的集合，并清理进程缓存。
- **验收：** 删除知识库后数据库、磁盘、相关向量集合均有可验证清理结果；故障注入后任务能重试完成。

### F04：限流可被代理头重置

- **触发：** 客户端能让自定义 X-Forwarded-For 到达应用。
- **事实：** 中间件无条件使用请求头第一个 IP；同一 TCP 客户端改头即可进入新计数桶。记录仅在相同 IP 再次访问时清理，桶键不会被统一回收；多个进程的内存计数也互不共享。
- **影响：** 限流不能可靠约束恶意请求，模型接口的费用及资源保护不足。若部署代理强制覆盖此头，则外部利用条件会减弱，需要核实入口配置。
- **位置：** [客户端 IP 解析](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/middleware/rate_limit.py:30)、[全局限流注册](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/main.py:63)。
- **建议：** 只信任明确配置的代理来源；结合用户 ID 与真实 IP 分别限流，模型操作加用户并发和额度限制；多实例使用共享计数存储，设置桶过期。登录与面试轮询应有独立预算。
- **验收：** 同一个外部客户端换头不能重置额度；验证代理转发和多进程场景；昂贵模型调用受用户额度保护。
- **验证结果：** 每分钟上限设为 1，记录一次后相同头被拒；同一客户端换头后仍获准。

### F05：普通聊天失败重试会产生重复、不完整历史

- **触发：** 未配置模型、生成失败、流中断，或助手已落库但完成事件丢失后重试。
- **事实：** 在解析模型配置和生成前先保存 user 消息；助手只在完整生成后保存。请求没有回合 ID、幂等键或失败状态。前端重试明确再次发送新问题；消息计数采用读取后加一，多个客户端并发时可能覆盖计数。
- **影响：** 用户问题可能重复写入，失败问题会进入后续模型历史；部分回答刷新后消失，可能重复调用模型。两个客户端同时发问时，历史与回答顺序缺少业务保证。
- **位置：** [聊天保存顺序](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/chat_service.py:136)、[消息计数](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/chat_service.py:266)、[前端重试](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/page.tsx:196)。
- **建议：** 持久化 ChatTurn，保存 request_id、稳定顺序及 generating/completed/failed/interrupted 状态；相同请求重试恢复旧回合；定义同一对话并发策略，并用原子更新维护计数。
- **验收：** 同一请求重复提交只生成一个回合；失败历史有状态，完成确认丢失后能取回已有答案；并发不会丢计数。

### F06：单题评分仍缺少面试已有的可靠性机制

- **触发：** 模型响应慢或接口超时后重试单题练习。
- **事实：** 单题评分在数据库会话内读取题目、等待远程模型、保存成绩并提交。远程调用期间前面的查询事务及连接未结束；每次请求都新建 PracticeRecord，无提交 ID。
- **影响：** 并发慢请求占用连接池；结果已提交但响应丢失后重试可能新增同一作答的成绩，影响练习次数及平均分。这里没有显式 FOR UPDATE，不能等同于此前面试的行锁问题。
- **位置：** [单题评分](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/practice_service.py:15)。
- **建议：** 用短事务保存作答快照及幂等提交 ID，关闭会话后评分，再用短事务写结果；复用面试占位、失败释放和过期恢复机制。
- **验收：** 远程评分期间不占数据库连接；相同提交只保存一条记录；失败可重试而不重复计分。

### F07：同一批导入内部去重失效

- **触发：** JSON 数组包含两条完全相同的问题。
- **事实：** 每题只查数据库已有记录，随后 session.add，循环结束才提交；会话 autoflush=False，因此下一次查询看不到上一题待写入对象。题目表也没有对应唯一约束。
- **影响：** 同一批重复题目保存两条；新面试和练习选题被重复数据污染。已有重复数据还可能使后续 scalar_one_or_none 查询报多行错误。
- **位置：** [导入查重与写入](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/question_service.py:122)、[会话 autoflush 配置](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/infrastructure/database/session.py:77)。
- **建议：** 请求内维护规范化问题哈希集合；数据库加适配软删除策略的唯一约束，覆盖并发导入；清理既有重复时保留已有关联的面试和练习成绩。
- **验收：** 同批两条重复题返回 imported=1、skipped=1；并发相同导入仍不产生重复。
- **验证结果：** 调用实际导入服务，内存 SQLite 会话使用相同 autoflush=False 配置，结果 imported=2、skipped=0，落库 2 条。未连接业务数据库。

### F08：切换对话存在异步请求竞态

- **触发：** A 的历史请求较慢，用户切换到 B，B 请求先完成，随后 A 请求返回。
- **事实：** fetchMessages(conversationId) 返回后直接 setMessages，没有取消、请求序号或当前对话 ID 校验；切换时也未立即清空并隔离旧请求。
- **影响：** 地址和标题是 B，正文却显示 A 的消息；发送期间的旧会话列表刷新也缺少资源范围检查。流回调用助手消息 ID 匹配，因此不能直接断言它会把 A 的增量追加到 B。
- **位置：** [消息加载与状态写入](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/page.tsx:83)、[切换触发加载](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/page.tsx:119)。
- **建议：** 使用 AbortController 和请求代次，回写前验证知识库/对话 ID；消息状态按对话保存，明确切换时流请求继续后台运行或取消的策略。
- **验收：** 人为延迟 A、快速切换 B，A 后返回不覆盖 B；删除对话或切换知识库后旧响应不修改当前视图。

### F09：引用无法准确对应和溯源

- **触发：** 模型只引用 [3]，或上下文中同时包含题目和文档。
- **事实：** 后端保留原引用 index；卡片按过滤后的数组下标显示 index+1；题目类型直接跳过。查看全文回调只跳知识库首页，没有利用 documentId/chunkIndex。
- **影响：** 正文 [3] 与卡片 [1] 不对应；题目来源没有引用卡片；用户无法直接定位验证段落。
- **位置：** [后端引用提取](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/chat_service.py:224)、[卡片编号](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/components/ChatMessageList.tsx:61)、[全文导航](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/page.tsx:252)。
- **建议：** 统一 Citation 契约，包含原 referenceIndex、sourceType、sourceId、chunkId/题目 ID；全文导航打开对应资料并定位原片段，删除来源时保留历史快照并说明不可打开。
- **验收：** 只引用 [3] 时卡片也为 [3]；混合来源有准确卡片；点击卡片能定位实际来源。
- **验证结果：** 后端提取 [3] 返回 index=3；当前卡片第一个元素的显示公式得到 1。

### F10：“置信度”不是答案正确概率

- **事实：** citation.confidenceScore 来自检索结果 score；关键词单路首位的 RRF 换算可得 1.0，只有一个候选时不再精排。前端将其标为置信度并展示百分数。精排分值变换也没有在本项目中完成答案正确性的概率校准。
- **影响：** 一段资料仅仅排第一，就可能显示 100% 高置信；用户容易把检索排序当成答案可靠性。
- **位置：** [RRF 分数换算](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/retrieval_service.py:168)、[单候选跳过精排](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/retrieval_service.py:194)、[置信度展示](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/chat/[kbId]/[conversationId]/components/ChatMessageList.tsx:51)。
- **建议：** 先改为“检索相关度”，说明分数来源和降级状态；答案可信性单独用证据覆盖、引用验证等指标表达，有标注评测集后才讨论概率校准。
- **验收：** 排名第一不自动被描述为正确率 100%；关键词、融合和精排的指标含义有明确区分。

### F11：引用统计的名称与范围不一致

- **触发：** 创建一个新对话，只有无引用欢迎语。
- **事实：** 服务统计所有 assistant 消息和所有对话，而页面称“引用消息数”“相关对话数”。
- **影响：** 没有任何引用也显示 1 条引用消息；统计无法说明资料实际被使用的范围。
- **位置：** [统计范围](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/citation_service.py:21)、[返回汇总](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/citation_service.py:61)、[统计标签](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/statistics/[kbId]/page.tsx:135)。
- **建议：** 分别定义引用次数、包含有效引用的消息数、包含引用的去重对话数；如需保留全量助手消息与对话，单列并按真实含义命名。
- **验收：** 欢迎语场景引用次数、引用消息数和引用对话数都为 0；一条消息多条引用时消息数只加 1。
- **验证结果：** 模拟该场景得到 total_citations=0、total_assistant_messages=1、total_conversations=1。

### F12：长文摘要实际只覆盖开头

- **触发：** 查看超过 3000 字的文档摘要或生成专家 Skill。
- **事实：** 两种生成统一使用 request.content[:3000]，响应和页面没有覆盖范围或截断提示。侧栏打开资料自动发起摘要请求，没有基于文档版本的持久化缓存。
- **影响：** 后半段的重要约束、结论、冲突信息不会进入生成；重复查看可能重复调用模型，用户难以判断摘要是否覆盖全文。
- **位置：** [内容截断](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/api/routes/ai.py:70)、[打开文档自动生成](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/knowledge/[kbId]/components/KnowledgeSidebar.tsx:30)。
- **建议：** 先明确展示覆盖范围；按文档分块生成再汇总，保留引用。用文档 ID、正文版本、模型与提示词版本缓存结果，并提供主动生成/更新入口。
- **验收：** 文档结尾放入关键限制，完整摘要能体现；截断模式明确提示；同版本重复打开不重复生成。

### F13：简历评分与编辑版本脱节

- **触发：** 用户修改结构化内容、保存并导出。
- **事实：** 更新仅改 structured，score/analysis 仍属于原上传正文；页面继续显示评分及“AI 分析报告”，没有版本或过期标记。重新解析又从原文件/正文覆盖结构化数据，而不是从用户编辑版生成。
- **影响：** 用户无法确认“质量不错”评价属于哪一版；保存后的修改可能在重新解析时被原文抽取结果覆盖。
- **位置：** [编辑保存](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/resume_service.py:213)、[重新解析来源](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/resume_service.py:252)、[评分和分析报告展示](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/resumes/page.tsx:461)。
- **建议：** 分别记录原文件、编辑正文、结构化版本和分析版本；编辑后标记原报告过期，允许评估当前版本；重新解析明确“从原文件重建”，覆盖前提供预览或保留历史。
- **验收：** 修改关键经历后旧报告明确显示来源版本；导出版本与评估对象一致；原文重建可恢复编辑前版本。

## 三、业务能力优化：需要产品决策，不宜直接当作代码错误

### O01：把练习平均分和知识掌握程度区分开

目前分类/难度按所有 PracticeRecord 平均分汇总，页面称“掌握度”。反复刷一道熟悉题会提高均分，但不会增加知识覆盖。建议同时展示已练独立题数、覆盖率、每题最近有效成绩、首次与复练表现、低分题和遗忘间隔。源码：[成绩汇总](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/practice_service.py:48)、[掌握度页面](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/app/statistics/[kbId]/page.tsx:194)。指标方案需先定义，不能把新算法未经验证地称为更准确。

### O02：面试选题应有训练策略

当前按创建时间、ID 取最早 N 题；相同筛选条件开新场通常得到同一组。建议提供基础顺序、随机、未练、薄弱点复练等模式；保存选题策略、随机种子及曝光记录。已经实现的逐题评分、恢复和总结应继续保留。源码：[面试选题](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/interview_service.py:84)。

### O03：让统计形成“发现弱项 → 再练 → 比较”的闭环

现在统计能展示均分和近期记录，但练习记录未持久化模型/评分规则版本、完整 key_points 和 reference_summary。建议增加作答详情、对应题目入口、薄弱知识点归因、复练计划及同题历史比较；保留题目和标准答案快照，使评分可以解释。源码：[单题记录写入](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/services/practice_service.py:34)、[PracticeRecord 字段](C:/Users/86158/Desktop/Frontend/AI-knowledge-Platform/background/app/infrastructure/database/models.py:290)。

### O04：资料、题库、简历之间建立可追溯关系

当前已有资料问答、JSON 题目导入、简历编辑与模拟面试，但题目来源主要是自由文本，训练选择主要是题库筛选。可以增加“从指定资料或简历经历生成候选题 → 用户审核 → 入库 → 指定来源训练”，让题目关联具体文档片段、简历版本和能力点。生成内容必须审核后成为参考答案，避免错误资料通过评分扩大影响。这是能力扩展建议，不是断言已有功能承诺未兑现。

### O05：明确本地使用和多人部署的模型边界

用户可自定义 OpenAI 兼容地址，服务端执行请求。localhost 指向后端运行环境，在容器中也不会指向浏览器所在电脑。建议页面解释网络位置，区分本地可信部署与多人托管模式；托管模式评估模型请求的内网访问规则、用户预算、并发、超时和数据供应商选择。是否已经存在额外入口限制、真实代理、用户协议或模型成本控制，需要部署材料确认，不能仅靠源码宣布线上不安全。

## 四、建议实施顺序

1. **先修数据边界和资源保护：F01、F02、F03、F04。** 其中 F01 改动小，适合先独立提交；F03、F04需结合存储和部署配置验收。
2. **再修请求和数据一致性：F05、F06、F07、F08。** 先明确回合/提交幂等语义，然后统一短事务、失败状态和前端资源隔离。
3. **再修用户判断依据：F09、F10、F11、F12、F13。** 优先纠正编号与指标口径，再做全文摘要和简历版本化。
4. **最后推进训练闭环：O01—O05。** 先定义指标与训练目标，再加自适应策略；用评测集和真实使用数据验证收益。

## 五、证据和边界

本次隔离验证不写业务数据库，不上传资料，不调用外部模型：

| 验证                                             | 实际结果                         | 可证明的范围                            |
| ------------------------------------------------ | -------------------------------- | --------------------------------------- |
| 实际题目导入服务 + 内存 SQLite + autoflush=False | imported=2、skipped=0、保存 2 条 | 单批重复查重失效；不代替 MySQL 并发验证 |
| 简历重新解析 + 模拟解析器                        | 只有正文参数，没有 user_id       | 调用身份丢失；未实际发送简历            |
| 后端引用提取 + 对照卡片显示公式                  | 后端 index=3，卡片首项显示 1     | 编号映射错误；未运行浏览器截图测试      |
| 限流组件 + 同一客户端不同代理头                  | 原桶拒绝，新桶允许               | 组件可绕过；真实代理是否覆盖此头待查    |
| 引用统计服务 + 无引用欢迎语                      | 0 次引用、1 条助手消息、1 个对话 | 指标标签与范围不一致                    |

尚未覆盖或未验证：生产数据量、真实用户训练效果、真实供应商计费和评分质量、部署入口策略、磁盘/向量清理故障注入、长文和并发压测。前一阶段的后端测试已有临时目录权限相关环境限制，本次不把该限制当作业务缺陷，也不宣称完成全量线上验证。
