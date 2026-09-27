# -*- coding: utf-8 -*-
"""简历结构化数据模型：用于可视化编辑与导出。"""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, Field


class ResumeBasics(BaseModel):
    """基本信息。"""

    name: str = ''
    title: str = ''
    email: str = ''
    phone: str = ''
    location: str = ''
    website: str = ''
    summary: str = ''


class ResumeEducation(BaseModel):
    """教育经历。"""

    school: str = ''
    degree: str = ''
    major: str = ''
    start: str = ''
    end: str = ''
    description: str = ''


class ResumeExperience(BaseModel):
    """工作经历。"""

    company: str = ''
    title: str = ''
    location: str = ''
    start: str = ''
    end: str = ''
    bullets: list[str] = Field(default_factory=list)


class ResumeProject(BaseModel):
    """项目经历。"""

    name: str = ''
    role: str = ''
    start: str = ''
    end: str = ''
    description: str = ''
    bullets: list[str] = Field(default_factory=list)
    tech: list[str] = Field(default_factory=list)


class ResumeSkillGroup(BaseModel):
    """技能分组。"""

    category: str = ''
    items: list[str] = Field(default_factory=list)


class ResumeCertification(BaseModel):
    """证书 / 奖项。"""

    name: str = ''
    issuer: str = ''
    date: str = ''
    description: str = ''


class StructuredResume(BaseModel):
    """完整结构化简历。"""

    basics: ResumeBasics = Field(default_factory=ResumeBasics)
    education: list[ResumeEducation] = Field(default_factory=list)
    experience: list[ResumeExperience] = Field(default_factory=list)
    projects: list[ResumeProject] = Field(default_factory=list)
    skills: list[ResumeSkillGroup] = Field(default_factory=list)
    certifications: list[ResumeCertification] = Field(default_factory=list)
    custom_sections: list[ResumeCustomSection] = Field(
        default_factory=list, validation_alias=AliasChoices('custom_sections', 'customSections'),
    )
    layout: ResumeLayout = Field(default_factory=lambda: ResumeLayout())


class ResumeCustomSection(BaseModel):
    """无法映射到标准字段的原始栏目，也支持用户新增栏目。"""

    id: str
    title: str = ''
    content: str = ''


class ResumeSectionLayout(BaseModel):
    key: str
    title: str = ''


class ResumeLayout(BaseModel):
    sections: list[ResumeSectionLayout] = Field(default_factory=list)


StructuredResume.model_rebuild()
