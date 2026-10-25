# 部署到云服务器（Docker）

目标形态：一台 2 核 4G 的云服务器，`docker compose up -d --build` 一条命令起站点，Caddy 自动签 HTTPS。

```
浏览器 ──HTTPS──> Caddy(80/443) ──> Next.js app(:3000)
                                        └── /app/data 卷
                                            ├─ app.db       （SQLite）
                                            ├─ uploads/     （PDF 原件）
                                            └─ ecdict.db    （离线词典，可选）
```

## 1. 前置条件

- 云服务器：2 核 4G 起（30 人规模够用），Ubuntu 22.04+ / Debian 12+
- 已安装 Docker 与 Compose 插件：`docker compose version` 有输出
- 安全组放行 **80、443**（应用端口 3000 不对外）
- 域名可选；**国内大陆节点绑域名需要 ICP 备案**，没有备案可以：
  - 用香港/新加坡节点，或
  - 先不绑域名，用 `http://服务器IP` 访问

## 2. 拉代码并配置

```bash
git clone https://github.com/liuteddy250-hash/Reading-Assistant.git
cd Reading-Assistant

cp .env.production.example .env
# 生成密钥并填入 .env 的 AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 填 LLM_API_KEY（DeepSeek/OpenAI 任选），填 SITE_ADDRESS（域名或 localhost）
```

`.env` 关键项：

| 变量 | 说明 |
| --- | --- |
| `SITE_ADDRESS` | 域名；Caddy 用它申请证书。没有域名填 `localhost` 或服务器 IP |
| `AUTH_MODE` | 必须是 `multi`，恢复邮箱注册/登录 |
| `AUTH_SECRET` | 32+ 位随机串，泄露等于所有账号可伪造 |
| `DATABASE_URL` | 固定 `file:/app/data/app.db`，跟随数据卷 |
| `LLM_*` | 云 API；30 人规模每月约 10–30 元 |

## 3. 启动

```bash
docker compose up -d --build
docker compose logs -f app    # 看到 Ready 即可
```

首次访问 `https://你的域名`（或 `http://IP`）→ 注册第一个账号。

> 国内服务器构建时，`better-sqlite3` 需要下载预编译包。如果 `npm ci` 卡住/失败，用代理构建：
> `docker compose build --build-arg HTTPS_PROXY=http://你的代理:端口 --build-arg HTTP_PROXY=http://你的代理:端口`

## 4. 导入离线词典（可选，强烈建议）

ECDICT 77 万词条，约 80MB SQLite，能显著提升释义与难度分级质量：

```bash
# 先在服务器上准备好 ecdict.csv（见 README 6.7）
docker compose cp ./data/ecdict.csv app:/app/data/ecdict.csv
docker compose exec app node scripts/import-ecdict.mjs \
  --csv /app/data/ecdict.csv --out /app/data/ecdict.db
docker compose restart app
```

## 5. 日常运维

```bash
docker compose logs -f app          # 应用日志
docker compose logs -f caddy        # HTTPS/证书日志
docker compose restart app          # 重启
docker compose down                 # 停止（数据卷保留）
```

**备份**（SQLite + PDF 都在 `app_data` 卷）：

```bash
docker volume ls                                   # 找到 *_app_data
docker run --rm -v <卷名>:/data -v "$PWD":/backup alpine \
  tar czf /backup/appdata-$(date +%F).tgz -C /data .
```

**升级**：

```bash
git pull
docker compose up -d --build
```

## 6. 成本参考（30 人）

| 项目 | 费用 |
| --- | --- |
| 2 核 4G 云服务器 | ¥60–120/月 |
| 域名 | ¥30–60/年 |
| HTTPS 证书 | 免费（Caddy 自动续期） |
| 大模型 API | ¥10–30/月（每章约 1 分钱，按章缓存） |
| **合计** | **约 ¥100/月** |

## 7. 安全清单

- [ ] `AUTH_SECRET` 换成随机值，且不进 Git
- [ ] `AUTH_MODE=multi`（不要用单用户模式上公网）
- [ ] 只暴露 80/443，不要映射 3000
- [ ] 定期备份 `app_data` 卷
- [ ] `LLM_API_KEY` 只写在服务器 `.env`
- [ ] 关注 `docker compose logs`，异常时先看 app 日志

## 8. 当前限制（下一步）

- 目前是**每个账号自己的书库**；"老师上传、全班共用"的共享书库尚未实现（下一阶段）。
- 没有内置的每日生成配额/限流，公开注册前建议先加。
- SQLite 单机足够 30 人；若扩到数百人、或要跑多实例，再迁移到 Postgres（需要换 `prisma/schema.prisma` 的 provider 并重新生成）。
