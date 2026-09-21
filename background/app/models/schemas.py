# -*- coding: utf-8 -*-
"""API 请求与响应模型。"""

from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field, validator

from app.models.enums import MessageRole


class ChatMessage(BaseModel):
    """单条对话消息。"""

    role: str = Field(description="角色：system | user | assistant")
    content: str = Field(description="文本内容")


class ChatRequest(BaseModel):
    """对话请求。"""

    messages: list[ChatMessage] = Field(min_length=1, description="OpenAI 风格消息列表")
    model: str | None = Field(default=None, description="优先使用的模型 ID")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1)
    conversation_id: str | None = Field(default=None, description="可选会话 ID")
    question: str | None = Field(default=None, description="用户问题")
    enable_search: bool = Field(default=True, description="是否启用搜索")
    mode: str = Field(default="question", description="模式：question 或 interview")


class ChatResponse(BaseModel):
    """非流式对话响应。"""

    id: str = Field(description="响应 ID")
    model: str = Field(description="实际使用的模型")
    content: str = Field(description="助手回复正文")
    trace_id: str | None = Field(default=None, description="链路追踪 ID")
    usage: dict[str, Any] | None = Field(default=None, description="Token 用量")


class DocumentUploadResponse(BaseModel):
    """文档上传响应。"""

    id: str
    filename: str
    status: str
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
    
    @validator('password')
    def validate_password(cls, v):
        """验证密码复杂度。"""
        if not any(c.isupper() for c in v):
            raise ValueError('密码必须包含至少一个大写字母')
        if not any(c.islower() for c in v):
            raise ValueError('密码必须包含至少一个小写字母')
        if not any(c.isdigit() for c in v):
            raise ValueError('密码必须包含至少一个数字')
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
    citations: str
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


class ResumeAnalysisResponse(BaseModel):
    """简历分析响应。"""

    id: str
    filename: str
    score: int
    analysis: str
    created_at: str
