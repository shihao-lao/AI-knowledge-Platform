"""简历解析、编辑与导出应保留源栏目和内容。"""

import io
import zipfile
from xml.etree import ElementTree as ET

from app.infrastructure.llm.resume_structure import heuristic_or_empty
from app.models.resume_structure import StructuredResume
from app.services.resume_export import export_docx, export_pdf, structure_to_lines


SOURCE = """张三
前端工程师
邮箱：resume@example.com
专业技能
前端：React, TypeScript
项目经验
项目名称：知识平台
简介：可编辑的知识管理平台
- 实现检索与引用
教育经历
2020.09-2024.06 示例大学 本科
开源贡献
维护开源组件，修复键盘访问问题。
自我评价
重视协作和代码质量。
"""


def test_parse_preserves_source_sections_and_custom_content():
    data = heuristic_or_empty(SOURCE)
    lines = structure_to_lines(data)
    headings = [text for kind, text in lines if kind == 'heading']
    assert headings == ['专业技能', '项目经验', '教育经历', '开源贡献', '自我评价']
    assert any('修复键盘访问问题' in text for _, text in lines)
    assert data.basics.name == '张三'
    assert '专业技能' not in data.basics.summary


def test_edit_save_and_export_keep_order_titles_multiline_and_custom_content():
    data = StructuredResume.model_validate({
        'basics': {'name': '测试用户', 'summary': '第一行\n第二行'},
        'skills': [{'category': '前端', 'items': ['React']}],
        'education': [{'school': '示例大学'}],
        'custom_sections': [{'id': 'custom-1', 'title': '开源贡献', 'content': '修改后的贡献\n保留第二行'}],
        'layout': {'sections': [
            {'key': 'skills', 'title': '专业能力'},
            {'key': 'custom-1', 'title': '开源贡献'},
            {'key': 'education', 'title': '学习经历'},
            {'key': 'summary', 'title': '个人简介'},
        ]},
    })
    # 模拟 API 保存后重载。
    data = StructuredResume.model_validate(data.model_dump())
    docx = export_docx(data)
    with zipfile.ZipFile(io.BytesIO(docx)) as archive:
        root = ET.fromstring(archive.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    text = '\n'.join(t.text or '' for t in root.findall('.//w:t', ns))
    assert text.index('专业能力') < text.index('开源贡献') < text.index('学习经历') < text.index('个人简介')
    assert '修改后的贡献' in text
    assert root.findall('.//w:br', ns), 'Word 必须保留多行文本换行'


def test_pdf_keeps_custom_content_and_section_order():
    from pypdf import PdfReader

    data = heuristic_or_empty(SOURCE)
    reader = PdfReader(io.BytesIO(export_pdf(data)))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert '修复键盘访问问题' in text
    assert text.index('专业技能') < text.index('项目经验') < text.index('教育经历')


def test_heading_is_not_used_as_job_title():
    data = heuristic_or_empty('张三\n教育背景\n示例大学 本科\n专业技能\nReact, TypeScript')
    assert data.basics.title == ''


def test_fallback_does_not_drop_long_skill_descriptions_or_bullets():
    skill = '熟练掌握 React 渲染机制以及复杂业务状态设计，能够定位并解决实际项目中的性能问题'
    bullets = [f'实现第{i}项业务能力并提供完整交付记录' for i in range(12)]
    data = heuristic_or_empty('张三\n前端工程师\n专业技能\n' + skill + '\n项目经历\n项目名称：平台\n' + '\n'.join(bullets))
    exported = '\n'.join(text for _, text in structure_to_lines(data))
    for bullet in bullets:
        assert bullet in exported
    assert '复杂业务状态设计' in exported
