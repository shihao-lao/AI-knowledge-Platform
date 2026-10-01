# 项目全局概览

> 本文件只做**导航与速查**。架构细节、检索链路、启动步骤以
> [README.md](./README.md)（对外）与 [AGENTS.md](./AGENTS.md)（对协作方）为准，
> 避免同一件事在多处描述造成文档漂移。

## 基本信息

| 项       | 内容                                                           |
| -------- | -------------------------------------------------------------- |
| 项目名称 | AI 面试知识库智能问答平台                                      |
| 项目类型 | 全栈 Web 应用（前后端分离）                                    |
| 前端     | Next.js 16（App Router）· React 19 · TypeScript · Ant Design 5 |
| 后端     | Python FastAPI · SQLAlchemy 2.0（async）· Alembic              |
| 数据层   | MySQL 8（`aiomysql`）· Milvus（向量库）                        |
| 检索     | 向量 + BM25 双路召回 → RRF 融合 → Cross-Encoder 精排           |
| LLM      | 小米 MiMo（OpenAI 兼容协议）· SSE 流式 · LangChain 编排        |
| 鉴权     | JWT（HS256）+ bcrypt                                           |

## 文档索引

| 文件                     | 用途                                                     |
| ------------------------ | -------------------------------------------------------- |
| [README.md](./README.md) | 项目介绍、架构图、检索链路、快速开始、已知限制与后续计划 |
| [AGENTS.md](./AGENTS.md) | 协作约定、目录职责、命令、检索与降级细节                 |
| [CLAUDE.md](./CLAUDE.md) | Claude Code 使用约定（架构指向 AGENTS.md）               |
| `background/README.md`   | 后端专属启动与调试说明                                   |
| `docs/`                  | 数据库、测试、认证等专题记录（部分为历史过程文档）       |

## 项目规模速查

| 指标         | 数值                                                     |
| ------------ | -------------------------------------------------------- |
| REST 端点    | 40 个 / 11 个路由模块                                    |
| 数据表       | 9 张（15 个二级索引）                                    |
| Alembic 迁移 | 1 个 baseline                                            |
| 后端测试     | pytest，覆盖鉴权、数据层、解析、检索精排、评分、简历     |
| 前端回归     | `checks/*.mjs`（认证 / 上传 / SSE / 简历）               |
| CI           | GitHub Actions：Prettier `format:check` + `tsc --noEmit` |

## 状态

- 已完成：用户体系与数据隔离、知识库与文档 ETL、混合检索与精排、引用溯源、模拟面试与结构化评分、掌握度统计、简历分析与导出、限流与错误处理。
- 未完成（详见 README「已知限制与后续计划」）：检索评测集、BM25 索引常驻化、父子分块、限流下沉 Redis、CI 跑测试。

## 历史文档说明

`docs/` 下部分文件（如 `PYTHON_BACKEND_REFACTOR_COMPLETE.md`、
`PROJECT_STATUS_FINAL.md`、`TESTING_COMPLETE_SUMMARY.md`）是**阶段性过程记录**，
其中描述的架构可能已随重构变化。**判断当前实现请以代码与 README/AGENTS.md 为准。**
