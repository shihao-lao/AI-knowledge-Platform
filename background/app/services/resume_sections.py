"""保留原简历栏目，并补回结构化抽取遗漏的原文。"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models.resume_structure import (
    ResumeCustomSection,
    ResumeEducation,
    ResumeExperience,
    ResumeProject,
    ResumeSectionLayout,
    ResumeSkillGroup,
    StructuredResume,
)

SECTION_TITLES = {
    'summary': '个人简介',
    'education': '教育背景',
    'experience': '工作经历',
    'projects': '项目经历',
    'skills': '专业技能',
    'certifications': '证书与奖项',
}
ALIASES = {
    'summary': ('个人简介', '自我评价', '自我介绍', '个人总结', '个人优势', '简介', 'Summary', 'Profile'),
    'education': ('教育背景', '教育经历', '教育经验', '学历', '教育', 'Education'),
    'experience': ('工作经历', '工作经验', '实习经历', '实习经验', '职业经历', '工作与实习经历', 'Experience', 'Work Experience'),
    'projects': ('项目经历', '项目经验', '项目实践', '个人项目', 'Projects', 'Project Experience'),
    'skills': ('专业技能', '技术技能', '技术栈', '技能清单', '技能', '专业能力', 'Skills', 'Technical Skills'),
    'certifications': ('证书与奖项', '证书', '技能证书', '奖项', '荣誉奖项', '获奖经历', '荣誉', 'Certifications', 'Awards'),
}
CUSTOM_TITLES = {
    '校园活动', '校园经历', '社团经历', '志愿服务', '开源贡献', '论文发表', '科研成果',
    '兴趣爱好', '语言能力', '其他信息', '联系方式', '求职意向', '培训经历', '作品集',
    'Publications', 'Languages', 'Interests', 'Volunteering', 'Open Source',
}


@dataclass
class SourceSection:
    key: str | None
    title: str
    lines: list[str] = field(default_factory=list)


def heading(line: str) -> tuple[str | None, str] | None:
    raw = line.strip()
    title = re.sub(r'^#{1,6}\s+', '', raw)
    title = title.strip('* _：:【】[]')
    title = re.sub(r'^[一二三四五六七八九十\d]+[、.)）]\s*', '', title)
    compact = re.sub(r'\s+', '', title).casefold()
    if compact in {'基本信息', '个人信息', 'basicinformation', 'contact'}:
        return 'basics', title
    for key, aliases in ALIASES.items():
        if compact in {re.sub(r'\s+', '', alias).casefold() for alias in aliases}:
            return key, title
    # 自定义标题需有明确标记或栏目词，避免把姓名、职位、项目名当作标题。
    marked = raw.startswith('#') or (raw.startswith('**') and raw.endswith('**'))
    custom = re.fullmatch(r'[\u4e00-\u9fffA-Za-z ]{2,16}(?:贡献|活动|经历|作品|发表|出版|成果|能力|爱好|意向|信息|评价)', title)
    if (marked or custom or title in CUSTOM_TITLES) and len(title) <= 40 and not re.search(r'[@：:，,；;。]', title):
        return None, title
    return None


def split_source(content: str) -> tuple[list[str], list[SourceSection]]:
    preamble: list[str] = []
    sections: list[SourceSection] = []
    in_basics = False
    for line in content.splitlines():
        if not line.strip():
            continue
        match = heading(line)
        if match:
            in_basics = match[0] == 'basics'
            if not in_basics:
                sections.append(SourceSection(*match))
        elif sections and not in_basics:
            sections[-1].lines.append(line.strip())
        else:
            preamble.append(line.strip())
    return preamble, sections


def standard_source(content: str) -> str:
    """供规则解析使用，未知栏目独立保留，不混入上一段经历。"""
    preamble, sections = split_source(content)
    lines = list(preamble)
    used: set[str] = set()
    for section in sections:
        if section.key and section.key not in used:
            lines.extend([SECTION_TITLES[section.key], *section.lines])
            used.add(section.key)
    return '\n'.join(lines)


def _flatten(value) -> str:
    if isinstance(value, dict):
        return ' '.join(_flatten(v) for v in value.values())
    if isinstance(value, list):
        return ' '.join(_flatten(v) for v in value)
    return str(value or '')


def _normalized(text: str) -> str:
    return re.sub(r'[\W_]+', '', text).casefold()


def _covered(line: str, represented: str) -> bool:
    clean = re.sub(r'^[-•·\s]+', '', line)
    clean = re.sub(r'^(项目名称|项目|简介|项目描述|技术栈|学校|学历|专业|职位|角色|邮箱|电话)[:：]\s*', '', clean)
    normalized = _normalized(clean)
    if not normalized or normalized in represented:
        return True
    # 学校、职位、时间被拆成字段后，原来同一行的顺序可能变化。
    tokens = [token for token in re.split(r'[\s|·,，：:]+', clean) if token]
    return bool(tokens) and all(_normalized(token) in represented for token in tokens)


def preserve_source(data: StructuredResume, content: str) -> StructuredResume:
    preamble, sections = split_source(content)
    data.custom_sections = []
    data.layout.sections = []
    used: set[str] = set()
    for index, section in enumerate(sections):
        key = section.key
        if key is None or key in used:
            custom_id = f'custom-source-{index}'
            data.custom_sections.append(ResumeCustomSection(
                id=custom_id, title=section.title, content='\n'.join(section.lines),
            ))
            data.layout.sections.append(ResumeSectionLayout(key=custom_id, title=section.title))
            continue
        used.add(key)
        data.layout.sections.append(ResumeSectionLayout(key=key, title=section.title))
        value = data.basics.summary if key == 'summary' else [x.model_dump() for x in getattr(data, key)]
        represented = _normalized(_flatten(value))
        missing = [line for line in section.lines if not _covered(line, represented)]
        if not missing:
            continue
        if key == 'summary':
            # 简介忠实保留原文，分析建议留在分析报告。
            data.basics.summary = '\n'.join(section.lines)
        elif key == 'education':
            if not data.education:
                data.education.append(ResumeEducation())
            data.education[-1].description = '\n'.join(filter(None, [data.education[-1].description, *missing]))
        elif key == 'experience':
            if not data.experience:
                data.experience.append(ResumeExperience())
            data.experience[-1].bullets.extend(missing)
        elif key == 'projects':
            if not data.projects:
                data.projects.append(ResumeProject())
            data.projects[-1].bullets.extend(missing)
        elif key == 'skills':
            data.skills.append(ResumeSkillGroup(category='补充技能', items=missing))
        else:
            custom_id = f'custom-source-{index}-remaining'
            data.custom_sections.append(ResumeCustomSection(id=custom_id, title='补充说明', content='\n'.join(missing)))
            data.layout.sections.append(ResumeSectionLayout(key=custom_id, title='补充说明'))

    represented = _normalized(_flatten(data.basics.model_dump()))
    missing = [line for line in preamble if not _covered(line, represented)]
    if missing:
        data.custom_sections.insert(0, ResumeCustomSection(id='custom-preamble', title='其他信息', content='\n'.join(missing)))
        data.layout.sections.insert(0, ResumeSectionLayout(key='custom-preamble', title='其他信息'))
    return data
