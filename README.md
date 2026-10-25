# ReadEasy · 英语阅读辅助网站

上传 PDF 英文书 → 自动切分章节 → **先预习长难句与难词** → 进入带难词高亮、划词翻译、划线笔记和生词本的沉浸阅读。

技术栈：**Next.js 15（App Router）+ TypeScript + Prisma 6 + SQLite + unpdf + ECDICT**，单体应用，一条命令即可跑通；翻译与讲解使用 **OpenAI 兼容大模型接口**，未配置密钥时自动降级为 **ECDICT 离线词典（77 万词条）+ 规则分析**，全流程仍可走通。

当前版本 **1.1.0**，变更记录见 [CHANGELOG.md](CHANGELOG.md)。

---

## 1. 已实现功能

| 需求 | 实现说明 |
| --- | --- |
| 邮箱注册 / 登录 / 独立数据 | 邮箱 + 密码（bcrypt 10 轮），JWT（jose HS256）写入 httpOnly Cookie，7 天有效；所有书籍、章节、划线、生词都按 `userId` 隔离 |
| 上传 PDF 入个人书库 | `multipart/form-data` 上传，校验扩展名 / 大小 / `%PDF-` 魔数；文件落盘到 `STORAGE_DIR`，文本与章节入库 |
| 章节划分 | 优先识别 `Chapter N` / `Part N` / `第 N 章` / `Prologue` 等标题，其次识别「短标题行 + 上下空行」，最后按页数分块；支持**手动按页码范围**重划 |
| 课前预习 | 每章进入前自动生成：中文导读、4–6 个长难句（原文 / 意群切分 / 结构拆解 / 参考译文）、10–18 个难词（音标 / 词性 / 释义 / 例句）；预习未完成时阅读页会被拦截。配置大模型时改为**客户端生成**（页面秒开、显示等待秒数与重试），离线模式仍内联生成 |
| 阅读模式 | 难度词自动高亮（两级颜色）、可开关高亮、字号调节、上一章 / 下一章；**单击任意单词**弹出词典卡（音标 / 词性 / 考试标签 / 词频 / 柯林斯星级 / 英文释义） |
| 阅读进度 | 滚动位置自动保存（节流 + 离开页面兜底），章节列表显示已读百分比，书库顶部「继续阅读」直达上次位置 |
| 划线 + 翻译 | 选中任意片段弹出工具条：翻译（结果自动保存为划线 + 译文）、仅下划线、加入生词本；已划线文本点击可回看译文、删除 |
| 生词本 | 双击单词直接收藏，或选中片段收藏；独立页面支持搜索、删除、导出 CSV，并记录来源书籍/章节与上下文 |
| 登录保护 | `middleware.ts` 校验 JWT，未登录访问 `/library`、`/books/*`、`/vocabulary` 会 307 跳转 `/login?next=...`，登录后回到原页面 |
| 扫描件 / 解析失败 | 扫描件（无文字层）不静默失败：记录书籍并给出 OCR 指引；文件损坏 / 非 PDF 返回明确错误；解析异常单独标记状态 |

---

## 2. 页面结构

```
/login                登录
/register             注册
/library              我的书库（上传面板 + 书籍卡片）
/books/[id]           书籍详情：基本信息、章节列表、重新划分章节、删除
/books/[id]/prestudy/[chapterId]   课前预习（长难句精讲 + 重点难词 + 完成/跳过）
/books/[id]/read/[chapterId]       阅读器（高亮正文 + 选词弹层 + 侧栏标记）
/vocabulary           生词本（搜索 / 删除 / 导出）
/                     重定向到 /library
```

阅读器交互：

- **单击难词** → 弹层显示难度等级、释义（有则显示）、查询释义、加入生词本；
- **双击单词** → 直接加入生词本并提示；
- **选中文字** → 弹层：翻译 / 下划线 / 加入生词本；
- **点击已有划线** → 查看已保存译文，可删除。

---

## 3. 快速开始

前置：Node.js ≥ 24（离线词典用到内置 `node:sqlite`）、npm。

```bash
cd english-reader
cp .env.example .env
# 必改：AUTH_SECRET（生成方式见下）
npm install

# 初始化数据库（二选一）
npm run db:push     # 标准方式：prisma db push
npm run db:init     # 备选：node:sqlite 直接建表，无需 Prisma 引擎子进程

# 可选但推荐：导入离线词典（77 万英汉词条，见 6.7）
#   先下载 CSV 到 data/ecdict.csv（Windows 用 curl.exe）
curl -L -o data/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
npm run dict:import

npm run dev         # http://localhost:3000
```

> 已部署过 v1.0 的旧数据库？执行一次 `npm run db:init`（幂等，只补建 `ReadingProgress` 表）或 `npm run db:push` 即可，无需迁移数据。

生成 `AUTH_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

体验用样例书（无需自己找 PDF）：

```bash
npm run sample:pdf          # 生成 samples/sample-book.pdf（3 章，含长难句与难词）
```

端到端验收脚本（需服务已在运行）：

```bash
npm run e2e                 # 默认测 http://127.0.0.1:3000
BASE_URL=http://127.0.0.1:3008 npm run e2e
```

> Windows PowerShell：`$env:BASE_URL="http://127.0.0.1:3000"; npm run e2e`

---

## 4. 需要你自己配置的部分

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `AUTH_SECRET` | **必填** | 会话签名密钥，≥ 32 字符随机串；生产环境缺失会直接报错 |
| `DATABASE_URL` | 默认可用 | 默认 `file:./dev.db`（SQLite，无需装数据库）。换 PostgreSQL 时改这里 + `prisma/schema.prisma` 的 `provider`，并重新 `npm run db:push` |
| `LLM_API_KEY` | 可选（强烈建议） | OpenAI 兼容接口密钥。留空 → 离线模式：内置词典 + 规则分析，能跑通但无译文和例句 |
| `LLM_BASE_URL` | 可选 | 默认 `https://api.deepseek.com/v1`；也可填 OpenAI、通义、Moonshot、本地 Ollama 的 `/v1` 地址 |
| `LLM_MODEL` | 可选 | 默认 `deepseek-chat`，按你的服务商填写 |
| `LLM_TIMEOUT_MS` | 可选 | 单次调用超时，默认 45000ms；超时自动回退离线模式 |
| `LIBRETRANSLATE_URL` / `LIBRETRANSLATE_API_KEY` | 可选 | 第二层翻译兜底；不填则跳过 |
| `STORAGE_DIR` | 可选 | PDF 原件目录，默认 `./data/uploads`；生产建议挂持久磁盘或改对象存储 |
| `MAX_UPLOAD_MB` | 可选 | 上传大小上限，默认 50 |
| `DICT_DB_PATH` | 可选 | 离线词典路径，默认 `./data/ecdict.db`；文件不存在时自动回退内置小词表 |

DeepSeek 示例：

```env
LLM_BASE_URL="https://api.deepseek.com/v1"
LLM_API_KEY="sk-xxxxxxxx"
LLM_MODEL="deepseek-chat"
```

OpenAI 示例：

```env
LLM_BASE_URL="https://api.openai.com/v1"
LLM_API_KEY="sk-xxxxxxxx"
LLM_MODEL="gpt-4o-mini"
```

---

## 5. 目录结构

```
english-reader/
├─ prisma/
│  └─ schema.prisma              # 数据模型（User/Book/Chapter/Prestudy/Annotation/Word）
├─ samples/
│  └─ sample-book.pdf            # 验收用样例 PDF（脚本生成）
├─ data/                         # 运行时数据（gitignore）
│  ├─ uploads/                   # PDF 原件
│  └─ ecdict.db                  # 离线词典（npm run dict:import 生成）
├─ .github/
│  └─ workflows/ci.yml           # CI：安装 → 建库 → 构建 → 起服务 → 跑 e2e
├─ scripts/
│  ├─ init-db.mjs                # 无 Prisma 引擎时的建表脚本
│  ├─ import-ecdict.mjs          # ECDICT CSV → SQLite（流式解析 + 事务批量写入）
│  ├─ make-sample-pdf.mjs        # 纯手写 PDF 生成器（无第三方依赖）
│  ├─ smoke-db.mjs               # Prisma 读写冒烟测试
│  ├─ check-llm-fallback.mjs     # 大模型不可达时的降级验证
│  └─ e2e.mjs                    # 端到端验收（25 项断言）
├─ src/
│  ├─ middleware.ts              # 未登录跳转登录页
│  ├─ app/
│  │  ├─ layout.tsx / globals.css / page.tsx
│  │  ├─ error.tsx / not-found.tsx
│  │  ├─ login/page.tsx
│  │  ├─ register/page.tsx
│  │  ├─ library/page.tsx
│  │  ├─ vocabulary/page.tsx
│  │  ├─ books/[id]/page.tsx
│  │  ├─ books/[id]/prestudy/[chapterId]/page.tsx
│  │  ├─ books/[id]/read/[chapterId]/page.tsx
│  │  └─ api/
│  │     ├─ auth/{register,login,logout}/route.ts
│  │     ├─ books/route.ts                     # GET 列表 / POST 上传解析
│  │     ├─ books/[id]/route.ts                # GET 详情 / DELETE
│  │     ├─ books/[id]/resplit/route.ts        # 自动 / 手动重划章节
│  │     ├─ chapters/[id]/prestudy/route.ts    # 读取 / 生成预习
│  │     ├─ chapters/[id]/prestudy/complete/route.ts
│  │     ├─ translate/route.ts                 # 单词释义 / 整句翻译（含降级）
│  │     ├─ vocabulary/route.ts                # 生词列表 / 收藏
│  │     ├─ vocabulary/[id]/route.ts
│  │     ├─ annotations/route.ts               # 划线 / 译文
│  │     ├─ annotations/[id]/route.ts
│  │     └─ progress/route.ts                   # 阅读进度
│  ├─ components/
│  │  ├─ Nav.tsx / LogoutButton.tsx
│  │  ├─ AuthForm.tsx
│  │  ├─ UploadPanel.tsx
│  │  ├─ BookTools.tsx            # 重划章节 / 删除书籍
│  │  ├─ PrestudyView.tsx
│  │  ├─ PrestudyRunner.tsx       # 大模型预习的客户端生成 / 重试
│  │  ├─ Reader.tsx               # 阅读器核心（高亮 / 查词 / 选区 / 进度）
│  │  └─ VocabTable.tsx
│  └─ lib/
│     ├─ db.ts                    # Prisma 单例
│     ├─ jwt.ts / auth.ts         # 签发、校验、Cookie
│     ├─ access.ts                # 归属校验（防越权）
│     ├─ pdf.ts                   # unpdf 提取文本 + 扫描件判定
│     ├─ chapters.ts              # 章节识别 / 分块 / 手动划分
│     ├─ text.ts                  # 断句、分段、重排硬换行、分词
│     ├─ analyze.ts               # 难词打分（ECDICT 标签/词频）、长难句筛选
│     ├─ common-words.ts          # 常用词表（高亮灵敏度开关）
│     ├─ dictionary.ts            # ECDICT SQLite 查询（精确 + 词形还原 + 缓存）
│     ├─ glossary.ts              # 兜底小词库（无 ECDICT 时使用）
│     ├─ llm.ts                   # OpenAI 兼容客户端
│     ├─ translate.ts             # LLM → LibreTranslate → ECDICT/内置词库
│     ├─ prestudy.ts              # 预习材料生成 / 缓存
│     ├─ storage.ts               # PDF 落盘
│     └─ types.ts
├─ .env.example
├─ next.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 6. 关键实现说明

### 6.1 PDF 解析与章节划分（`src/lib/pdf.ts`、`src/lib/chapters.ts`）

1. `unpdf`（pdf.js）逐页提取，`mergePages: false` 保留页边界；
2. 清理：去掉连字符断词（`under-\nstanding`）、压缩空行；
3. 扫描件判定：`总字母数 / 页数 < 25` → `status = no_text_layer`；
4. 标题识别优先级：
   - 正则：`Chapter 12`、`Part IV`、`第 3 章`、`Prologue / Introduction / Appendix`；
   - 通用：长度 3–64、首字母大写、无句末标点、上下均为空行、Title Case 比例 ≥ 0.6；
   - 兜底：按约 3200 词一页组切块，标题写成「第 N 部分 · 第 a–b 页」。
5. 入库前用 `reflowText()` 把 PDF 的硬换行重新拼成自然段（否则长难句会被行尾截断），再统计词数、记录起止页。

### 6.2 难词与长难句（`src/lib/analyze.ts`）

- 难度分优先看 ECDICT 元数据：考试标签（四级/高考→1，六级/考研→2，托福/雅思→3，GRE→4），没有标签时按 BNC/COCA 词频排名分档；
- 词表里没有的词回退到形态启发式（长度 + 音节数 + 后缀）；常用词表内的词直接判为 0 级；
- 每章取分数最高的 40 个词，其中 ≥2 级的进入阅读器高亮；
- 长难句：≥16 词，按「词数 + 从句连接词数 + 逗号数」排序取前 6。

> 高亮灵敏度由 `common-words.ts` 与 `analyze.ts` 的阈值控制；词典缺失时自动退回纯启发式打分。

### 6.3 预习材料（`src/lib/prestudy.ts`）

- 配置了 `LLM_API_KEY`：一次 JSON 调用同时产出导读、长难句（结构 + 译文）和难词（音标 / 词性 / 释义 / 例句），结果缓存在 `Prestudy.payload`；
- 未配置或调用失败：回退离线分析（意群切分 + 结构提示 + 内置词典释义），页面明确标注「离线分析模式」；
- 生成结果按章缓存，重复访问不重复计费；「重新生成」才会覆盖。

### 6.4 划线与译文定位（`src/components/Reader.tsx`）

选中文本时用 `Range` 计算「段落下标 + 段内字符偏移」：

```ts
const pre = document.createRange();
pre.selectNodeContents(startParagraph);
pre.setEnd(range.startContainer, range.startOffset);
const startInP = pre.toString().length;
```

存库为 `(paragraph, startInP, quote)`，渲染时按偏移切分文本并包 `<span data-ann>`；跨段落选择会被裁剪到起始段落（产品上有意为之，避免跨段锚点漂移）。`splitParagraphs()` 是纯函数、确定性输出，保证刷新后偏移一致。

### 6.5 翻译与降级链（`src/lib/translate.ts`）

```
LLM（OpenAI 兼容） → LibreTranslate → ECDICT 离线词典 → 内置小词表 → 明确失败提示
```

- 单词走词典模式（音标 / 词性 / 释义），整句走向翻译模式；
- **单词查询优先走 ECDICT**（免费、即时），词典未收录才调用大模型——单击任意词不会消耗 token；
- 任一层失败都不会 500：返回 `degraded: true` + 中文提示，前端在弹层里用橙色小字展示「已降级」；
- 完全不可用时仍可保存划线 / 生词，不阻塞阅读。

### 6.6 越权防护

所有章节、划线、生词操作先做归属校验（`src/lib/access.ts`：`where: { id, book: { userId } }`），跨账号访问统一 404。

### 6.7 离线词典（ECDICT）

`src/lib/dictionary.ts` 读取 `data/ecdict.db`，数据由 `scripts/import-ecdict.mjs` 从 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT）生成：

- **规模**：约 77 万词条，含音标、多义项中文释义、柯林斯/牛津标记、BNC/COCA 词频、四级/六级/考研/托福/雅思/GRE 标签；
- **查询**：精确匹配 → 词形还原（`-s/-es/-ed/-ing/-ly/-er/-est`、`ies→y`、双写辅音）→ 内置 100 词表兜底；结果做 LRU 缓存；
- **用途**：预习卡片的音标与释义、阅读器点词、划词翻译的离线层、难度分级；
- **降级**：`data/ecdict.db` 不存在时自动退回 `glossary.ts`，功能不受影响（CI 就是这种状态）；
- **体积**：CSV 63MB → SQLite 82MB，导入约 6 秒（流式解析 + 事务批量写入）；
- **获取**：`curl -L -o data/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv`（Windows 用 `curl.exe`）；GitHub 不可达时可 `npm pack ecdict@0.0.4` 解包取 `package/assets/ecdict.csv`；
- **许可**：ECDICT 为 MIT，可商用；数据库文件不进 Git（`data/` 已忽略）。

### 6.8 任意词查词与阅读进度（v1.1）

- **任意词查词**：阅读器不把每个词包成 `<span>`，而是用 `caretRangeFromPoint`（Firefox 为 `caretPositionFromPoint`）在点击位置还原单词，再按需请求 `/api/translate` —— 长章节不会多出上千个 DOM 节点；
- **弹层信息**：音标、词性、难度、考试标签（中考/高考/四六级/考研/托福/雅思/GRE）、COCA 词频排名、柯林斯星级、英文释义；
- **进度上报**：滚动时每 2.5s 上报一次百分比，组件卸载时兜底再报一次（`keepalive`）；服务端按 `(userId, chapterId)` upsert，重复上报只更新一行；
- **续读**：阅读页挂载后按保存的百分比恢复滚动位置；章节列表显示「已读 x%」，书库顶部显示「上次读到」；
- **完成判定**：`percent ≥ 95` 自动置 `completed`，后续滚动不会把已完成改回未完成。

---

## 7. 边界情况处理

| 场景 | 行为 |
| --- | --- |
| 扫描件（无文字层） | 书籍入库并标记「需 OCR」，详情页说明原因与处理方式（`ocrmypdf` / Acrobat「识别文本」），不生成空章节；重划章节接口同样拒绝并提示 |
| PDF 损坏 / 加密 / 非 PDF | 上传接口返回 400/422 与中文原因，不产生脏数据；`status=error` 的书记录也会展示在书库中便于删除 |
| PDF 提取不到正文 | 返回 `warning` 并在书库标记「解析异常」，可删除重传 |
| 翻译服务不可用 | 逐级降级到离线词典；弹层显示降级原因；不影响划线/生词 |
| 未登录访问受保护页面 | 中间件 307 → `/login?next=原路径`，登录后回跳 |
| 未完成预习直接阅读 | 服务端重定向到预习页；预习页提供「跳过预习，直接阅读」出口 |
| 选中文本过长 | 翻译接口上限 2000 字符，超出提示分段翻译 |
| 生词重复收藏 | `(userId, term)` 唯一约束 + upsert，不会重复 |
| 书名重复 | 允许，按 `createdAt` 倒序展示 |

---

## 8. API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 邮箱注册（密码 ≥ 8 位） |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/books` | 当前用户书库 |
| POST | `/api/books` | 上传 PDF（multipart：`file`、`title?`） |
| GET / DELETE | `/api/books/:id` | 详情 / 删除（级联章节、预习、划线、生词来源） |
| POST | `/api/books/:id/resplit` | `{mode:"auto"}` 或 `{mode:"manual", ranges:[{title,start,end}]}`（页码从 1 起） |
| GET / POST | `/api/chapters/:id/prestudy` | 读取 / 生成（`?force=1` 强制重生成） |
| POST | `/api/chapters/:id/prestudy/complete` | 标记预习完成 |
| POST | `/api/translate` | `{text, context?, mode?}` → 单词释义或整句译文 |
| GET / POST | `/api/vocabulary` | 生词列表 / 收藏 |
| DELETE | `/api/vocabulary/:id` | 删除生词 |
| GET / POST | `/api/annotations` | 章节划线列表 / 新建划线或译文 |
| DELETE | `/api/annotations/:id` | 删除划线 |
| POST | `/api/progress` | 保存阅读进度 `{chapterId, percent}`（0–100，≥95 自动标记完成） |
| DELETE | `/api/annotations/:id` | 删除划线 |

---

## 9. 持续集成（GitHub Actions）

工作流文件：[.github/workflows/ci.yml](.github/workflows/ci.yml)，触发条件为 `push`、`pull_request`、手动 `workflow_dispatch`。

单 job 依次执行：

| 步骤 | 命令 | 失败意味着 |
| --- | --- | --- |
| 安装 | `npm ci`（Node 24，npm 缓存） | 锁文件与 `package.json` 不一致 |
| 建库 | `npm run db:push` | schema 有问题 |
| 类型检查 | `npm run typecheck` | TS 类型错误 |
| 构建 | `npm run build` | 生产构建失败（含 `prisma generate`） |
| 造样例书 | `npm run sample:pdf` | PDF 生成脚本异常 |
| 起服务 | `npm start` + 轮询 `/login`（最多 120s） | 服务启动失败（会打印 `server.log` 尾部） |
| 验收 | `npm run e2e` | 25 项断言任一失败 |
| 大模型兜底 | 在 3001 端口再起一个指向不可达 LLM 的实例，跑 `check-llm-fallback` | 非阻塞预习或降级逻辑回归 |
| 收尾 | 停止两个进程、上传 `ci-logs`、写 Job Summary | — |

设计要点：

- CI 里 `LLM_API_KEY` 显式留空，走**离线模式**，结果可重复、不花钱、不受第三方抖动影响；`e2e` 中的断言（离线词典释义、离线预习页）也依赖这一点；
- 数据库用临时 SQLite，每次 Runner 从零开始，不依赖任何外部服务；
- 失败时先下载 **Artifacts → ci-logs**，`server.log`（服务端报错）和 `e2e.log`（断言输出）都在里面；
- 想额外验证大模型链路：配 `secrets.LLM_API_KEY` 并把 `LLM_API_KEY` 映射到 env，同时把 `e2e.mjs` 里「离线模式」相关断言改成按 `LLM_API_KEY` 分支（否则会因预习来源变成 `llm` 而失败）。

本地等价复现：

```bash
npm ci
npm run db:push
npm run typecheck
npm run build
npm run sample:pdf
npm start            # 另开一个终端
npm run e2e
```

> 可选增强：加 `windows-latest` 矩阵验证 Windows 路径、加一个 `docker build` job、或把 `ci-logs` 换成 `actions/github-script` 直接贴到 PR 评论。当前保持单 job，先保证快和稳。

## 10. 部署

### 本地 / VPS（推荐先用这个）

```bash
npm ci
npm run build
npm start          # 默认 3000 端口，可 PORT=8080 npm start
```

生产环境要点：

- 用 **HTTPS**（否则 `Secure` Cookie 不生效；Chrome 对 `localhost` 有例外）；
- `data/`（SQLite + PDF 原件）必须放在**持久磁盘**上，容器部署要挂 volume；
- 反向代理（Nginx/Caddy）需放行大文件上传：`client_max_body_size 60m;`，并给预览/翻译接口留足超时。

### Vercel / Serverless

直接部署会踩两个坑：文件系统只读（`STORAGE_DIR` 不可写）且实例无状态（SQLite 丢失）。改造方式：

1. 数据库换 Postgres（Neon / Supabase / RDS），改 `provider` 与 `DATABASE_URL`；
2. PDF 原件改对象存储（S3 / R2 / Supabase Storage），`storage.ts` 换成上传 SDK；
3. `next.config.ts` 无需改动，`unpdf` 已在 `serverExternalPackages` 中。

> 如果只需要「上传即解析、不留原件」，也可以去掉文件落盘，仅存文本（`resplit` 手动划分功能会因此不可用）。

### 换成 Postgres

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

然后 `npm run db:push`（或 `prisma migrate dev`）。

---

## 11. 已知限制

- 章节识别是启发式的：排版特殊的书可能只分出 1 章，用「手动按页划分」兜底；
- 扫描件**不含 OCR**，只做提示（接入 `ocrmypdf` 或云 OCR 是下一步）；
- 跨段落划线会被裁剪到起始段落（避免锚点漂移）；
- 单击查词依赖 `caretRangeFromPoint` / `caretPositionFromPoint`（Chrome、Safari、Firefox 均支持；过旧浏览器会退化为只能查高亮词）；
- 阅读进度按滚动比例估算，最后一屏较长时可能提前达到 100%；
- 难词等级基于 ECDICT 的考试标签与词频，不等于 CEFR 等级；
- ECDICT 只提供词级释义，没有例句/搭配，多义项按顺序拼接；
- 没有阅读进度同步、书签、全文搜索、发音（可基于 `Web Speech API` 低成本补上）；
- 离线模式没有参考译文，长难句给的是结构提示与意群切分。

---

## 12. 验收结果

`npm run e2e`（开发模式与生产模式各跑一遍，均通过；GitHub Actions 里每次 push / PR 也会在干净环境自动跑同一脚本）：

```
PASS  未登录访问 /library 跳转登录 — 307 /login?next=%2Flibrary
PASS  登录页可访问
PASS  邮箱注册成功 — e2e-...@example.com
PASS  登录后进入书库
PASS  上传 PDF 并自动划分章节 — status=201 chapters=3
PASS  书籍详情页显示章节
PASS  章节接口返回正文
PASS  未预习直接阅读被拦截 — 307 /books/.../prestudy/...
PASS  预习页生成长难句与难词 — status=200 length=25520
PASS  预习数据包含 sentences/words/summary — sentences=6 words=18
PASS  标记预习完成
PASS  阅读页渲染正文并高亮难词 — status=200 length=19576
PASS  划词翻译（离线词典降级） — offline a. 无所不在的, 到处存在的, 普遍存在的
PASS  ECDICT 词典命中（内置词表没有的词） — n. 偶然发现珍宝的运气/才能, 易遇奇缘的运气
PASS  任意词查词返回音标与考试标签 — 'ɑ:kitektʃә gk,cet4,cet6,ky,toefl,ielts
PASS  加入生词本并自动带释义 — a. 无所不在的, 到处存在的, 普遍存在的
PASS  创建划线 + 译文 — The Architecture of Atte
PASS  阅读页显示划线标记
PASS  保存阅读进度 — percent=42
PASS  书籍页显示已读进度与继续阅读
PASS  书库页显示上次阅读入口
PASS  生词本页面显示单词
PASS  未登录调用 API 返回 401
PASS  未登录保存进度返回 401
PASS  PDF 文本提取干净

25/25 checks passed
```

> CI 里不下载词典（会跳过「ECDICT 词典命中」「任意词查词音标/标签」两项，其余断言照常），本地导入词典后跑 `npm run e2e` 是 25/25。

覆盖了验收标准要求的完整链路：**邮箱注册 → 上传 PDF → 选择章节 → 预习长难句与难词 → 进入该章阅读 → 看到难度词汇高亮 → 划词翻译**（外加生词本与未登录跳转）。

---

## 13. 常见问题

**`npm install` 报 `spawn EPERM` / postinstall 失败？**
某些受限沙箱禁止子进程。用 `npm install --ignore-scripts`，然后 `npm run db:init` 建库；`prisma generate` 可单独执行（不 spawn 引擎）。

**`prisma db push` 报 `Schema engine exited ... spawn EPERM`？**
同上，改用 `npm run db:init`（等价建表脚本，DDL 与 `schema.prisma` 对齐）。

**上传后只分出 1 章？**
标题格式不常见。在书籍详情页用「手动按页划分」，或调整 `src/lib/chapters.ts` 的标题正则。

**预习页显示「离线分析模式」？**
没有配置 `LLM_API_KEY`，或大模型调用失败（查看服务端日志）。配置后点「重新生成预习材料」。

**预习里的释义很杂 / 没有例句？**
离线模式用 ECDICT 的多义项释义（会带 `[计]`、`[法]` 等领域标注），按语境取第一个义项即可；需要例句和语境化释义，配 `LLM_API_KEY` 后重新生成预习。

**怎么确认大模型配置真的生效/降级正常？**
`npm run check:llm`（需先用不可达的 `LLM_BASE_URL` 起服务）：它会验证预习页不阻塞、生成失败自动回退离线、以及单击查词仍走词典。CI 里也会跑这套检查。

**中文乱码 / 字体？**
界面用系统中文字体栈；阅读正文用 Georgia / Palatino / Songti 回退，无需额外字体文件。

## 14. 把项目推到 GitHub

本仓库已在本机初始化并完成首次提交（`main` 分支）。**GitHub 账号与凭据需要你自己配置**，按顺序执行：

```bash
cd english-reader

# 1) 设置提交身份（只需一次）
git config --global user.name  "你的名字"
git config --global user.email "你的邮箱"

# 2) 在 GitHub 上新建一个空仓库（不要勾选 README / .gitignore / license），然后：
git remote add origin https://github.com/<你的账号>/<仓库名>.git

# 3) 推送
git push -u origin main
```

推送时 Git Credential Manager 会弹出登录窗口（或让你粘贴 Personal Access Token）。

- **不要**把 token 写进代码、`.env` 或聊天记录；用系统的凭据管理器或 SSH key（`git@github.com:<账号>/<仓库名>.git`）。
- 如果新建仓库时勾选了 README，先 `git pull --rebase origin main` 再 push。
- 推上去后，仓库的 **Actions** 页会自动运行 `ci.yml`；如果 Actions 被禁用，去 Settings → Actions → General 允许即可。
- 仓库是 Public 时注意：`samples/sample-book.pdf` 等内容也会公开，确认无敏感信息。

> 想改首次提交的署名：`git commit --amend --reset-author --no-edit`（先配置好 name/email）。

---

## 15. License

本项目代码采用 [MIT License](LICENSE)（© 2026 liuteddy250-hash）。

第三方数据：离线词典来自 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT），**不随仓库分发**，需按第 6.7 节自行下载导入。
