# -*- coding: utf-8 -*-
"""API 请求与响应模型。"""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import MessageRole


class ChatRequest(BaseModel):
    """对话请求。

    模型、温度与 max_tokens 来自当前用户的模型配置（「设置 → 模型配置」），
    所以这里只描述一次问答本身需要的字段，不再接受无人使用的 messages /
    model / temperature / max_tokens —— 之前它们被静默忽略，前端还得塞一条
    假消息才能通过校验。
    """

    conversation_id: str | None = Field(default=None, description="会话 ID")
    question: str | None = Field(default=None, description="用户问题")
    enable_search: bool = Field(default=True, description="是否启用检索")
    mode: str = Field(default="question", description="模式：question 或 interview")


class DocumentUploadResponse(BaseModel):
    """文档上传响应。"""

    id: str
    filename: str
    status: str
    index_status: Literal['indexed', 'keyword_only', 'unknown'] = 'unknown'
    chunk_count: int = 0
    message: str = "ok"


class DocumentInfo(BaseModel):
    """文档列表项。"""

    id: str
    filename: str
    mime_type: str | None = None
    status: str
    created_at: str | None = None


class DocumentUploadRequest(BaseModel):
    """文档上传附加元数据（可选）。"""

    tags: list[str] = Field(default_factory=list)


class Message(BaseModel):
    """对话消息（记忆/RAG 内部使用，含角色枚举）。"""

    role: MessageRole
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryItem(BaseModel):
    """长期记忆召回条目。"""

    id: str
    content: str
    score: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryContext(BaseModel):
    """短期 + 长期记忆合并上下文。"""

    session_id: str
    short_term_messages: list[Message]
    long_term_items: list[MemoryItem]


class RetrievalResult(BaseModel):
    """检索单条结果。"""

    id: str
    content: str
    score: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)
    source: str = "vector"


class Citation(BaseModel):
    """答案中的引用标注。"""

    index: int
    result_id: str
    snippet: str


class RAGResponse(BaseModel):
    """RAG 生成结果。"""

    answer: str
    citations: list[Citation] = Field(default_factory=list)
    raw_contexts: list[RetrievalResult] = Field(default_factory=list)
    model: str | None = None


class UserCreate(BaseModel):
    """用户注册请求。"""

    name: str = Field(description="昵称", max_length=50)
    email: str = Field(description="邮箱", max_length=200)
    password: str = Field(description="密码", min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """验证密码复杂度。"""
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码必须包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class UserLogin(BaseModel):
    """用户登录请求。"""

    email: str = Field(description="邮箱", max_length=200)
    password: str = Field(description="密码")


class UserResponse(BaseModel):
    """用户信息响应。"""

    id: str
    name: str
    email: str
    created_at: str


class TokenResponse(BaseModel):
    """JWT 令牌响应。"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class KnowledgeCreate(BaseModel):
    """创建知识库请求。"""

    name: str = Field(description="知识库名称", max_length=200)
    description: str = Field(default="", description="知识库描述", max_length=1000)


class KnowledgeUpdate(BaseModel):
    """更新知识库请求。"""

    name: Optional[str] = Field(default=None, description="知识库名称", max_length=200)
    description: Optional[str] = Field(default=None, description="知识库描述", max_length=1000)


class KnowledgeResponse(BaseModel):
    """知识库响应。"""

    id: str
    name: str
    description: str
    status: str
    document_count: int = 0
    created_at: str
    updated_at: str


class DocumentCreate(BaseModel):
    """创建文档请求。"""

    filename: str = Field(description="文件名")
    mime_type: str = Field(default="application/octet-stream", description="MIME 类型")


class DocumentResponse(BaseModel):
    """文档响应。"""

    id: str
    knowledge_id: str
    filename: str
    mime_type: str
    size: int
    parse_status: str
    index_status: Literal['indexed', 'keyword_only', 'unknown'] = 'unknown'
    chunk_count: int
    char_count: int
    enabled: bool
    created_at: str
    updated_at: str
    chunks: List[dict[str, Any]] = Field(default_factory=list)


class DocumentUpdate(BaseModel):
    enabled: bool = Field(strict=True)


class ConversationCreate(BaseModel):
    """创建对话请求。"""

    title: Optional[str] = Field(default=None, description="对话标题")


class ConversationUpdate(BaseModel):
    """更新对话请求。"""

    title: Optional[str] = Field(default=None, description="对话标题", max_length=512)


class ConversationResponse(BaseModel):
    """对话响应。"""

    id: str
    knowledge_id: str
    title: str
    message_count: int
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    """消息响应。"""

    id: str
    role: str
    content: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    created_at: str


class QuestionCreate(BaseModel):
    """创建题目请求。"""

    category: str = Field(default="未分类", description="题目分类")
    difficulty: str = Field(default="medium", description="难度：easy, medium, hard")
    question: str = Field(description="题目内容")
    answer: str = Field(description="参考答案")
    keywords: List[str] = Field(default_factory=list, description="关键词")
    source: Optional[str] = Field(default=None, description="来源")


class QuestionResponse(BaseModel):
    """题目响应。"""

    id: str
    category: str
    difficulty: str
    question: str
    answer: str
    keywords: List[str]
    source: Optional[str]
    created_at: str
    updated_at: str


class QuestionImportRequest(BaseModel):
    """题目导入请求。"""

    questions: List[QuestionCreate] = Field(description="题目列表")


class QuestionImportResponse(BaseModel):
    """题目导入响应。"""

    imported: int
    skipped: int
    errors: List[str]
    message: str


class PracticeEvaluateRequest(BaseModel):
    """练习评估请求。"""

    question_id: str = Field(description="题目 ID")
    user_answer: str = Field(description="用户答案")


class PracticeEvaluateResponse(BaseModel):
    """练习评估响应。"""

    id: str
    question_id: str
    score: int
    feedback: str
    evaluated_at: str
    record_id: str
    key_points: List[str]
    reference_summary: str


class PracticeRecordResponse(BaseModel):
    """练习记录响应。"""

    id: str
    question_id: str
    mode: str
    score: int
    feedback: str
    evaluated_at: str


class PracticeStatsResponse(BaseModel):
    """练习统计响应。"""

    total_count: int
    average_score: float
    highest_score: int
    lowest_score: int
    recent_records: List[PracticeRecordResponse]
    total: int
    max_score: int
    min_score: int
    by_category: List[dict[str, Any]]
    by_difficulty: List[dict[str, Any]]
    recent: List[dict[str, Any]]


class ResumeCreate(BaseModel):
    """创建简历请求。"""

    filename: str = Field(description="文件名")


class ResumeResponse(BaseModel):
    """简历响应。"""

    id: str
    filename: str
    file_size: int
    score: int
    created_at: str
    content: str = ''
    analysis: str = ''
    structured: dict[str, Any] | None = None


class ResumeAnalysisResponse(BaseModel):
    """简历分析响应。"""

    id: str
    filename: str
    file_size: int = 0
    score: int
    analysis: str
    created_at: str
    structured: dict[str, Any] | None = None
    content: str = ''


# ==================== 用户大模型配置 ====================


class LLMConfigUpdate(BaseModel):
    """保存用户大模型配置的请求。"""

    provider: str = Field(default="custom", max_length=50, description="服务商标识，仅用于展示")
    base_url: str = Field(default="", max_length=500, description="OpenAI 兼容 API Base")
    api_key: str | None = Field(
        default=None,
        max_length=500,
        description="留空或省略表示保持原密钥不变；显式清空请用 clear_api_key",
    )
    model: str = Field(default="", max_length=200, description="模型名")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=131072)
    timeout: int = Field(default=60, ge=5, le=600, description="单次请求超时（秒）")
    clear_api_key: bool = Field(default=False, description="显式清除已保存的密钥")


class LLMConfigResponse(BaseModel):
    """大模型配置响应：密钥只以脱敏形式返回。"""

    provider: str = "custom"
    base_url: str = ""
    model: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout: int = 60
    api_key_set: bool = False
    api_key_masked: str = ""
    source: str = Field(default="none", description="user / server / none")
    configured: bool = False
    is_custom: bool = Field(default=False, description="是否已保存过用户自己的配置")


class LLMTestRequest(BaseModel):
    """连通性测试请求：未保存时可直接带上待测参数。"""

    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=131072)
    timeout: int | None = Field(default=None, ge=5, le=600)


class LLMTestResponse(BaseModel):
    """连通性测试结果。"""

    ok: bool
    message: str
    latency_ms: int = 0
    model: str = ""
    reply: str = ""
    models_available: int = 0


class LLMModelsResponse(BaseModel):
    """模型列表响应。"""

    ok: bool
    message: str = ""
    data: list[str] = Field(default_factory=list)
