# 简历分析与可视化编辑

## 使用流程

1. 在 `/resumes` 上传 PDF、DOCX、Markdown 或 UTF-8 TXT。
2. 解析结果自动填入基本信息、教育、工作、项目、技能、证书和自定义栏目。
3. 在“栏目名称与顺序”中修改标题或上下移动栏目；在表单里修改内容。
4. 对照“原文对照”和实时预览检查识别结果。自定义栏目支持多行文本。
5. 选择经典、紧凑或现代样式，导出 PDF 或 Word。导出前会自动保存当前修改，保存失败则停止导出。

关闭、切换简历、上传新文件以及点击站内导航时会提示未保存修改；刷新或关闭浏览器由浏览器提示。
重新解析会覆盖已保存的编辑内容，需要确认。历史记录的正文若曾被截断，重新解析优先读取仍保留的原上传文件。

## 格式与内容保留

导出使用统一排版，并保留识别出的原栏目名称、顺序和内容。未映射到标准字段的栏目独立保存，抽取遗漏的原文补入可编辑内容。
常见中英文栏目标题、Markdown 标题和重复栏目均可保留。纯文本中的不常见标题仍可能需要人工调整；AI 字段抽取也应与原文核对。
原 PDF/Word 的照片、字体、颜色、表格和精确分页不在本次格式保留范围内。
实时预览反映内容、栏目和样式，具体分页以导出文件为准；紧凑样式不承诺所有内容都在一页内。

PDF 优先嵌入中文字体。在 Linux 等环境中可以设置后端 `RESUME_PDF_FONT`，指向支持中文的 TrueType 字体；无可用字体时使用 ReportLab 的中文 CID 字体。

## 验证

```powershell
python -m pytest background/tests/test_resume_roundtrip.py background/tests/test_resume_api_roundtrip.py background/tests/test_document_parser.py -q -p no:cacheprovider --basetemp=.pytest-resume
node checks/resume-regression.mjs
npx tsc --noEmit
npx eslint app/resumes/page.tsx components/resume-structure-editor.tsx components/resume-preview.tsx lib/resume-layout.ts lib/api-client.ts
```

后端测试使用独立 SQLite 和合成简历，不调用外部模型。涵盖原栏目顺序、自定义内容、多行换行、长正文、历史正文恢复、保存重载、导出和资源归属。
前端回归涵盖响应字段转换、多行保存、无效响应和上传超时。

本次另外通过本地服务与隔离测试账号验证了真实模型解析、浏览器自动回填、编辑、改名、排序、未保存保护和导出前自动保存。
三种 PDF 样式已渲染检查。DOCX 已验证结构和内容换行；当前本机没有 LibreOffice，尚未完成 DOCX 逐页视觉检查。
