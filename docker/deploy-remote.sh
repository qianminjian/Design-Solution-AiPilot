#!/usr/bin/env bash
# AiDesign 测试验证环境 — 远程部署脚本
# 在服务器（root 或具备 sudo 权限的用户）执行
# 用法：bash deploy-remote.sh
set -euo pipefail

# ── 配置区 ──
AIDESIGN_USER=AiDesign
AIDESIGN_HOME=/home/AiDesign
PROJECT_DIR=${AIDESIGN_HOME}/Design-Solution-AiPilot
DATA_DIR=${AIDESIGN_HOME}/data
DOMAIN=yun.gxjugu.com

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARN:${NC} $*"; }
err() { echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $*" >&2; }

# ── 阶段 1：创建用户与目录 ──
phase1_create_user() {
    log "阶段 1：创建用户与目录"

    if id -u ${AIDESIGN_USER} >/dev/null 2>&1; then
        warn "用户 ${AIDESIGN_USER} 已存在，跳过创建"
    else
        # 创建用户（-m 创建家目录，-s 指定 shell）
        useradd -m -s /bin/bash ${AIDESIGN_USER}
        # 设置密码（仅本地登录用，可禁用密码登录）
        echo '${AIDESIGN_USER}:${AIDESIGN_USER}@2026!' | chpasswd
        log "用户 ${AIDESIGN_USER} 已创建"
    fi

    # 加入 docker 组（无需 sudo 即可使用 docker）
    if ! id -nG ${AIDESIGN_USER} | grep -qw docker; then
        usermod -aG docker ${AIDESIGN_USER}
        log "已将 ${AIDESIGN_USER} 加入 docker 组"
    fi

    # 创建目录
    mkdir -p ${PROJECT_DIR} ${DATA_DIR}/{postgres,minio,chroma}

    # 修改属主
    chown -R ${AIDESIGN_USER}:${AIDESIGN_USER} ${AIDESIGN_HOME}

    log "目录结构准备完成："
    ls -la ${AIDESIGN_HOME}
}

# ── 阶段 2：生成 .env.production ──
phase2_gen_env() {
    log "阶段 2：生成 .env.production"

    # 生成强密钥
    local db_password jwt_secret minio_password chroma_creds

    if [ -f ${PROJECT_DIR}/.env.production ]; then
        warn ".env.production 已存在，跳过生成（如需重新生成请先删除）"
        return 0
    fi

    db_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    jwt_secret=$(openssl rand -hex 32)
    minio_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    chroma_creds="chroma:$(openssl rand -hex 16)"

    cat > ${PROJECT_DIR}/.env.production << EOF
# AiDesign 测试验证环境 — 生产配置
# 由 deploy-remote.sh 自动生成，请勿提交到 Git

# ── 数据库 ──
DB_NAME=aidesign
DB_USER=aidesign
DB_PASSWORD=${db_password}

# ── MinIO ──
S3_ACCESS_KEY=aidesign-admin
S3_SECRET_KEY=${minio_password}
S3_BUCKET_NAME=aidesign-data
S3_REGION=us-east-1

# ── ChromaDB ──
CHROMADB_AUTH_CREDENTIALS=${chroma_creds}

# ── JWT ──
JWT_SECRET=${jwt_secret}
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# ── AI Provider（DeepSeek，国内 LLM） ──
LLM_API_KEY=
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# ── 部署环境 ──
NODE_ENV=production
LOG_LEVEL=info

# ── 域名 ──
PUBLIC_DOMAIN=${DOMAIN}
EOF

    # 仅 AiDesign 用户可读写
    chmod 600 ${PROJECT_DIR}/.env.production
    chown ${AIDESIGN_USER}:${AIDESIGN_USER} ${PROJECT_DIR}/.env.production

    log ".env.production 已生成（权限 600，仅 ${AIDESIGN_USER} 可读）"
}

# ── 阶段 3：启动 Docker Compose ──
phase3_docker_up() {
    log "阶段 3：启动 Docker Compose"

    # 切换到 AiDesign 用户执行后续 docker 命令
    su - ${AIDESIGN_USER} -c "
        cd ${PROJECT_DIR}
        docker compose -f docker/compose.production.yml --env-file .env.production up -d --build
    "

    log "等待服务就绪（最长 3 分钟）..."
    local retries=0
    while [ $retries -lt 18 ]; do
        if docker exec aidesign-web node -e "require('http').request({host:'localhost',port:3000,timeout:2000},r=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1)).on('timeout',()=>process.exit(1)).end()" 2>/dev/null; then
            log "Web 服务已就绪"
            return 0
        fi
        retries=$((retries + 1))
        log "等待中... ($retries/18)"
        sleep 10
    done

    err "Web 服务未在预期时间内就绪，请检查日志："
    docker compose -f ${PROJECT_DIR}/docker/compose.production.yml logs --tail=50
    return 1
}

# ── 阶段 4：配置 Nginx ──
phase4_nginx() {
    log "阶段 4：配置 Nginx 反向代理"

    # 检查 Nginx 是否安装
    if ! command -v nginx >/dev/null 2>&1; then
        err "Nginx 未安装，请先安装：apt install -y nginx 或 yum install -y nginx"
        return 1
    fi

    # 检查 nginx.conf 是否包含 conf.d
    if ! grep -q "include.*conf.d" /etc/nginx/nginx.conf; then
        err "/etc/nginx/nginx.conf 未包含 conf.d，需要 root 手动在 http{} 块内添加：include /etc/nginx/conf.d/*.conf;"
        return 1
    fi
    log "nginx.conf 已包含 conf.d 引用"

    # 创建 certbot 验证目录
    mkdir -p /var/www/certbot
    chown -R nginx:nginx /var/www/certbot 2>/dev/null || true

    # 部署 Nginx 配置
    if [ -f ${PROJECT_DIR}/docker/nginx/yun.gxjugu.com.conf ]; then
        # 先部署 HTTP-only 版本（certbot 申请证书时需要）
        cat > /etc/nginx/conf.d/yun.gxjugu.com-aidesign.conf << 'EOF'
server {
    listen 80;
    server_name yun.gxjugu.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:18070;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Trace-Id $request_id;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        client_max_body_size 500M;
    }
}
EOF
        log "已部署 HTTP-only Nginx 配置（用于证书申请）"
    else
        err "Nginx 配置文件未找到：${PROJECT_DIR}/docker/nginx/yun.gxjugu.com.conf"
        return 1
    fi

    # 测试配置
    if ! nginx -t; then
        err "Nginx 配置语法错误"
        return 1
    fi

    # 重载
    nginx -s reload
    log "Nginx 已重载（HTTP-only 版本）"
}

# ── 阶段 5：申请 Let's Encrypt 证书 ──
phase5_certbot() {
    log "阶段 5：申请 Let's Encrypt 证书"

    # 检查 certbot 是否安装
    if ! command -v certbot >/dev/null 2>&1; then
        warn "certbot 未安装，正在安装..."
        if command -v apt >/dev/null 2>&1; then
            apt update -y
            apt install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            yum install -y certbot python3-certbot-nginx
        else
            err "无法自动安装 certbot，请手动安装后重新运行此阶段"
            return 1
        fi
    fi

    # 申请证书（standalone 模式可能需要先停止 nginx，这里用 webroot 模式）
    if [ -d /etc/letsencrypt/live/${DOMAIN} ]; then
        warn "证书已存在，跳过申请"
    else
        certbot certonly --webroot -w /var/www/certbot \
            -d ${DOMAIN} \
            --non-interactive \
            --agree-tos \
            --email admin@${DOMAIN}

        if [ $? -ne 0 ]; then
            err "证书申请失败，请检查：1) DNS 是否指向本机 2) 80 端口是否被占用 3) 防火墙是否开放 80/443"
            return 1
        fi
    fi

    # 部署完整 Nginx 配置（含 HTTPS）
    if [ -f ${PROJECT_DIR}/docker/nginx/yun.gxjugu.com.conf ]; then
        cp ${PROJECT_DIR}/docker/nginx/yun.gxjugu.com.conf /etc/nginx/conf.d/yun.gxjugu.com-aidesign.conf
        log "已部署完整 Nginx 配置（含 HTTPS）"
    fi

    # 测试与重载
    nginx -t && nginx -s reload
    log "Nginx 已重载（含 HTTPS）"

    # 配置证书自动续期（cron 每天 03:00 检查）
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'nginx -s reload'") | crontab -
        log "已配置证书自动续期 cron"
    fi
}

# ── 阶段 6：连通性验证 ──
phase6_verify() {
    log "阶段 6：连通性验证"

    log "本地容器健康检查："
    for svc in "aidesign-web:3000" "aidesign-bff:3001" "aidesign-core:8080" "aidesign-ai:8000"; do
        local name=${svc%%:*}
        local port=${svc##*:}
        if docker exec ${name} sh -c "wget -qO- http://localhost:${port}/ >/dev/null 2>&1 || curl -f http://localhost:${port}/ >/dev/null 2>&1" 2>/dev/null; then
            log "  ✓ ${name} 健康"
        else
            warn "  ✗ ${name} 健康检查失败（可能还在启动中，稍后再试）"
        fi
    done

    log ""
    log "域名访问验证（HTTP）："
    if curl -sSf http://${DOMAIN}/ -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null; then
        log "  ✓ http://${DOMAIN}/ 可访问"
    else
        warn "  ✗ http://${DOMAIN}/ 访问失败"
    fi

    log ""
    log "域名访问验证（HTTPS）："
    if curl -sSf https://${DOMAIN}/ -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null; then
        log "  ✓ https://${DOMAIN}/ 可访问"
    else
        warn "  ✗ https://${DOMAIN}/ 访问失败（可能证书未生效或服务未就绪）"
    fi

    log ""
    log "API 健康检查："
    for path in /api/bff/health /api/ai/health/live; do
        if curl -sSf https://${DOMAIN}${path} -o /dev/null -w "HTTP %{http_code}" 2>/dev/null; then
            log "  ✓ ${path}"
        else
            warn "  ✗ ${path} 失败"
        fi
    done

    log ""
    log "==============================="
    log "部署完成！"
    log "  域名：https://${DOMAIN}"
    log "  数据库：aidesign-postgres (127.0.0.1:18010)"
    log "  MinIO Console: https://${DOMAIN}/minio-console/"
    log "  项目目录：${PROJECT_DIR}"
    log "  数据目录：${DATA_DIR}"
    log "==============================="
}

# ── 主流程 ──
main() {
    log "AiDesign 测试验证环境部署开始"
    log "目标服务器：$(hostname) | $(curl -s ifconfig.me 2>/dev/null || echo 'IP 未知')"
    log ""

    phase1_create_user
    phase2_gen_env
    phase3_docker_up
    phase4_nginx
    phase5_certbot
    phase6_verify
}

main "$@"
