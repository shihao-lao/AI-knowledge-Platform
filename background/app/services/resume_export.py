# -*- coding: utf-8 -*-
"""结构化简历导出：DOCX / PDF，支持多种版式样式。"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from xml.sax.saxutils import escape

from app.models.resume_structure import StructuredResume
from app.services.resume_sections import SECTION_TITLES

EXPORT_STYLES = ('classic', 'compact', 'modern')


@dataclass(frozen=True)
class StyleTheme:
    key: str
    label: str
    name_size: int  # half-points for DOCX / pt-ish
    heading_size: int
    body_size: int
    heading_color: str  # hex RGB
    text_color: str
    accent: str
    line_gap: int  # DOCX spacing after
    bullet_marker: str
    name_align: str  # left | center
    tight: bool


STYLES: dict[str, StyleTheme] = {
    'classic': StyleTheme(
        key='classic',
        label='经典简洁',
        name_size=32,
        heading_size=26,
        body_size=21,
        heading_color='1F2937',
        text_color='374151',
        accent='1F2937',
        line_gap=80,
        bullet_marker='• ',
        name_align='left',
        tight=False,
    ),
    'compact': StyleTheme(
        key='compact',
        label='紧凑一页',
        name_size=28,
        heading_size=23,
        body_size=19,
        heading_color='111827',
        text_color='374151',
        accent='111827',
        line_gap=40,
        bullet_marker='- ',
        name_align='left',
        tight=True,
    ),
    'modern': StyleTheme(
        key='modern',
        label='现代强调',
        name_size=36,
        heading_size=26,
        body_size=21,
        heading_color='B45309',
        text_color='292524',
        accent='D97706',
        line_gap=100,
        bullet_marker='▸ ',
        name_align='center',
        tight=False,
    ),
}


def resolve_style(style: str | None) -> StyleTheme:
    key = (style or 'classic').strip().lower()
    if key not in STYLES:
        raise ValueError(f'不支持的导出样式，可选：{", ".join(EXPORT_STYLES)}')
    return STYLES[key]


def _safe_filename(name: str, default: str = 'resume') -> str:
    base = (name or default).strip() or default
    base = re.sub(r'\.[A-Za-z0-9]{1,8}$', '', base)
    base = re.sub(r'[\\/:*?"<>|]+', '_', base)
    base = re.sub(r'\s+', '_', base).strip('._') or default
    return base[:80]


def _period(start: str, end: str) -> str:
    start = (start or '').strip()
    end = (end or '').strip()
    if start and end:
        return f'{start} — {end}'
    return start or end or ''


def structure_to_lines(data: StructuredResume, theme: StyleTheme | None = None) -> list[tuple[str, str]]:
    """生成 (style, text) 行，style ∈ name|heading|sub|bullet|text|meta|gap。"""
    theme = theme or STYLES['classic']
    lines: list[tuple[str, str]] = []
    b = data.basics

    if b.name:
        lines.append(('name', b.name))
    contact = '  ·  '.join(x for x in [b.title, b.phone, b.email, b.location, b.website] if x)
    if contact:
        lines.append(('meta', contact))
    if b.name or contact:
        lines.append(('gap', ''))

    def _section(title: str) -> None:
        lines.append(('heading', title))

    if data.education:
        _section('教育背景')
        for e in data.education:
            head = ' · '.join(x for x in [e.school, e.degree, e.major] if x)
            period = _period(e.start, e.end)
            title = ' · '.join(x for x in [head, period] if x)
            if title:
                lines.append(('sub', title))
            if e.description:
                lines.append(('text', e.description))
        lines.append(('gap', ''))

    if data.experience:
        _section('工作经历')
        for e in data.experience:
            head = ' · '.join(x for x in [e.company, e.title, e.location] if x)
            period = _period(e.start, e.end)
            title = ' · '.join(x for x in [head, period] if x)
            if title:
                lines.append(('sub', title))
            for bullet in e.bullets:
                if bullet:
                    lines.append(('bullet', bullet))
        lines.append(('gap', ''))

    if data.projects:
        _section('项目经历')
        for p in data.projects:
            head = ' · '.join(x for x in [p.name, p.role] if x)
            period = _period(p.start, p.end)
            title = ' · '.join(x for x in [head, period] if x)
            if title:
                lines.append(('sub', title))
            if p.description:
                lines.append(('text', p.description))
            for bullet in p.bullets:
                if bullet:
                    lines.append(('bullet', bullet))
            if p.tech:
                tech = ', '.join(t for t in p.tech if t)
                if tech:
                    lines.append(('meta', f'技术栈：{tech}'))
        lines.append(('gap', ''))

    if data.skills:
        _section('技能')
        for s in data.skills:
            items = ', '.join(i for i in s.items if i)
            label = s.category or '技能'
            if items:
                lines.append(('text', f'{label}：{items}'))
        lines.append(('gap', ''))

    if data.certifications:
        _section('证书与奖项')
        for c in data.certifications:
            head = ' · '.join(x for x in [c.name, c.issuer, c.date] if x)
            if head:
                lines.append(('sub', head))
            if c.description:
                lines.append(('text', c.description))

    while lines and lines[-1][0] == 'gap':
        lines.pop()
    # 固定的信息头 + 原始栏目顺序；旧记录未设置 layout 时仍能正常导出。
    title_keys = {
        '教育背景': 'education', '工作经历': 'experience', '项目经历': 'projects',
        '技能': 'skills', '证书与奖项': 'certifications',
    }
    header: list[tuple[str, str]] = []
    sections: dict[str, list[tuple[str, str]]] = {}
    current = None
    for kind, text in lines:
        if kind == 'heading':
            current = title_keys[text]
            sections[current] = []
        elif current is None:
            header.append((kind, text))
        else:
            sections[current].append((kind, text))
    if b.summary:
        sections['summary'] = [('text', b.summary)]
    titles = dict(SECTION_TITLES)
    for section in data.custom_sections:
        sections[section.id] = [('text', section.content)] if section.content.strip() else []
        titles[section.id] = section.title or '补充内容'
    ordered = []
    seen: set[str] = set()
    for section in data.layout.sections:
        if section.key in sections and section.key not in seen:
            ordered.append((section.key, section.title or titles[section.key]))
            seen.add(section.key)
    for key in ['summary', 'education', 'experience', 'projects', 'skills', 'certifications', *[s.id for s in data.custom_sections]]:
        if key in sections and key not in seen:
            ordered.append((key, titles[key]))
            seen.add(key)
    result = list(header)
    for key, title in ordered:
        body = sections[key]
        if not any(text.strip() for kind, text in body if kind != 'gap'):
            continue
        result.extend([('heading', title), *body])
        if result[-1][0] != 'gap':
            result.append(('gap', ''))
    while result and result[-1][0] == 'gap':
        result.pop()
    return result


def export_docx(data: StructuredResume, style: str | None = None) -> bytes:
    """生成 DOCX（无第三方依赖），style ∈ classic|compact|modern。"""
    theme = resolve_style(style)
    paras: list[str] = []
    for kind, text in structure_to_lines(data, theme):
        if kind == 'gap':
            paras.append('<w:p/>')
            continue

        if kind == 'name':
            sz, bold, color = theme.name_size, True, theme.heading_color
        elif kind == 'heading':
            sz, bold, color = theme.heading_size, True, theme.heading_color
        elif kind == 'sub':
            sz, bold, color = theme.body_size + 2, True, theme.heading_color
        elif kind == 'meta':
            sz, bold, color = max(theme.body_size - 2, 16), False, '6B7280'
        elif kind == 'bullet':
            text = f'{theme.bullet_marker}{text}'
            sz, bold, color = theme.body_size, False, theme.text_color
        else:
            sz, bold, color = theme.body_size, False, theme.text_color

        if kind == 'name' and theme.name_align == 'center':
            jc = '<w:jc w:val="center"/>'
        else:
            jc = ''

        after = theme.line_gap if kind in ('name', 'heading') else theme.line_gap // 2
        safe = '<w:br/>'.join(
            f'<w:t xml:space="preserve">{escape(line)}</w:t>' for line in text.split('\n')
        )
        keep = '<w:keepNext/>' if kind in ('heading', 'sub') else ''
        paras.append(
            f'<w:p><w:pPr>{jc}{keep}<w:spacing w:after="{after}"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="微软雅黑"/>'
            f'<w:sz w:val="{sz}"/><w:color w:val="{color}"/>'
            f'{"" if not bold else "<w:b/>"}'
            f'</w:rPr>{safe}</w:r></w:p>'
        )

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{"".join(paras)}'
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        f'<w:pgMar w:top="{680 if theme.tight else 850}" w:bottom="{680 if theme.tight else 850}" '
        f'w:left="{680 if theme.tight else 907}" w:right="{680 if theme.tight else 907}"/>'
        '</w:sectPr></w:body></w:document>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/></Relationships>'
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', content_types)
        zf.writestr('_rels/.rels', rels)
        zf.writestr('word/document.xml', document_xml)
    return buf.getvalue()


def export_pdf(data: StructuredResume, style: str | None = None) -> bytes:
    """生成中文友好 PDF（reportlab CID 字体），style ∈ classic|compact|modern。"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise RuntimeError('导出 PDF 需要安装 reportlab：pip install reportlab') from exc

    theme = resolve_style(style)
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
    font = 'STSong-Light'

    def hex_color(value: str):
        from reportlab.lib.colors import HexColor
        return HexColor(f'#{value}')

    name_align = TA_CENTER if theme.name_align == 'center' else TA_LEFT
    base_size = 9.5 if theme.tight else 10
    styles = {
        'name': ParagraphStyle(
            'name',
            fontName=font,
            fontSize=theme.name_size / 2,
            leading=theme.name_size / 2 + 6,
            textColor=hex_color(theme.heading_color),
            alignment=name_align,
            spaceAfter=2,
        ),
        'meta': ParagraphStyle(
            'meta',
            fontName=font,
            fontSize=base_size - 1,
            leading=base_size + 2,
            textColor=hex_color('6B7280'),
            alignment=name_align,
            spaceAfter=4,
        ),
        'heading': ParagraphStyle(
            'heading',
            fontName=font,
            fontSize=theme.heading_size / 2 + 0.5,
            leading=theme.heading_size / 2 + 5,
            textColor=hex_color(theme.heading_color),
            spaceBefore=6 if theme.tight else 10,
            spaceAfter=3,
            keepWithNext=True,
        ),
        'sub': ParagraphStyle(
            'sub',
            fontName=font,
            fontSize=base_size + 0.5,
            leading=base_size + 4,
            textColor=hex_color(theme.heading_color),
            spaceBefore=3,
            spaceAfter=1,
            keepWithNext=True,
        ),
        'text': ParagraphStyle(
            'text',
            fontName=font,
            fontSize=base_size,
            leading=base_size + 4,
            textColor=hex_color(theme.text_color),
            spaceAfter=1,
            wordWrap='CJK',
        ),
        'bullet': ParagraphStyle(
            'bullet',
            fontName=font,
            fontSize=base_size,
            leading=base_size + 4,
            leftIndent=10,
            firstLineIndent=0,
            textColor=hex_color(theme.text_color),
            spaceAfter=1,
            wordWrap='CJK',
        ),
    }

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=(12 if theme.tight else 16) * mm,
        rightMargin=(12 if theme.tight else 16) * mm,
        topMargin=(12 if theme.tight else 15) * mm,
        bottomMargin=(12 if theme.tight else 15) * mm,
        title=data.basics.name or 'resume',
    )
    story = []
    for kind, text in structure_to_lines(data, theme):
        if kind == 'gap':
            story.append(Spacer(1, 3 if theme.tight else 6))
            continue
        payload = escape(text).replace('\n', '<br/>')
        if kind == 'bullet':
            payload = f'{theme.bullet_marker}{payload}'
        story.append(Paragraph(payload, styles.get(kind, styles['text'])))
        if kind == 'name' and theme.key == 'modern':
            story.append(
                HRFlowable(
                    width='100%',
                    thickness=1.2,
                    color=hex_color(theme.accent),
                    spaceBefore=4,
                    spaceAfter=6,
                )
            )
    doc.build(story)
    return buf.getvalue()


def export_bytes(
    data: StructuredResume,
    fmt: str,
    filename: str,
    style: str | None = None,
) -> tuple[bytes, str, str]:
    """返回 (content, media_type, download_filename)。"""
    stem = _safe_filename(filename)
    theme = resolve_style(style)
    fmt = (fmt or 'docx').lower()
    suffix = f'-{theme.key}' if theme.key != 'classic' else ''
    if fmt == 'docx':
        return export_docx(data, theme.key), (
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ), f'{stem}{suffix}.docx'
    if fmt == 'pdf':
        return export_pdf(data, theme.key), 'application/pdf', f'{stem}{suffix}.pdf'
    raise ValueError('不支持的导出格式，请使用 docx 或 pdf')
