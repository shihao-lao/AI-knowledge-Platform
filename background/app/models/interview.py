"""模拟面试的请求与公开结果；待答题的参考答案不发给客户端。"""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class InterviewStart(BaseModel):
    question_count: int = Field(default=5, ge=1, le=20)
    category: str | None = Field(default=None, max_length=100)
    difficulty: Literal['easy', 'medium', 'hard'] | None = None


class InterviewAnswer(BaseModel):
    turn_id: str
    answer: str = Field(min_length=1, max_length=20000)

    @field_validator('answer')
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('回答不能为空')
        return value.strip()


class InterviewNext(BaseModel):
    turn_id: str


class TurnResult(BaseModel):
    id: str
    position: int
    question: str
    category: str
    difficulty: str
    user_answer: str | None
    evaluation: dict | None


class InterviewResult(BaseModel):
    id: str
    conversation_id: str
    status: Literal['answering', 'reviewing', 'completed']
    current_position: int
    turns: list[TurnResult]
    summary: dict | None
    created_at: str
    completed_at: str | None
