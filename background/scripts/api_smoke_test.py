# -*- coding: utf-8 -*-
"""后端全接口冒烟测试：覆盖 OpenAPI 中全部 40 个操作。

按业务分组顺序执行（先建知识库，再依赖它的接口），最后清理数据。
标记 [LLM] 的接口会真实调用大模型。
"""

import json
import sys
import time

import httpx

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://127.0.0.1:8000/api/v1"
results = []
TOKEN = None


def rec(group, name, ok, detail="", elapsed=None):
    mark = "PASS" if ok else "FAIL"
    t = f" ({elapsed:.2f}s)" if elapsed is not None else ""
    results.append((group, name, ok, detail, elapsed))
    print(f"  [{mark}] {name}{t}" + (f"  <- {detail}" if detail and not ok else ""))


def hdr():
    return {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}


def call(group, method, path, *, expect=(200, 201), note="", timeout=30, **kw):
    t0 = time.time()
    wanted = expect if isinstance(expect, (tuple, list, set)) else (expect,)
    try:
        r = httpx.request(method, BASE + path, timeout=timeout, **kw)
        el = time.time() - t0
        ok = r.status_code in wanted
        detail = "" if ok else f"HTTP {r.status_code}: {r.text[:180]}"
        rec(group, f"{method} {path} {note}".strip(), ok, detail, el)
        if not ok:
            return None
        ct = r.headers.get("content-type", "")
        return r.json() if "json" in ct else r.text
    except Exception as e:
        el = time.time() - t0
        rec(group, f"{method} {path} {note}".strip(), False, f"{type(e).__name__}: {e}", el)
        return None


print("=" * 68)
print("后端全接口测试")
print("=" * 68)

# ---------- 1. 健康检查 ----------
print("\n[1] 健康检查")
call("health", "GET", "/health")
call("health", "GET", "/health/ready")

# ---------- 2. 认证 ----------
print("\n[2] 认证")
email = f"apitest{int(time.time())}@test.com"
pwd = "Passw0rd!123"
call("auth", "POST", "/auth/register", json={"name": "接口测试", "email": email, "password": pwd})
r = call("auth", "POST", "/auth/login", json={"email": email, "password": pwd})
if r:
    TOKEN = (r.get("data") or r).get("access_token") or r.get("access_token")
call("auth", "GET", "/auth/me", headers=hdr())
call("auth", "POST", "/auth/logout", headers=hdr())
# 登出后重新登录，供后续接口使用
r = call("auth", "POST", "/auth/login", note="(重新登录)", json={"email": email, "password": pwd})
if r:
    TOKEN = (r.get("data") or r).get("access_token") or r.get("access_token")

if not TOKEN:
    print("\n!! 未能获取 token，后续依赖鉴权的接口无法测试")
    sys.exit(1)

# ---------- 3. 知识库 ----------
print("\n[3] 知识库")
r = call("knowledge", "POST", "/knowledge", headers=hdr(),
         json={"name": "接口测试库", "description": "全接口冒烟测试"})
KB = ((r or {}).get("data") or {}).get("id")
print(f"      知识库 ID = {KB}")
call("knowledge", "GET", "/knowledge", headers=hdr())
call("knowledge", "GET", f"/knowledge/{KB}", headers=hdr())
call("knowledge", "PUT", f"/knowledge/{KB}", headers=hdr(),
     json={"name": "接口测试库-已改名", "description": "已更新"})
call("knowledge", "POST", "/knowledge/search", headers=hdr(), json={"query": "接口测试"})

# ---------- 4. 文档 ----------
print("\n[4] 文档（Milvus 未启动，预期降级为 keyword_only）")
doc_txt = "TCP 三次握手：客户端发送 SYN，服务端回复 SYN+ACK，客户端再发送 ACK。\nJVM 逃逸分析用于判断对象是否逃逸出方法作用域。"
with open("_apitest_doc.txt", "w", encoding="utf-8") as fh:
    fh.write(doc_txt)
with open("_apitest_doc.txt", "rb") as fh:
    r = call("document", "POST", "/document/upload", headers=hdr(), params={"knowledge_id": KB},
             files={"file": ("_apitest_doc.txt", fh, "text/plain")}, timeout=120)
DOC = ((r or {}).get("data") or {}).get("id")
if r:
    d = (r.get("data") or {})
    print(f"      index_status = {d.get('index_status')}   chunks = {d.get('chunk_count')}")
call("document", "GET", "/document", headers=hdr(), params={"knowledge_id": KB})
call("document", "GET", f"/document/{DOC}", headers=hdr())
call("document", "PUT", f"/document/{DOC}", headers=hdr(), json={"enabled": False})
call("document", "PUT", f"/document/{DOC}", note="(重新启用)", headers=hdr(), json={"enabled": True})
call("document", "DELETE", f"/document/{DOC}", headers=hdr())

# ---------- 5. 题库 ----------
print("\n[5] 题库")
r = call("question", "POST", "/questions/import", headers=hdr(), params={"knowledge_id": KB},
         json={"questions": [{"question": "什么是 TCP 三次握手？",
                              "answer": "客户端 SYN，服务端 SYN+ACK，客户端 ACK。",
                              "category": "网络", "difficulty": "easy",
                              "keywords": ["TCP", "三次握手"]}]})
QID = None
r2 = call("question", "GET", "/questions", headers=hdr(), params={"knowledge_id": KB})
if r2:
    items = (r2.get("data") or [])
    if isinstance(items, dict):
        items = items.get("items") or items.get("questions") or []
    if items:
        QID = items[0].get("id")
        print(f"      题目 ID = {QID}")
call("question", "GET", f"/questions/{QID}", headers=hdr())

# ---------- 6. 对话 ----------
print("\n[6] 对话")
r = call("conversation", "POST", "/conversations", headers=hdr(), params={"knowledge_id": KB},
         json={"title": "接口测试会话"})
CONV = ((r or {}).get("data") or {}).get("id")
print(f"      会话 ID = {CONV}")
call("conversation", "GET", "/conversations", headers=hdr(), params={"knowledge_id": KB})
call("conversation", "GET", f"/conversations/{CONV}", headers=hdr())
call("conversation", "PUT", f"/conversations/{CONV}", headers=hdr(), json={"title": "已改名会话"})
call("conversation", "POST", f"/conversations/{CONV}/messages", headers=hdr(),
     params={"role": "user", "content": "测试消息", "citations": "[]"})
call("conversation", "GET", f"/conversations/{CONV}/messages", headers=hdr())

# ---------- 7. 练习与引用统计 ----------
print("\n[7] 练习与引用统计")
call("practice", "GET", "/practice/stats", headers=hdr(), params={"knowledge_id": KB})
call("citation", "GET", "/citations/stats", headers=hdr(), params={"knowledge_id": KB})

# ---------- 8. LLM 接口 ----------
print("\n[8] LLM 接口（真实调用大模型，耗时较长）")
call("ai", "POST", "/ai/generate", note="[LLM]", headers=hdr(),
     json={"action": "summary", "title": "TCP 三次握手", "content": doc_txt}, timeout=180)
if QID:
    call("practice", "POST", "/practice/evaluate", note="[LLM]", headers=hdr(),
         json={"question_id": QID, "user_answer": "客户端发 SYN，服务端回 SYN+ACK，客户端再回 ACK。"},
         timeout=180)

# chat：SSE 流式
print("\n      [chat] POST /chat [LLM] (SSE)")
try:
    t0 = time.time()
    events = {"delta": 0, "citations": 0, "error": 0, "done": False}
    with httpx.stream("POST", BASE + "/chat", headers=hdr(), timeout=180,
                      json={"conversation_id": CONV, "question": "什么是 TCP 三次握手？",
                            "enable_search": True, "mode": "question",
                            "messages": [{"role": "user", "content": "什么是 TCP 三次握手？"}]}) as resp:
        assert resp.status_code == 200, f"HTTP {resp.status_code}"
        for line in resp.iter_lines():
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                events["done"] = True
                continue
            try:
                obj = json.loads(payload)
            except ValueError:
                continue
            t = obj.get("type")
            if t == "delta":
                events["delta"] += 1
            elif t == "citations":
                events["citations"] += 1
            elif t == "error":
                events["error"] += 1
    ok = events["done"] and events["delta"] > 0 and events["error"] == 0
    rec("chat", "POST /chat [LLM] (SSE)", ok,
        f"delta={events['delta']} citations={events['citations']} error={events['error']} done={events['done']}",
        time.time() - t0)
    print(f"          delta 事件 {events['delta']} 个, citations {events['citations']} 个, [DONE]={events['done']}")
except Exception as e:
    rec("chat", "POST /chat [LLM] (SSE)", False, f"{type(e).__name__}: {e}")

# ---------- 9. 简历 ----------
print("\n[9] 简历模块（上传会调用 2 次 LLM）")
resume_txt = """张三
电话：13800000000  邮箱：zhangsan@test.com

教育经历
湖北大学 计算机科学与技术 2023.09-2027.06

项目经历
AI 面试知识库平台：使用 Next.js 与 FastAPI 构建 RAG 问答系统。
"""
with open("_apitest_resume.txt", "w", encoding="utf-8") as fh:
    fh.write(resume_txt)
with open("_apitest_resume.txt", "rb") as fh:
    r = call("resume", "POST", "/resumes/upload", note="[LLM]", headers=hdr(),
             files={"file": ("_apitest_resume.txt", fh, "text/plain")}, timeout=240)
RES = ((r or {}).get("data") or {}).get("id")
print(f"      简历 ID = {RES}")
call("resume", "GET", "/resumes", headers=hdr())
call("resume", "GET", f"/resumes/{RES}", headers=hdr())
call("resume", "POST", f"/resumes/{RES}/structure/parse", note="[LLM]", headers=hdr(), timeout=240)
call("resume", "GET", f"/resumes/{RES}/export", headers=hdr(), timeout=60)
call("resume", "PUT", f"/resumes/{RES}/structure", headers=hdr(),
     json={"structured": {"basics": {"name": "张三", "phone": "13800000000",
                                     "email": "zhangsan@test.com"}}})
call("resume", "DELETE", f"/resumes/{RES}", headers=hdr())

# ---------- 10. 清理 ----------
print("\n[10] 清理测试数据")
if QID:
    call("question", "DELETE", f"/questions/{QID}", headers=hdr())
call("conversation", "DELETE", f"/conversations/{CONV}", headers=hdr())
call("knowledge", "DELETE", f"/knowledge/{KB}", headers=hdr())

# ---------- 汇总 ----------
passed = sum(1 for x in results if x[2])
failed = [x for x in results if not x[2]]
print("\n" + "=" * 68)
print(f"结果：{passed}/{len(results)} 通过")
print("=" * 68)
if failed:
    print("\n失败明细：")
    for g, n, _, d, _ in failed:
        print(f"  [{g}] {n}\n        {d}")

by_group = {}
for g, n, ok, _, _ in results:
    a, b = by_group.get(g, (0, 0))
    by_group[g] = (a + (1 if ok else 0), b + 1)
print("\n分组统计：")
for g in sorted(by_group):
    a, b = by_group[g]
    flag = "OK  " if a == b else "!!  "
    print(f"  {flag}{g:<14} {a}/{b}")
