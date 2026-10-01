# -*- coding: utf-8 -*-
"""Ad-hoc verify DocumentParser extracts PDF/DOCX before AI analysis."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from app.etl.parser import DocumentParser

ROOT = Path(__file__).resolve().parents[1]

doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>张三 | 后端工程师</w:t></w:r></w:p>
    <w:p><w:r><w:t>项目经验：主导订单系统重构，QPS 提升 3 倍</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>技能</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Python / FastAPI</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>学历</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>计算机本科</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
"""
buf = BytesIO()
with ZipFile(buf, "w", ZIP_DEFLATED) as z:
    z.writestr("word/document.xml", doc_xml)
    z.writestr("[Content_Types].xml", "<Types/>")
parsed = DocumentParser().parse_bytes(buf.getvalue(), "cv.docx", None)
print("DOCX meta:", parsed.meta)
print(parsed.text)
assert "张三" in parsed.text
assert "Python / FastAPI" in parsed.text
assert "计算机本科" in parsed.text

# Minimal single-page PDF with extractable text
content = b"BT /F1 12 Tf 72 720 Td (Li Si Backend Engineer) Tj ET\nBT /F1 12 Tf 72 700 Td (Project: rebuilt payment service) Tj ET"
stream = b"<< /Length %d >>stream\n" % len(content) + content + b"\nendstream"
objects = [
    b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    b"4 0 obj" + stream + b"endobj\n",
    b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
]
pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for obj in objects:
    offsets.append(len(pdf))
    pdf.extend(obj)
xref_pos = len(pdf)
pdf.extend(b"xref\n0 %d\n" % (len(objects) + 1))
pdf.extend(b"0000000000 65535 f \n")
for off in offsets[1:]:
    pdf.extend(b"%010d 00000 n \n" % off)
pdf.extend(b"trailer<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref_pos))

parsed_pdf = DocumentParser().parse_bytes(bytes(pdf), "cv.pdf", None)
print("PDF meta:", parsed_pdf.meta)
print(parsed_pdf.text)
assert "Li Si" in parsed_pdf.text
print("OK: parse tool extracts PDF/DOCX text before AI analysis")
