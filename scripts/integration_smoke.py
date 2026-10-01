# -*- coding: utf-8 -*-
"""前后端联调冒烟脚本：注册/登录 → 知识库 → 文档/会话/消息 → 聊天流 → 题库。"""
from __future__ import annotations

import sys
import uuid

import httpx

BASE = "http://127.0.0.1:8000/api/v1"
FRONT = "http://127.0.0.1:3000"
results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail else ""
    print(f"[{mark}] {name}{suffix}", flush=True)


def summarize() -> int:
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [n for n, ok, _ in results if not ok]
    print("\n===== SUMMARY =====", flush=True)
    print(f"total={len(results)} pass={passed} fail={len(failed)}", flush=True)
    if failed:
        print("failed: " + ", ".join(failed), flush=True)
    return 0 if not failed else 1


def main() -> int:
    client = httpx.Client(timeout=90.0, trust_env=False)
    email = f"it_{uuid.uuid4().hex[:8]}@test.local"
    password = "ItPassw0rd!123"
    name = f"it_{uuid.uuid4().hex[:6]}"
    token = None
    kb_id = None
    conv_id = None

    try:
        r = client.get(FRONT, timeout=20)
        record("frontend.homepage", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("frontend.homepage", False, str(e))

    try:
        r = client.get(f"{BASE}/health")
        record("api.health", r.status_code == 200 and r.json().get("status") == "ok", r.text[:120])
    except Exception as e:
        record("api.health", False, str(e))

    try:
        r = client.get(f"{BASE}/health/ready")
        body = r.json()
        record("api.health.ready", r.status_code == 200 and body.get("status") == "ready", r.text[:160])
    except Exception as e:
        record("api.health.ready", False, str(e))

    # register
    try:
        r = client.post(
            f"{BASE}/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        record("auth.register", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("auth.register", False, str(e))

    # login
    try:
        r = client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
        data = r.json()
        token = data.get("access_token") or data.get("accessToken")
        record(
            "auth.login",
            r.status_code == 200 and bool(token),
            f"status={r.status_code} keys={list(data.keys())} has_token={bool(token)}",
        )
    except Exception as e:
        record("auth.login", False, str(e))

    if not token:
        print("无法登录，后续鉴权接口跳过", flush=True)
        return summarize()

    headers = {"Authorization": f"Bearer {token}"}

    try:
        r = client.get(f"{BASE}/auth/me", headers=headers)
        record("auth.me", r.status_code == 200, f"status={r.status_code} body={r.text[:160]}")
    except Exception as e:
        record("auth.me", False, str(e))

    # knowledge create/list/get
    try:
        r = client.post(
            f"{BASE}/knowledge",
            headers=headers,
            json={"name": f"联调知识库-{uuid.uuid4().hex[:6]}", "description": "integration test kb"},
        )
        body = r.json()
        kb = body.get("data") or body
        kb_id = kb.get("id") or kb.get("knowledge_id")
        record(
            "knowledge.create",
            r.status_code in (200, 201) and bool(kb_id),
            f"status={r.status_code} id={kb_id} body={r.text[:180]}",
        )
    except Exception as e:
        record("knowledge.create", False, str(e))

    try:
        r = client.get(f"{BASE}/knowledge", headers=headers)
        record("knowledge.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("knowledge.list", False, str(e))

    if not kb_id:
        print("知识库创建失败，后续跳过", flush=True)
        return summarize()

    try:
        r = client.get(f"{BASE}/knowledge/{kb_id}", headers=headers)
        record("knowledge.get", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("knowledge.get", False, str(e))

    try:
        r = client.get(f"{BASE}/document", headers=headers, params={"knowledge_id": kb_id})
        record("document.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("document.list", False, str(e))

    # conversation create (query knowledge_id + body title)
    try:
        r = client.post(
            f"{BASE}/conversations",
            headers=headers,
            params={"knowledge_id": kb_id},
            json={"title": "联调对话"},
        )
        body = r.json()
        conv = body.get("data") or body
        conv_id = conv.get("id") or conv.get("conversation_id")
        record(
            "conversation.create",
            r.status_code in (200, 201) and bool(conv_id),
            f"status={r.status_code} id={conv_id} body={r.text[:180]}",
        )
    except Exception as e:
        record("conversation.create", False, str(e))

    try:
        r = client.get(f"{BASE}/conversations", headers=headers, params={"knowledge_id": kb_id})
        record("conversation.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("conversation.list", False, str(e))

    if not conv_id:
        print("会话创建失败，消息/聊天跳过", flush=True)
        return summarize()

    try:
        r = client.get(f"{BASE}/conversations/{conv_id}/messages", headers=headers)
        record("conversation.messages.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("conversation.messages.list", False, str(e))

    # message create via query params (matches frontend)
    try:
        r = client.post(
            f"{BASE}/conversations/{conv_id}/messages",
            headers=headers,
            params={
                "role": "user",
                "content": "你好，联调测试消息",
                "citations": "[]",
            },
        )
        record("conversation.message.create", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("conversation.message.create", False, str(e))

    # chat SSE stream (payload matches lib/chat-api.ts)
    try:
        with client.stream(
            "POST",
            f"{BASE}/chat",
            headers=headers,
            json={
                "conversation_id": conv_id,
                "question": "请用一句话介绍你自己",
                "enable_search": True,
                "mode": "question",
                "messages": [{"role": "user", "content": "请用一句话介绍你自己"}],
            },
            timeout=120.0,
        ) as r:
            chunks = []
            for line in r.iter_lines():
                if line:
                    chunks.append(line[:240])
            ok = r.status_code == 200 and len(chunks) > 0
            detail = f"status={r.status_code} lines={len(chunks)} sample={chunks[:8]}"
            record("chat.stream", ok, detail[:600])
    except Exception as e:
        record("chat.stream", False, str(e))

    try:
        r = client.get(f"{BASE}/questions", headers=headers, params={"knowledge_id": kb_id})
        record("questions.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("questions.list", False, str(e))

    try:
        r = client.post(
            f"{BASE}/questions/import",
            headers=headers,
            params={"knowledge_id": kb_id},
            json={
                "questions": [
                    {
                        "category": "基础",
                        "difficulty": "easy",
                        "question": "联调测试题：1+1等于几？",
                        "answer": "2",
                        "keywords": ["加法"],
                        "source": "integration",
                    }
                ]
            },
        )
        record("questions.import", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("questions.import", False, str(e))

    try:
        r = client.get(f"{BASE}/practice/stats", headers=headers, params={"knowledge_id": kb_id})
        record("practice.stats", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("practice.stats", False, str(e))

    try:
        r = client.get(f"{BASE}/resumes", headers=headers)
        record("resumes.list", r.status_code == 200, f"status={r.status_code} body={r.text[:180]}")
    except Exception as e:
        record("resumes.list", False, str(e))

    return summarize()


if __name__ == "__main__":
    sys.exit(main())
