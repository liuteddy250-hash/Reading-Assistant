# Changelog

## 1.5.1

### Fixed

- 本地小模型（3B）生成预习时，一次性输出过大导致 **JSON 截断 / 循环**，整章被回退成规则模式。改为两次小请求（摘要 + 长难句译文，再难词），解析失败自动重试一次；难词不足时用 ECDICT 补齐。
- 长难句的「结构拆解 / 意群」改由规则引擎生成，模型只负责译文：输出量减半，生成时间从约 5 分钟降到 **约 1.5 分钟**（实测 99.5s，3 句 + 8 词）。
- 文案：不再写「离线分析模式」，改为「本地规则分析（与网络无关）」，并区分"未配置模型"与"模型调用失败"，给出 `start-ollama.cmd` 的修复指引。

### Verified

- 单章重新生成：`source=llm`、3 个长难句含译文、8 个难词，99.5s。
- E2E 25/25（单用户模式，69.5s）；页面显示「AI 生成 / 参考译文」，不再出现误导性离线提示。

## 1.5.0

### Added

- **单用户模式**：`AUTH_MODE=single` 关闭登录/注册，打开即用；数据归属同一本地账号（默认取"书最多"的账号，可用 `LOCAL_USER_EMAIL` 指定）。
- `GET /api/auth/mode`：前端与测试可判断当前是 single 还是 multi。

### Changed

- 单用户模式下 `/login`、`/register` 自动跳回书库，导航显示「本地模式」；`start.cmd` 绑定 `127.0.0.1`。
- E2E 与 Playwright 兼容两种模式（多用户流程保持原样）。

### Verified

- 本地单用户：E2E **25/25**（86.6s）、Playwright **1/1**（2.3 min）。
- CI 仍以多用户模式运行，行为不变。

## 1.4.0

### Added

- **本地大模型（Ollama + qwen2.5:3b）**：没有 API Key 也能生成长难句讲解与参考译文，数据不出本机；新增 `start-ollama.cmd`，`start.cmd` 会自动拉起。
- LLM 客户端支持 `max_tokens`（文本 600 / JSON 1600），避免小模型无限续写。

### Changed

- 离线模式文案修正：释义来自 **ECDICT 离线词典**（此前误写「内置词库」），并说明"暂无参考译文"的实际原因。
- 预习正文摘录 9000 → 6000 字符，降低小模型上下文压力。
- E2E 兼容「有 / 无大模型」两种模式（先生成再断言页面），断言 25 → 26。
- Playwright 超时放宽，支持本地模型 2–3 分钟生成。

### Verified

- 本地 Ollama（3B、CPU）：预习生成 112s/章，6 句 + 15 词，译文质量可用。
- E2E **26/26**（本地带模型）；Playwright **1/1**（约 3 分钟）。
- 云端/CI 场景仍为离线快速路径（不配置密钥时行为不变）。

## 1.3.0

### Changed

- 升级 **Prisma ORM 6.19.3 → 7.10.1**，改用 Rust-free 客户端 + 驱动适配器（`@prisma/adapter-better-sqlite3` + `better-sqlite3`）。
- 新增 `prisma.config.ts`；`DATABASE_URL` 改为相对项目根目录的 `file:./prisma/dev.db`。
- 生成器切换为 `prisma-client`，客户端输出到 `src/generated/prisma`（gitignore，安装/构建时生成）。
- 移除 `scripts/smoke-db.mjs`（旧版直接依赖 `@prisma/client` 单例导入，已由 e2e 覆盖）。
- `npm audit --omit=dev`：**5 个漏洞 → 0**。

### Verified

- Prisma 7 构建通过；E2E **25/25**；Playwright 浏览器用例 **1/1**。
- `prisma db push`、`prisma generate` 在 Prisma 7 下正常。

## 1.2.0

### Changed

- 升级 **Next.js 15.5.28 → 16.4.3**（关闭产线安全审计中 next/postcss 的告警项）。
- 移除 Next 16 已废弃的 `next.config.ts` → `eslint` 配置项。
- `tsconfig.json` 与 `next-env.d.ts` 按 Next 16 自动迁移（`jsx: react-jsx`、新增 dev 类型目录）。
- 现有 `src/middleware.ts` 在 Next 16 下由 Proxy 承载，行为不变（构建产物显示 `Proxy (Middleware)`）。

### Verified

- 生产构建通过；E2E **25/25**（含 ECDICT）。
- 大模型不可达降级检查 **7/7**（预习页非阻塞、0s 回退离线、查词 7ms 走词典）。
- 无词典场景 23/23 + 2 SKIP（CI 状态）。

## 1.1.0

### Added

- **单击任意单词查词**：阅读器用 `caretRangeFromPoint` / `caretPositionFromPoint` 还原点击位置的单词，弹出词典卡，展示音标、词性、难度、考试标签（中考/高考/四六级/考研/托福/雅思/GRE）、COCA 词频排名、柯林斯星级与英文释义。
- **阅读进度与续读**：滚动位置节流上报（2.5s）+ 离开页面兜底；新增 `ReadingProgress` 表与 `POST /api/progress`；书库顶部「继续阅读」、章节列表「已读 x%」；阅读页挂载后恢复上次位置。
- **预习生成不阻塞首屏**：配置大模型时，预习页先渲染等待界面并由客户端触发生成（显示已等待秒数、失败重试、跳过预习入口）；离线模式仍在服务端内联生成。
- **生词自动补全**：只传单词时，服务端用 ECDICT 补齐释义、音标、词性。

### Changed

- 单词查询改为 **ECDICT 优先、LLM 兜底**：单击查词不再消耗大模型 token，响应也从秒级降到毫秒级。
- 章节分析结果按 `chapterId` 做进程内缓存，重复打开阅读页不再重新计算难度与长难句。

### Fixed

- 阅读器点击高亮词与普通词的交互统一，避免「只有 top-40 难词可点」的限制。

### Migration

- 已有数据库执行一次 `npm run db:init`（幂等，补建 `ReadingProgress` 表）或 `npm run db:push`；无数据迁移。
- Node 版本要求保持 `>= 24`（离线词典使用内置 `node:sqlite`）。

## 1.0.0

- 首个可用版本：邮箱账号体系、PDF 上传与章节划分、课前预习（长难句 + 难词）、阅读器高亮/划线/翻译、生词本、ECDICT 离线词典、GitHub Actions CI。
