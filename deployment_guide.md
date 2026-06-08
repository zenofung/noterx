# NoteRx 生产环境服务器部署与打包指南

本指南详细介绍了如何将 **薯医 NoteRx**（包含前端和视频分析后端）部署到外部可访问的 Linux 服务器上。

---

## 一、服务器环境准备 (Server Requirements)

推荐使用 **Ubuntu 20.04/22.04 LTS** 或 **Debian 11/12** 系统。服务器应准备并安装以下软件及系统级依赖项：

### 1. 系统软件包依赖
由于视频拉片分析需要对视频进行机能抽帧、提取音频并转译，服务器必须安装 `ffmpeg` 以及 OpenCV 图形渲染库。

#### A. 如果使用 Ubuntu / Debian 系统：
```bash
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip ffmpeg libgl1-mesa-glx
```

#### B. 如果使用 CentOS Stream 9 系统：
CentOS Stream 9 的基础源不包含 `ffmpeg`，需要启用 **EPEL** 和 **RPM Fusion** 软件源，并补全 Chromium 运行所需的 X11/GTK 依赖库：
```bash
# 1. 启用 EPEL 源
sudo dnf install -y epel-release

# 2. 启用 RPM Fusion 源
sudo dnf install -y --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-9.noarch.rpm https://mirrors.rpmfusion.org/nonfree/el/rpmfusion-nonfree-release-9.noarch.rpm

# 3. 安装 ffmpeg、Python-pip 以及图形处理和 Playwright 依赖库
sudo dnf install -y python3-pip python3-devel ffmpeg mesa-libGL mesa-libgbm alsa-lib at-spi2-atk atk cups-libs dbus-libs glib2 gtk3 libX11 libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrandr libXrender libXtst libdrm libxshmfence nspr nss pango libxkbcommon
```

*   `ffmpeg` & `ffprobe`: 用于音频分离与视频时长探测（语音转文字 ASR 的核心）。
*   `mesa-libGL` (CentOS) / `libgl1-mesa-glx` (Ubuntu): OpenCV 图形处理核心依赖。
*   `mesa-libgbm` / `alsa-lib` / `gtk3` 等: 无头 Chromium 浏览器渲染与系统接口依赖。

### 2. Node.js 环境 (仅在服务器上构建前端时需要)
若你选择在本地构建前端再上传静态资源（推荐），服务器无需安装 Node.js。若要在服务器构建，建议安装 Node.js 18+。

---

## 二、项目打包步骤 (Packaging Steps)

项目采用**前后端分离**架构，打包可以分为前端静态文件编译和后端源码打包。

### 1. 前端打包
在本地或构建服务器的 `frontend` 目录下运行编译命令，生成生产环境静态文件：
```bash
cd frontend
pnpm install
pnpm run build
```
编译完成后，会在 `frontend` 目录下生成 `dist/` 文件夹。该目录包含所有已编译的 HTML, JS, CSS 和静态资源，后续部署时只需要将 `dist` 目录下的所有文件上传至 Web 服务器静态根目录即可。

### 2. 后端准备
1.  **配置文件**: 准备好生产环境的 `.env` 配置文件，放入 `backend/.env` 中。确保其中包含：
    *   LLM API 密钥（如 `OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 等）。
    *   视频帧分析间隔及设置（可参考 `backend/.env.example`）。
2.  **Cookie 凭证**: 若有抖音/小红书爬取所需的 `cookies.txt`，请将其放置于 `backend/` 目录下，以便 Playwright 爬虫进行身份鉴权。

---

## 三、一键自动化部署 (Automated Deployment)

项目根目录下已准备了专用的自动化部署脚本 [deploy_backend.py](file:///e:/opt/noterx/deploy_backend.py)。该脚本使用 `paramiko` 通过 SSH 自动化打包并部署至服务器。

### 1. 配置脚本
打开 [deploy_backend.py](file:///e:/opt/noterx/deploy_backend.py)，修改顶部的服务器连接配置：
```python
HOST = "您的服务器IP"
USER = "root"  # 具有管理员权限的用户名
PASS = "您的服务器密码"
REMOTE_DIR = "/opt/noterx"  # 后端在服务器上的安装目录
FRONTEND_DIR = "/www/wwwroot/noterx.muran.tech"  # 宝塔或 Nginx 配置的前端静态网站根目录
```

### 2. 运行脚本进行部署
在本地控制台运行以下命令：
```bash
python deploy_backend.py
```
> [!NOTE]
> 运行部署脚本前，请确保已经在本地成功执行了前端打包 `pnpm run build`，因为脚本会自动将本地 `frontend/dist` 压缩并上传至服务器。

### 3. 部署脚本自动完成的操作
运行脚本时，它将依次在服务器上执行以下任务：
1.  **打包并上传**：打包本地 `backend`、`scripts`、`docs` 以及前端打包生成的 `frontend/dist`，并上传至服务器。
2.  **前端部署**：清空服务器上的 `FRONTEND_DIR` 并将解压出来的前端静态资源拷贝进去。
3.  **安装系统软件**：脚本会自动探测包管理器（`apt-get` 或 `dnf`）。在 Ubuntu 下自动安装 `python3-venv`、`python3-pip`、`ffmpeg` 及 `libgl1`；在 CentOS Stream 9 下则自动激活 EPEL、RPM Fusion 源并使用 `dnf` 安装 `ffmpeg`、`python3-devel`、`mesa-libGL` 等依赖。
4.  **构建 Python 虚拟环境**：在 `/opt/noterx/backend/venv` 下创建虚拟环境并升级 pip，接着安装 `requirements.txt` 里的所有 Python 包。
5.  **安装 Playwright 浏览器**（✨ **核心步骤**）：
    *   自动运行 `playwright install chromium` 下载无头浏览器。
    *   自动运行 `playwright install-deps chromium` 下载浏览器运行所需的 Linux 系统动态链接库。
6.  **初始化数据库**：在虚拟环境下运行初始化数据库与 Seed Data 脚本。
7.  **配置 Systemd 系统服务**：在服务器写入守护进程配置文件 `/etc/systemd/system/noterx.service`，并使用 `systemctl` 启动后端 API 服务，支持开机自启。
8.  **健康检查**：向本机的 `http://127.0.0.1:8000/api/health` 发送请求，确认服务已正常跑通。

---

## 四、Nginx 反向代理配置

由于前端静态页面托管在 Web 根目录下，而后端运行在 `127.0.0.1:8000`，你需要配置 Nginx 将 API 路由和相关页面反向代理至后端进程。

在 Nginx 对应网站的虚拟主机配置文件（Server Block）中，加入以下规则：

```nginx
server {
    listen 80;
    server_name noterx.muran.tech; # 改为你的域名或 IP

    # 前端静态目录
    root /www/wwwroot/noterx.muran.tech;
    index index.html;

    # 支持 React React-Router 单页应用的 Fallback 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 禁用缓冲以支持 SSE（Server-Sent Events）进度条推送
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }

    # 后端 Admin 管理界面反向代理
    location /admin {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态服务条款及隐私政策路由
    location /terms {
        proxy_pass http://127.0.0.1:8000;
    }
    location /privacy {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

> [!IMPORTANT]
> 部署时，请务必在 Nginx 的 `/api/` 代理段落中添加 `proxy_buffering off;`。因为短视频拉片分析在处理时会发送 SSE (Server-Sent Events) 消息流给前端汇报“正在读取视频”、“正在生成建议”等状态。若启用了 Nginx 缓冲，状态更新会由于缓存在 Nginx 中而无法实时反馈到前端，导致用户感知不到状态更新。

---

## 五、服务维护与日志 (Systemd)

如果您使用的是传统的 Systemd 部署方案，可以使用以下命令：

*   **查看服务运行状态**：
    ```bash
    systemctl status noterx
    ```
*   **查看实时运行日志**：
    ```bash
    journalctl -u noterx -f -n 100
    ```
*   **重启后端服务**：
    ```bash
    systemctl restart noterx
    ```

---

## 六、使用 Docker 进行容器化部署（强烈推荐，解决 CentOS Stream 9 依赖问题）

由于 CentOS Stream 9 系统的底层软件包库源对多媒体（`ffmpeg`、`libavfilter` 等库）依赖极其严格繁琐（容易遇到 `rubberband` / `ladspa` 依赖报错），且 Playwright 官方对 CentOS 的兼容度不如 Debian/Ubuntu 完善，**极力推荐使用 Docker 部署后端服务**。

使用 Docker，您的服务器**只需要安装 Docker**，完全无需在主机配置 `ffmpeg`、Python 虚拟环境，也无需处理任何动态依赖包错误。

### 1. 在 CentOS Stream 9 安装 Docker & Docker Compose
在服务器运行以下命令安装 Docker 和 Docker Compose 插件：
```bash
# 1. 配置 Docker 官方 YUM 源
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 2. 安装 Docker Engine、CLI 和 Compose 插件
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. 启动服务并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. 部署后端容器
1. 将本地项目代码上传至服务器的 `/opt/noterx` 文件夹中。
2. 确保 `/opt/noterx` 目录下有以下文件：
   * `Dockerfile` (后端构建指令)
   * `docker-compose.yml` (容器编排配置)
   * `backend/.env` (生产环境配置文件)
   * `cookies.txt` (若有，用于抖音爬虫)
3. 在服务器项目根目录 `/opt/noterx` 执行构建与启动：
   ```bash
   docker compose up -d --build
   ```

### 3. 数据持久化与备份
在 `docker-compose.yml` 中，我们配置了挂载卷（Volumes）：
* `./backend/data:/workspace/backend/data`

所有的诊断报告记录（JSON 和 Markdown 格式）、SQLite 数据库文件 `baseline.db` 以及视频下载缓存等数据都会持久化保存在宿主机的 `/opt/noterx/backend/data` 目录中。当您需要更新代码、重新打包或重启容器时，**数据绝不会丢失**。

### 4. 容器日志与维护指令
*   **查看运行日志**：
    ```bash
    docker compose logs -f --tail=100
    ```
*   **重启后端服务**：
    ```bash
    docker compose restart
    ```
*   **停止并释放容器**：
    ```bash
    docker compose down
    ```
