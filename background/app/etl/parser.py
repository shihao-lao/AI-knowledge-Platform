# -*- coding: utf-8 -*-
"""文档解析器：按 MIME 类型选择解析策略。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree

from loguru import logger


@dataclass
class ParsedDocument:
    """解析后的纯文本与元数据。"""

    text: str
    mime_type: str
    meta: dict[str, str]


class DocumentParser:
    """支持 UTF-8 文本、Markdown、DOCX 正文/表格和有文本层的 PDF。"""

    def __init__(self, max_chars: int = 500_000) -> None:
        self._max_chars = max_chars

    def parse_file(self, path: Path, mime_type: str | None = None) -> ParsedDocument:
        """从文件路径解析。"""
        return self.parse_bytes(path.read_bytes(), path.name, mime_type)

    def parse_bytes(self, data: bytes, filename: str, mime_type: str | None) -> ParsedDocument:
        """从内存字节解析。"""
        mime = mime_type or "application/octet-stream"
        suffix = Path(filename).suffix.lower()
        if suffix in {".txt", ".md", ".markdown"}:
            try:
                text = data.decode("utf-8-sig")
            except UnicodeDecodeError as exc:
                raise ValueError("文本编码不支持，请另存为 UTF-8 后上传") from exc
            parsed = ParsedDocument(text=text[: self._max_chars], mime_type=mime, meta={})
        elif suffix == ".docx":
            parsed = self._parse_docx(data, mime)
        elif suffix == ".pdf":
            try:
                parsed = self._parse_pdf(data, mime)
            except Exception as exc:
                raise ValueError("PDF 读取失败，请确认文件完整且未加密") from exc
            if not parsed.text.strip():
                raise ValueError("PDF 没有可提取的文本，扫描件请先进行 OCR 识别后上传")
        else:
            raise ValueError("不支持此文件格式，请上传 TXT、Markdown、DOCX 或 PDF；旧版 DOC 请先另存为 DOCX")
        if not parsed.text.strip():
            raise ValueError("文档没有可提取的文本，请检查内容；图片文档请先进行 OCR 识别")
        return parsed

    def _parse_docx(self, data: bytes, mime: str) -> ParsedDocument:
        """读取 OOXML 正文，不解压文件到磁盘，限制展开后的 XML 大小。"""
        try:
            with ZipFile(BytesIO(data)) as archive:
                info = archive.getinfo("word/document.xml")
                if info.file_size > 20 * 1024 * 1024:
                    raise ValueError("Word 正文过大，请拆分后上传")
                xml = archive.read(info)
            if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                raise ValueError("Word 文件包含不支持的 XML 声明")
            root = ElementTree.fromstring(xml)
            ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
            paragraphs = []
            for paragraph in root.iter(f"{ns}p"):
                paragraphs.append("".join(
                    (node.text or "") if node.tag == f"{ns}t" else
                    "\t" if node.tag == f"{ns}tab" else "\n" if node.tag in {f"{ns}br", f"{ns}cr"} else ""
                    for node in paragraph.iter()
                ))
            return ParsedDocument("\n".join(paragraphs)[: self._max_chars], mime, {})
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Word 读取失败，请确认上传的是完整的 DOCX 文件") from exc

    def _parse_pdf(self, data: bytes, mime: str) -> ParsedDocument:
        """使用 pypdf 抽取文本。"""
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            logger.exception("未安装 pypdf: {}", exc)
            raise

        import io

        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception as exc:
                logger.warning("单页 PDF 抽取失败: {}", exc)

        text = "\n".join(parts)[: self._max_chars]
        return ParsedDocument(text=text, mime_type=mime, meta={"pages": str(len(reader.pages))})
