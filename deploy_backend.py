# -*- coding: utf-8 -*-
"""
Deploy backend to BaoTa server + upload frontend dist.
Usage: python deploy_backend.py
"""
import os, sys, tarfile, io, time
import paramiko

HOST = "123.57.193.103"
USER = "root"
PASS = "#,dRm5$nLbsfPQs"
REMOTE_DIR = "/opt/noterx"
FRONTEND_DIR = "/www/wwwroot/noterx.muran.tech"

# -- helper --
def run(ssh, cmd, check=True):
    print(f"   $ {cmd[:120]}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if check and code != 0:
        print(f"   FAIL (exit {code}): {err[:300]}")
        sys.exit(1)
    if out.strip():
        for line in out.strip().split("\n")[:5]:
            print(f"     {line}")
    return out, err, code

# ============ 1. Connect ============
print(f"[1/6] Connecting to {HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=15)
sftp = ssh.open_sftp()
print("  OK")

# ============ 2. Pack ============
print("[2/6] Packing project...")
buf = io.BytesIO()
root = os.path.dirname(os.path.abspath(__file__))
with tarfile.open(fileobj=buf, mode="w:gz") as tar:
    for folder in ["backend", "scripts", "docs"]:
        p = os.path.join(root, folder)
        if os.path.isdir(p):
            # skip venv, __pycache__, .env (we upload .env separately)
            tar.add(p, arcname=folder,
                    filter=lambda info: None if "__pycache__" in info.name or "venv" in info.name or info.name.endswith(".pyc") else info)
    # frontend dist
    dist = os.path.join(root, "frontend", "dist")
    if os.path.isdir(dist):
        tar.add(dist, arcname="frontend_dist")
    # Dockerfile, docker-compose.yml, cookies.txt
    for f in ["Dockerfile", "docker-compose.yml", "cookies.txt"]:
        p = os.path.join(root, f)
        if os.path.isfile(p):
            tar.add(p, arcname=f)
buf.seek(0)
print(f"  Packed {len(buf.getvalue())/1024:.0f} KB")

# ============ 3. Upload ============
remote_tar = "/tmp/noterx_deploy.tar.gz"
print("[3/6] Uploading...")
sftp.putfo(buf, remote_tar)
print("  OK")

# ============ 4. Extract + Frontend ============
print("[4/6] Extracting...")
run(ssh, f"mkdir -p {REMOTE_DIR}")
run(ssh, f"cd {REMOTE_DIR} && tar xzf {remote_tar}")
run(ssh, f"rm -f {remote_tar}")

# Copy frontend dist to BaoTa site
print("  Copying frontend dist to BaoTa site...")
run(ssh, f"mkdir -p {FRONTEND_DIR}")
run(ssh, f"rm -rf {FRONTEND_DIR}/*")
run(ssh, f"cp -r {REMOTE_DIR}/frontend_dist/* {FRONTEND_DIR}/")
run(ssh, f"rm -rf {REMOTE_DIR}/frontend_dist")
print("  Frontend OK")

# ============ 5. Docker build and start ============
print("[5/6] Building and starting Docker container...")

# Upload .env
print("  Uploading .env...")
local_env = os.path.join(root, ".env")
if os.path.isfile(local_env):
    sftp.put(local_env, f"{REMOTE_DIR}/backend/.env")
    print("  .env uploaded")

# Check if docker command is available
out, _, _ = run(ssh, "which docker", check=False)
if not out.strip():
    print("  [Error] Docker not found on the server! Please install Docker first using the deployment guide.")
    sys.exit(1)

# Build and start container
run(ssh, f"cd {REMOTE_DIR} && docker compose down", check=False)
run(ssh, f"cd {REMOTE_DIR} && docker compose up -d --build")

# ============ 6. Verification ============
print("[6/6] Verifying status...")
time.sleep(5)
run(ssh, f"cd {REMOTE_DIR} && docker compose ps", check=False)

# Health check
print("  Running health check...")
out, _, _ = run(ssh, "curl -s http://127.0.0.1:8000/api/health", check=False)
print(f"  Response: {out.strip()}")

print("")
print("=" * 50)
print("DEPLOY DONE!")
print(f"  Backend API (Docker): http://127.0.0.1:8000")
print(f"  Frontend:             {FRONTEND_DIR}")
print(f"  Admin:                https://noterx.muran.tech/admin")
print(f"  Password:             pageone")
print("")
print("Nginx config needed (see below):")
print("""
  location /api/ {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 600s;
  }
  location /admin {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location /terms {
      proxy_pass http://127.0.0.1:8000;
  }
  location /privacy {
      proxy_pass http://127.0.0.1:8000;
  }
""")
print("=" * 50)

sftp.close()
ssh.close()
