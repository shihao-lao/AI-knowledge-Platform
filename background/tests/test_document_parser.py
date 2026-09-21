"""Exercise real upload formats without network or model dependencies."""
from io import BytesIO
from zipfile import ZipFile

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.etl.parser import DocumentParser


def test_markdown_with_generic_mime(tmp_path):
    data = '# Redis\n缓存与持久化'.encode()
    parser = DocumentParser()
    assert parser.parse_bytes(data, 'notes.MD', 'application/octet-stream').text == data.decode()
    path = tmp_path / 'notes.markdown'
    path.write_bytes(data)
    assert parser.parse_file(path).text == data.decode()


def test_docx_paragraphs_and_tables():
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        archive.writestr('word/document.xml', '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:r><w:t>Redis</w:t></w:r><w:r><w:t> 缓存</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>持久化</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        </w:body></w:document>''')
    parsed = DocumentParser().parse_bytes(output.getvalue(), 'notes.docx', 'application/octet-stream')
    assert 'Redis 缓存' in parsed.text
    assert '持久化' in parsed.text


@pytest.mark.parametrize(('filename', 'data', 'message'), [
    ('empty.txt', b' \n\t', '没有可提取的文本'),
    ('old.doc', b'binary', '不支持'),
    ('page.html', b'<h1>hello</h1>', '不支持'),
    ('broken.docx', b'not a zip', 'Word'),
    ('broken.pdf', b'not a pdf', 'PDF'),
])
def test_invalid_uploads_are_rejected(filename, data, message):
    with pytest.raises(ValueError, match=message):
        DocumentParser().parse_bytes(data, filename, 'application/octet-stream')


def test_pdf_without_text_requests_ocr():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    data = BytesIO()
    writer.write(data)
    with pytest.raises(ValueError, match='OCR'):
        DocumentParser().parse_bytes(data.getvalue(), 'scan.pdf', 'application/pdf')


def test_pdf_text_layer():
    writer = PdfWriter()
    page = writer.add_blank_page(width=100, height=100)
    stream = DecodedStreamObject()
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
                             NameObject('/Subtype'): NameObject('/Type1'),
                             NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({
        NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
    stream.set_data(b'BT /F1 12 Tf 10 50 Td (Redis persistence) Tj ET')
    page[NameObject('/Contents')] = stream
    data = BytesIO()
    writer.write(data)
    assert 'Redis persistence' in DocumentParser().parse_bytes(data.getvalue(), 'text.pdf', None).text
