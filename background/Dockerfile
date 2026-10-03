# syntax=docker/dockerfile:1
#
# 后端镜像：多阶段构建，运行阶段不含编译工具链。
#
# 构建参数（都可在 docker compose build 时覆盖）：
#   PIP_INDEX_URL         pip 源，默认清华镜像（国内直连 pypi.org 很慢）
#   PYTORCH_FIND_LINKS    torch CPU wheel 的来源，默认阿里云镜像
#   TORCH_VERSION         锁定的 torch 版本
#     —— 必须单独装 CPU 版 torch：PyPI 上 Linux 版 torch 是 CUDA 构建，
#        会连带拉 nvidia-* 依赖，镜像膨胀好几 GB；
#        而 download.pytorch.org 在国内会超时（实测下到 99.9% 断流），
#        所以走阿里云的 pytorch-wheels 镜像 + --find-links。
#   APT_MIRROR            Debian 源，仅在开启中文字体安装时使用
#   INSTALL_CJK_FONT     是否装中文字体（默认否，见下）
#
# 关于中文字体：resume_export 的 _pdf_font() 会依次尝试
#   RESUME_PDF_FONT → Windows 字体 → wqy-zenhei → Noto CJK
# 都找不到时回落到 ReportLab 内置的 STSong-Light（CID 字体），
# 因此**不装系统字体也能正确导出中文 PDF**。默认不装是为了让镜像构建
# 不依赖 Debian 源（国内直连 deb.debian.org 经常超时）。

# ---------- 构建阶段 ----------
FROM python:3.12-slim AS builder

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PYTORCH_FIND_LINKS=https://mirrors.aliyun.com/pytorch-wheels/cpu/
ARG TORCH_VERSION=2.14.0

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    # 镜像站偶发抖动，给足超时与重试，避免大 wheel 下到一半断流
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=8

# 依赖全部装进独立 venv，运行阶段整目录复制过去。
# 这里刻意不装 build-essential：本项目依赖都有 manylinux wheel，
# 装编译器只会让构建慢且依赖外网。若将来某个包需要编译，
# 再把它加回来即可。
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .

# 先装 CPU 版 torch（走 find-links），依赖解析交给清华 PyPI；
# 后面 requirements 里的 sentence-transformers 会复用它。
RUN pip install --index-url "${PIP_INDEX_URL}" \
        --find-links "${PYTORCH_FIND_LINKS}" \
        "torch==${TORCH_VERSION}+cpu" \
    && pip install --index-url "${PIP_INDEX_URL}" -r requirements.txt


# ---------- 运行阶段 ----------
FROM python:3.12-slim AS runtime

ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn
ARG INSTALL_CJK_FONT=false

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/models \
    TZ=Asia/Shanghai

# 可选：装中文字体，让简历 PDF 用 TTF 嵌入而不是 CID 字体
RUN if [ "${INSTALL_CJK_FONT}" = "true" ]; then \
        set -eux; \
        if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
            sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
        fi; \
        if [ -f /etc/apt/sources.list ]; then \
            sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
        fi; \
        apt-get update; \
        apt-get install -y --no-install-recommends fonts-noto-cjk; \
        rm -rf /var/lib/apt/lists/*; \
    fi

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# 先拷依赖清单与迁移脚本，利用层缓存；只改代码时不必重装依赖
COPY alembic.ini pyproject.toml ./
COPY alembic ./alembic
COPY app ./app
COPY scripts ./scripts

# 非 root 运行；uploads 与模型缓存目录需要可写
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/uploads/resumes /models \
    && chown -R appuser:appuser /app /models

USER appuser

EXPOSE 8000

# 用 python 而不是 curl 做健康检查，省掉一个系统包
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"]

# 用 python -m 调用，避免 PATH 差异导致选错解释器；先迁移再启动
CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
