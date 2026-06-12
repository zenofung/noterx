FROM python:3.11-slim

# === [优化 1] 将 Debian 系统软件源替换为阿里云镜像，解决 apt-get 卡顿超时问题 ===
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
        sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources; \
    fi && \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list && \
        sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list; \
    fi

# Install system dependencies (ffmpeg, libgl1 for OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy requirements first to leverage Docker build cache
COPY backend/requirements.txt ./backend/

# === [优化 3] 跳过 Playwright 自带浏览器下载（镜像源不全，经常 404），改用系统 chromium ===
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# === [优化 2] 为 pip 指定阿里云镜像源，极速下载 Python 依赖包 ===
RUN pip install --no-cache-dir -r backend/requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# Install Chromium from system apt (阿里云镜像，速度快且稳定，不依赖 Playwright CDN)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/* \
    && (which chromium && echo "chromium found at: $(which chromium)") \
       || (which chromium-browser && echo "chromium-browser found at: $(which chromium-browser)") \
       || (echo "ERROR: chromium not found!" && exit 1)

# Copy the rest of backend, scripts, and docs
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Expose backend port
EXPOSE 8000

# Start command: runs database init scripts, then starts the FastAPI server
CMD python scripts/init_db.py && \
    python scripts/seed_data.py && \
    python scripts/compute_baseline.py && \
    cd backend && \
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000