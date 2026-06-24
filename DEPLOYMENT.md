# 服务器部署指南

本文档提供多种服务器部署方案，选择最适合你的场景。

---

## 📋 前置要求

- **服务器**: Linux (Ubuntu/CentOS/Debian) 或 Windows Server
- **Node.js**: 版本 >= 14.0.0
- **内存**: 至少 512MB
- **磁盘**: 至少 1GB 可用空间

---

## 🚀 方案 1：直接部署（最简单）

### 1. 在服务器上克隆项目

```bash
git clone https://github.com/nushena/ai-model-health.git
cd ai-model-health
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
vim .env  # 或使用 nano .env
```

填写以下配置：

```env
OPENAI_API_KEY=你的API密钥
OPENAI_BASE_URL=https://api.openai.com/v1
CHECK_INTERVAL_MINUTES=5
PORT=3000
DATA_RETENTION_DAYS=14
```

### 4. 使用 PM2 保持运行

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server/index.js --name ai-model-monitor

# 查看状态
pm2 status

# 查看日志
pm2 logs ai-model-monitor

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 然后复制输出的命令并执行
```

### 5. 配置防火墙

```bash
# Ubuntu/Debian (使用 ufw)
sudo ufw allow 3000/tcp
sudo ufw reload

# CentOS/RHEL (使用 firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 6. 访问应用

浏览器打开：`http://你的服务器IP:3000`

---

## 🐳 方案 2：Docker 部署（推荐）

### 为什么选择 Docker？

✅ 环境隔离，不污染主机  
✅ 一键启动，无需安装 Node.js  
✅ 易于迁移和扩展  
✅ 自动重启和健康检查  

### 1. 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户加入 docker 组
sudo usermod -aG docker $USER
newgrp docker
```

### 2. 安装 Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. 克隆项目

```bash
git clone https://github.com/nushena/ai-model-health.git
cd ai-model-health
```

### 4. 配置环境变量

```bash
cp .env.example .env
vim .env
```

### 5. 启动容器

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

### 6. 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

---

## 📦 方案 3：打包部署（离线环境）

如果服务器无法访问外网，可以打包后部署。

### 1. 在本地打包

```bash
# 在本地项目目录
npm install --production

# 打包所有文件
tar -czf ai-model-monitor.tar.gz \
  --exclude=node_modules/.cache \
  --exclude=.git \
  --exclude=server/data/*.db \
  server/ public/ node_modules/ package.json .env.example
```

### 2. 上传到服务器

```bash
# 使用 scp 上传
scp ai-model-monitor.tar.gz user@your-server:/path/to/deploy/
```

### 3. 在服务器上解压

```bash
cd /path/to/deploy/
tar -xzf ai-model-monitor.tar.gz

# 配置环境变量
cp .env.example .env
vim .env

# 启动
pm2 start server/index.js --name ai-model-monitor
```

---

## 🌐 方案 4：Nginx 反向代理（生产环境推荐）

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置 Nginx

创建配置文件：

```bash
sudo vim /etc/nginx/sites-available/ai-model-monitor
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或服务器 IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 启用配置

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/ai-model-monitor /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（可选）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 自动配置 HTTPS
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 🔄 方案 5：GitHub Actions 自动部署（CI/CD）

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /path/to/ai-model-health
            git pull
            npm install --production
            pm2 restart ai-model-monitor
```

在 GitHub 仓库设置中添加以下 Secrets：
- `SERVER_HOST`: 服务器 IP
- `SERVER_USER`: SSH 用户名
- `SERVER_SSH_KEY`: SSH 私钥

---

## 📊 性能优化建议

### 1. 使用进程管理器

```bash
# PM2 配置文件 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-model-monitor',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};

# 使用配置文件启动
pm2 start ecosystem.config.js
```

### 2. 定期备份数据库

```bash
# 创建备份脚本
vim /home/user/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/user/backups"
DB_FILE="/path/to/ai-model-health/server/data/status.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_FILE $BACKUP_DIR/status_$DATE.db

# 只保留最近 7 天的备份
find $BACKUP_DIR -name "status_*.db" -mtime +7 -delete
```

```bash
# 添加执行权限
chmod +x /home/user/backup-db.sh

# 添加到 crontab（每天凌晨 2 点备份）
crontab -e
0 2 * * * /home/user/backup-db.sh
```

---

## 🛠️ 常见问题

### Q: 如何更改端口？

A: 修改 `.env` 文件中的 `PORT=3000`，然后重启服务。

### Q: 如何查看日志？

A: 
```bash
# PM2
pm2 logs ai-model-monitor

# Docker
docker-compose logs -f
```

### Q: 服务器重启后自动启动？

A:
```bash
# PM2
pm2 startup
pm2 save

# Docker
docker-compose 配置中已包含 restart: unless-stopped
```

### Q: 如何升级到最新版本？

A:
```bash
# 拉取最新代码
git pull

# 重新安装依赖（如有更新）
npm install

# 重启服务
pm2 restart ai-model-monitor
# 或
docker-compose up -d --build
```

---

## 🔒 安全建议

1. **不要暴露 .env 文件**: 确保 `.env` 在 `.gitignore` 中
2. **使用防火墙**: 只开放必要的端口
3. **定期更新**: 保持 Node.js 和依赖包最新
4. **使用 HTTPS**: 生产环境建议配置 SSL 证书
5. **限制访问**: 可以在 Nginx 中配置 IP 白名单

---

## 📞 技术支持

如有问题，请访问：
- GitHub Issues: https://github.com/nushena/ai-model-health/issues
- 项目文档: https://github.com/nushena/ai-model-health
