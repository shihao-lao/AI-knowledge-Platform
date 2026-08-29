# -*- coding: utf-8 -*-
"""简历服务：简历上传和分析。"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Resume, User
from app.infrastructure.database.session import get_async_session, get_session_context
from app.models.schemas import (
    ResumeCreate,
    ResumeResponse,
    ResumeAnalysisResponse,
)


async def upload_and_analyze_resume(
    user_id: str,
    file_data: bytes,
    filename: str,
) -> ResumeAnalysisResponse:
    """上传简历并进行分析。"""
    async with get_session_context() as session:
        # 检查用户是否存在
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError("用户不存在")

        # 保存文件
        upload_root = Path("uploads/resumes")
        upload_root.mkdir(parents=True, exist_ok=True)

        resume_id = str(uuid.uuid4())
        safe_name = filename or "unnamed"
        dest = upload_root / f"{resume_id}_{safe_name}"

        try:
            await asyncio.to_thread(dest.write_bytes, file_data)
        except Exception as exc:
            raise RuntimeError(f"保存文件失败: {exc}")

        # 解析简历内容
        content = await _parse_resume_content(file_data, safe_name)

        # 分析简历
        analysis, score = await _analyze_resume_with_llm(content)

        # 保存简历记录
        resume = Resume(
            id=resume_id,
            user_id=user_id,
            filename=safe_name,
            file_size=len(file_data),
            content=content[:8000],  # 截取前 8000 字符
            analysis=analysis,
            score=score,
        )
        session.add(resume)
        await session.commit()
        await session.refresh(resume)

        return ResumeAnalysisResponse(
            id=resume.id,
            filename=resume.filename,
            score=resume.score,
            analysis=resume.analysis,
            created_at=resume.created_at.isoformat(),
        )


async def _parse_resume_content(file_data: bytes, filename: str) -> str:
    """解析简历内容。"""
    # 这里应该使用实际的文档解析库
    # 暂时返回简单的文本提取

    # 尝试根据文件扩展名解析
    if filename.endswith(".pdf"):
        # 使用 pypdf 解析 PDF
        try:
            from pypdf import PdfReader
            import io

            reader = PdfReader(io.BytesIO(file_data))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception:
            return "无法解析 PDF 文件"
    elif filename.endswith((".doc", ".docx")):
        # 使用 python-docx 解析 Word 文档
        try:
            from docx import Document
            import io

            doc = Document(io.BytesIO(file_data))
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text.strip()
        except Exception:
            return "无法解析 Word 文件"
    else:
        # 尝试作为纯文本解析
        try:
            return file_data.decode("utf-8")
        except Exception:
            return "无法解析文件内容"


async def _analyze_resume_with_llm(content: str) -> tuple[str, int]:
    """使用 LLM 分析简历。"""
    # 这里应该调用实际的 LLM 进行分析
    # 暂时返回模拟结果

    # 简单的关键词分析
    keywords = [
        "Python", "Java", "JavaScript", "React", "Vue", "Angular",
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis",
        "Docker", "Kubernetes", "AWS", "Azure", "GCP",
        "机器学习", "深度学习", "人工智能", "数据分析",
        "项目经验", "工作经验", "教育背景", "技能证书",
    ]

    found_keywords = []
    for keyword in keywords:
        if keyword.lower() in content.lower():
            found_keywords.append(keyword)

    # 计算分数
    keyword_score = min(len(found_keywords) * 10, 60)
    length_score = min(len(content) / 1000 * 20, 20)
    structure_score = 20 if len(content) > 500 else 10

    total_score = int(keyword_score + length_score + structure_score)
    total_score = min(max(total_score, 0), 100)

    # 生成分析报告
    analysis = f"""# 简历分析报告

## 基本信息
- 文件长度：{len(content)} 字符
- 关键词命中：{len(found_keywords)}/{len(keywords)}

## 技能关键词
{', '.join(found_keywords) if found_keywords else '未发现明显技能关键词'}

## 分析结果
- 技能匹配度：{keyword_score}/60
- 内容丰富度：{int(length_score)}/20
- 结构完整性：{structure_score}/20
- **总分：{total_score}/100**

## 建议
1. {'建议补充更多技术技能关键词' if len(found_keywords) < 5 else '技能关键词较为丰富'}
2. {'建议增加项目经验描述' if '项目经验' not in content.lower() else '项目经验描述较为详细'}
3. {'建议完善教育背景' if '教育背景' not in content.lower() else '教育背景信息完整'}
4. {'建议添加工作经验' if '工作经验' not in content.lower() else '工作经验描述较为详细'}
"""

    return analysis, total_score


async def get_resume(resume_id: str, user_id: str) -> Optional[ResumeResponse]:
    """获取简历详情。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Resume).where(Resume.id == resume_id)
        )
        resume = result.scalar_one_or_none()
        if not resume:
            return None

        # 检查简历是否属于当前用户
        if resume.user_id != user_id:
            return None

        return ResumeResponse(
            id=resume.id,
            filename=resume.filename,
            file_size=resume.file_size,
            score=resume.score,
            created_at=resume.created_at.isoformat(),
        )


async def get_user_resumes(user_id: str) -> list[ResumeResponse]:
    """获取用户的简历列表。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(Resume.created_at.desc())
        )
        resumes = result.scalars().all()

        return [
            ResumeResponse(
                id=r.id,
                filename=r.filename,
                file_size=r.file_size,
                score=r.score,
                created_at=r.created_at.isoformat(),
            )
            for r in resumes
        ]