# -*- coding: utf-8 -*-
"""Smoke: upload DOCX -> tool parse -> (AI or heuristic) analysis response."""
from __future__ import annotations

import io
import zipfile
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000/api/v1"


def register_and_login(email: str, password: str) -> str:
    req = urllib.request.Request(
        f"{BASE}/auth/register",
        data=json.dumps({"name": "简历测试", "email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code not in (200, 201, 400, 409):
            raise
    req = urllib.request.Request(
        f"{BASE}/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
    return body.get("data", {}).get("accessToken") or body.get("accessToken") or body.get("access_token")


def build_docx() -> bytes:
    doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>王五 全栈工程师</w:t></w:r></w:p>
    <w:p><w:r><w:t>项目：重构知识库检索，召回率提升 25%。技能 Python React PostgreSQL。</w:t></w:r></w:p>
  </w:body>
</w:document>
"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", doc_xml)
        z.writestr("[Content_Types].xml", "<Types/>")
    return buf.getvalue()


def upload(token: str, data: bytes, filename: str) -> dict:
    boundary = "----ResumeSmokeBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE}/resumes/upload",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    token = register_and_login("resume-smoke@example.com", "Passw0rd!23")
    assert token, "login failed"
    result = upload(token, build_docx(), "cv.docx")
    data = result.get("data") or result
    print(json.dumps({k: data.get(k) for k in ("id", "filename", "file_size", "score")}, ensure_ascii=False))
    assert data.get("file_size") is not None and data.get("file_size") > 0
    assert isinstance(data.get("score"), int)
    analysis = data.get("analysis") or ""
    assert analysis, "empty analysis"
    print("--- analysis head ---")
    print(analysis[:400])
    assert ("总评" in analysis) or ("简历分析" in analysis)
    print("OK: upload -> parse -> AI/heuristic analysis")


if __name__ == "__main__":
    main()
