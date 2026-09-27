# -*- coding: utf-8 -*-
"""简历服务：简历上传和分析。"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Optional

from loguru import logger
from sqlalchemy import select

from app.etl.parser import DocumentParser
from app.infrastructure.database.models import Resume, User
from app.infrastructure.database.session import get_session_context
from app.infrastructure.llm.resume_analysis import analyze_resume
from app.infrastructure.llm.resume_structure import heuristic_or_empty, parse_resume_structure
from app.models.resume_structure import StructuredResume
from app.models.schemas import ResumeAnalysisResponse, ResumeResponse
from app.services.resume_export import export_bytes


def _heuristic_analysis(content: str) -> tuple[str, int]:
    """无可用 LLM 时的本地规则分析，保证上传链路可用。"""
    keywords = [
        "Python", "Java", "JavaScript", "React", "Vue", "Angular",
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis",
        "Docker", "Kubernetes", "AWS", "Azure", "GCP",
        "机器学习", "深度学习", "人工智能", "数据分析",
        "项目经验", "工作经验", "教育背景", "技能证书",
    ]
    lowered = content.lower()
    found_keywords = [k for k in keywords if k.lower() in lowered]
    keyword_score = min(len(found_keywords) * 10, 60)
    length_score = min(len(content) / 1000 * 20, 20)
    structure_score = 20 if len(content) > 500 else 10
    total_score = min(max(int(keyword_score + length_score + structure_score), 0), 100)
    analysis = f"""# 简历分析报告（本地规则）

> 当前未配置模型 API，以下为规则分析结果。配置 `MIMO_API_KEY` 后可获得完整 AI 诊断。

## 总评
- 文件长度：{len(content)} 字符
- 关键词命中：{len(found_keywords)}/{len(keywords)}

## 技能关键词
{', '.join(found_keywords) if found_keywords else '未发现明显技能关键词'}

## 分项评分
- 技能匹配度：{keyword_score}/60
- 内容丰富度：{int(length_score)}/20
- 结构完整性：{structure_score}/20
- **综合得分：{total_score}/100**

## 改进建议
1. {'建议补充更多技术技能关键词' if len(found_keywords) < 5 else '技能关键词较为丰富'}
2. {'建议增加项目经验描述' if '项目经验' not in lowered else '项目经验描述较为详细'}
3. {'建议完善教育背景' if '教育背景' not in lowered else '教育背景信息完整'}
4. {'建议添加工作经验' if '工作经验' not in lowered else '工作经验描述较为详细'}
"""
    return analysis, total_score


async def upload_and_analyze_resume(
    user_id: str,
    file_data: bytes,
    filename: str,
) -> ResumeAnalysisResponse:
    """上传简历并进行分析。"""
    async with get_session_context() as session:
        user = await session.scalar(select(User).where(User.id == user_id))
        if not user:
            raise ValueError("用户不存在")

        upload_root = Path("uploads/resumes")
        upload_root.mkdir(parents=True, exist_ok=True)

        resume_id = str(uuid.uuid4())
        safe_name = Path(filename or "unnamed").name
        dest = upload_root / f"{resume_id}_{safe_name}"

        try:
            await asyncio.to_thread(dest.write_bytes, file_data)
        except Exception as exc:
            raise RuntimeError(f"保存文件失败: {exc}") from exc

        # 第一步：用文档解析工具抽取 PDF / DOCX / 文本正文
        try:
            parsed = await asyncio.to_thread(
                DocumentParser().parse_bytes, file_data, safe_name, None
            )
            content = parsed.text.strip()
        except ValueError as exc:
            await asyncio.to_thread(dest.unlink, missing_ok=True)
            raise ValueError(str(exc)) from exc
        except Exception as exc:
            await asyncio.to_thread(dest.unlink, missing_ok=True)
            raise RuntimeError(f"解析简历失败: {exc}") from exc

        if not content:
            await asyncio.to_thread(dest.unlink, missing_ok=True)
            raise ValueError("未能从文件中提取到文本内容")

        # 第二步：并行做 HR 分析与结构化抽取
        analysis_task = analyze_resume(content)
        structure_task = parse_resume_structure(content)
        analysis_result, structure_result = await asyncio.gather(
            analysis_task, structure_task, return_exceptions=True
        )

        if isinstance(analysis_result, BaseException):
            if isinstance(analysis_result, RuntimeError):
                logger.warning("LLM 简历分析不可用，回退本地规则: {}", analysis_result)
            else:
                logger.exception("LLM 简历分析失败，回退本地规则: {}", analysis_result)
            analysis, score = _heuristic_analysis(content)
        else:
            analysis, score = analysis_result.to_markdown(), analysis_result.score

        if isinstance(structure_result, BaseException):
            logger.warning("简历结构化失败，回退启发式: {}", structure_result)
            structured = heuristic_or_empty(content)
        else:
            structured = structure_result

        resume = Resume(
            id=resume_id,
            user_id=user_id,
            filename=safe_name,
            file_size=len(file_data),
            content=content,
            analysis=analysis,
            score=score,
            structured=structured.model_dump(),
        )
        session.add(resume)
        await session.commit()
        await session.refresh(resume)

        return ResumeAnalysisResponse(
            id=resume.id,
            filename=resume.filename,
            file_size=resume.file_size,
            score=resume.score,
            analysis=resume.analysis,
            created_at=resume.created_at.isoformat(),
            structured=resume.structured,
            content=resume.content,
        )


async def get_resume(resume_id: str, user_id: str) -> Optional[ResumeResponse]:
    """获取简历详情。"""
    async with get_session_context() as session:
        resume = await session.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )
        if not resume:
            return None

        return ResumeResponse(
            id=resume.id,
            filename=resume.filename,
            file_size=resume.file_size,
            score=resume.score,
            created_at=resume.created_at.isoformat(),
            content=resume.content,
            analysis=resume.analysis,
            structured=resume.structured,
        )


async def delete_resume(resume_id: str, user_id: str) -> bool:
    async with get_session_context() as session:
        resume = await session.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )
        if resume is None:
            return False
        root = Path("uploads/resumes").resolve()
        path = (root / f"{resume.id}_{resume.filename}").resolve()
        if not path.is_relative_to(root):
            raise RuntimeError("简历文件路径无效")
        await asyncio.to_thread(path.unlink, missing_ok=True)
        await session.delete(resume)
        await session.commit()
        return True


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


async def update_resume_structure(
    resume_id: str,
    user_id: str,
    structured: StructuredResume,
) -> Optional[ResumeResponse]:
    """保存用户编辑后的结构化简历。"""
    async with get_session_context() as session:
        resume = await session.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )
        if not resume:
            return None
        resume.structured = structured.model_dump()
        await session.commit()
        await session.refresh(resume)
        return ResumeResponse(
            id=resume.id,
            filename=resume.filename,
            file_size=resume.file_size,
            score=resume.score,
            created_at=resume.created_at.isoformat(),
            content=resume.content,
            analysis=resume.analysis,
            structured=resume.structured,
        )


async def reparse_resume_structure(
    resume_id: str,
    user_id: str,
) -> Optional[ResumeResponse]:
    """从已解析正文重新抽取结构化模块。"""
    async with get_session_context() as session:
        resume = await session.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )
        if not resume:
            return None
        content = resume.content or ''
        try:
            structured = await parse_resume_structure(content)
        except Exception as exc:
            logger.warning("重新结构化失败，回退启发式: {}", exc)
            structured = heuristic_or_empty(content)
        resume.structured = structured.model_dump()
        await session.commit()
        await session.refresh(resume)
        return ResumeResponse(
            id=resume.id,
            filename=resume.filename,
            file_size=resume.file_size,
            score=resume.score,
            created_at=resume.created_at.isoformat(),
            content=resume.content,
            analysis=resume.analysis,
            structured=resume.structured,
        )


async def export_resume(
    resume_id: str,
    user_id: str,
    fmt: str,
    style: str | None = None,
) -> Optional[tuple[bytes, str, str]]:
    """导出结构化简历为 DOCX / PDF，支持版式样式。"""
    async with get_session_context() as session:
        resume = await session.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )
        if not resume:
            return None
        raw = resume.structured or {}
        try:
            structured = StructuredResume.model_validate(raw) if raw else heuristic_or_empty(resume.content or '')
        except Exception as exc:
            raise ValueError(f'结构化数据无效，请先修正后再导出: {exc}') from exc
        content, media_type, filename = export_bytes(
            structured, fmt, resume.filename or 'resume', style=style
        )
        return content, media_type, filename
