FROM python:3.9-slim

# === [优化 1] 将 Debian 系统软件源替换为阿里云镜像，解决 apt-get 卡顿超时问题 ===
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

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

# === [优化 2] 为 pip 指定阿里云镜像源，极速下载 Python 依赖包 ===
RUN pip install --no-cache-dir -r backend/requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# === [优化 3] 设置国内下载节点，解决 Playwright 下载 Chromium 浏览器内核超时的问题 ===
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/

# Install Playwright browser and system libs inside the container
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy the rest of backend and scripts
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# Expose backend port
EXPOSE 8000

# Start command: runs database init scripts, then starts the FastAPI server
CMD python scripts/init_db.py && \
    python scripts/seed_data.py && \
    python scripts/compute_baseline.py && \
    cd backend && \
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000