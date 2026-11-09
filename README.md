# TOPIK MASTER 2027

个人韩语 TOPIK 备考系统。目标：2027 年 4 月参加 TOPIK II，保 4 冲 5。

当前版本：**第一阶段（2026-11-09）**。P1–P7 的 24 项固定功能已全部落地（见 `ACCEPTANCE.md`）；第一阶段新增：ANGELIC DREAM GARDEN 新首页（真实数据 + 四叶草导航）、hash 路由（支持返回 / 刷新 / 直访）、语法学习页（正文 400 点）。24 模块的真实完成状态见 `FEATURE_STATUS.md`（含未完成项，不粉饰）。

线上地址：https://chunzhiyi492-lab.github.io/topik-master-2027/

## 功能一览（路由）

| 路由 | 页面 | 说明 |
|---|---|---|
| `#/` | 首页 Home | 一屏：品牌 + 主视觉 + 今日学习（真实数据）+ 四叶草导航 + 底部短句 |
| `#/vocab` | 词汇 | 种子加载、搜索筛选、每日背词、发音、收藏、掌握度 |
| `#/review` | 智能复习 | FSRS 四档卡片、到期复习、随机抽词、错词本、收藏复习 |
| `#/grammar` | 语法学习 | 正文 400 点，按分册筛选、可搜索、点开看解释与例句 |
| `#/practice` | 练习 | 试卷练习、随机抽题、听力音频、阅读计时、写作练习、答题卡与自动计分；`?qtype=听力/阅读/写作` 预选题型，`?mode=random` 进随机抽题 |
| `#/mock` | 模拟考试 | 听力 60 / 阅读 70 / 写作 50 分钟，自动推进、自动计分 |
| `#/wrong` | 错题复练 | 最新一次答错的客观题，答对即移出 |
| `#/plan` | 学习计划 | 真实课表、TOPIK 目标进度（距考试天数、词汇覆盖） |
| `#/focus` | 番茄钟 | 25/5/15 分钟，时间戳计时，走完一轮才记分钟 |
| `#/stats` | 学习统计 | 打卡日历、连续天数、今日与 7 天统计、当日导出 |
| `#/settings` | 设置 | 备份导出 / 恢复、清空数据、离线与安装指引、自测 |

首页「今日学习」卡片内有「今日待复习」快捷入口（显示 `countDue()` 真实到期数，无到期时显示已完成）；四叶草导航内另有「智能复习」独立入口，两处共用同一套复习数据与逻辑。

## 技术路线（已确认，2026-11-07）

- 形态：PWA 静态站（Vite + React + TypeScript），无后端、无账号、无服务器成本。
- 存储：IndexedDB（Dexie 封装，`topik-master-2027` 库，v3），学习数据只存在本机浏览器；偏好类小数据存 localStorage。
- 复习：ts-fsrs v6（FSRS-7 默认参数），不自研 SRS 算法。
- 发音：浏览器 `speechSynthesis`，`lang: ko-KR`，免费，无需 API Key。
- 路由：手写 hash 路由（`src/lib/router.ts`，不引入 react-router）；GitHub Pages 是纯静态托管，BrowserRouter 刷新 / 直访会 404。
- 目标设备：iPhone Safari 与 Windows 浏览器优先。
- 不用 Next.js / Vercel / 付费大模型 API。

## 词汇分级规则（铁律）

**不许把任何词标为“官方 TOPIK X 级”。** TOPIK 官方（NIIED）不公布 1–6 级词表。系统内只用三类来源标注，每条词必须带来源与分级依据：

| 标注 | 来源 | 说明 |
|---|---|---|
| `NIKL-A` / `NIKL-B` / `NIKL-C` | 国立国语院 2003《韩语学习用词汇目录》 | A 初级 982 词 / B 中级 2,111 词 / C 高级 2,872 词 |
| `TOPIK-초급` / `TOPIK-중급` | TOPIK 2015 公开词汇目录 | 只分这两档：초급 = TOPIK I，중급 = TOPIK II 起 |
| `课程-X级参考` | 2018《国际通用韩语教育标准课程》词汇等级表（10,635 词） | 参考分级，不是 TOPIK 官方等级 |

中文释义、例句、等级信息不完整的词条进入待核实池（`status: 待核实`，缺失字段留空标“待补”），绝不编造。

教材以《新延世韩国语》1–6 册为准，课文、页码、语法点以实书为准，不编造。

## 语法数据来源与版权

- 来源：《新延世韩国语》1–6 册《词汇与语法》分册，数据文件 `data/grammar.json`（正文 400 点 + 附录 280 条；附录只在数据层，页面仅展示正文）。
- 版权：商业教材，无开放许可；内容提取自用户提供的扫描件，**仅供个人学习使用**，应用内展示时标注来源，不声称官方授权。
- 质量：5–6 册为韩文原版、无中文别册，`meaningZh` 为空的点（正文 159 点）页面显示“待补”，不编造；例句全部来自书内原文。

## 主视觉照片来源与许可

- 首页主视觉：`public/images/garden-hero.jpg`，Pexels 真实摄影《Close-up of Pink Garden Roses in Low Light》，摄影师 Erika Kujek，来源页 https://www.pexels.com/photo/close-up-of-pink-garden-roses-in-low-light-33966578/ ，许可 Pexels License（免费可商用，无需署名），许可全文 https://www.pexels.com/license/ 。1600×1067，约 115 KB，进 PWA 预缓存。
- 备选图：`public/images/garden-hero-alt.jpg`（Mysara Hassan，Pexels License），暂未使用。
- 字体：Google Fonts CDN（Cormorant Garamond / Noto Serif SC / Noto Sans SC，`display=swap`）；离线或加载失败时回退系统字体，不断站。

## 本地运行

要求：Node.js ≥ 24（ts-fsrs v6 要求；本机实测 Node v24.22.1）。

```bash
npm install
npm run dev      # 开发模式：http://localhost:5173
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 本地预览生产构建：http://127.0.0.1:4173/topik-master-2027/
npm run test:fsrs  # Node 端 ts-fsrs 调度测试
```

自测页已移入设置页底部（`src/pages/SelfTest.tsx`，开发期自检：IndexedDB 读写、ts-fsrs 调度、speechSynthesis、ko-KR 语音、Service Worker、manifest）。

## 目录结构

```
topik-master-2027/
├── public/
│   ├── images/garden-hero.jpg   # 首页主视觉（Pexels 许可，见上）
│   ├── images/garden-hero-alt.jpg  # 备选主视觉（未使用）
│   ├── manifest.webmanifest
│   ├── icon-192.png / icon-512.png  # 占位图标（纯色 + T 字，正式图标后续替换）
│   └── favicon.svg
├── scripts/
│   └── test-fsrs.mjs
├── data/
│   ├── vocab-seed.json          # NIKL A 级 925 条（已按官方文件核实）
│   ├── yonsei-1-seed.json      # 延世 1–2 册合并 1,960 条
│   ├── yonsei-3-seed.json      # 3 册 962 条
│   ├── yonsei-4-seed.json      # 4 册 1,056 条（含文化页补入）
│   ├── yonsei-5-seed.json      # 5 册 1,744 条（含文化页补入）
│   ├── yonsei-6-seed.json      # 6 册 1,830 条（含文化页补入）
│   ├── yonsei-speaking-seed.json  # 口语独有词 958 条
│   ├── grammar.json            # 语法：正文 400 点 + 附录 280 条
│   └── SOURCES.md              # 全部种子与语法的来源说明
├── src/
│   ├── lib/
│   │   ├── db.ts               # Dexie 数据层：vocab / reviews / daily_stats / questions / papers / attempts
│   │   ├── router.ts           # 手写 hash 路由
│   │   ├── review.ts           # 复习会话：到期列表、打分、连续天数
│   │   ├── stats.ts            # 学习统计聚合（只读，不编造）
│   │   ├── streak.ts           # 连续天数（周日不算断签）
│   │   ├── srs.ts              # ts-fsrs 封装
│   │   ├── scoring.ts          # 答题计分
│   │   ├── speech.ts           # speechSynthesis 封装：ko-KR，可调语速
│   │   └── import.ts           # 种子加载与题目导入
│   ├── components/
│   │   └── icons.tsx           # 细线 SVG 图标集（含四叶草）
│   ├── pages/
│   │   ├── Home.tsx            # 新首页（一屏）
│   │   ├── Grammar.tsx         # 语法学习页
│   │   ├── Vocab.tsx / Review.tsx / Practice.tsx / MockExam.tsx
│   │   ├── WrongQuestions.tsx / Plan.tsx / Focus.tsx / Stats.tsx
│   │   ├── Settings.tsx        # 备份 / 离线与安装 / 自测
│   │   ├── AnswerCard.tsx      # 答题卡（Practice 与 MockExam 共用）
│   │   └── SelfTest.tsx        # 开发期自测（挂在设置页底部）
│   ├── App.tsx                 # hash 路由入口
│   ├── index.css               # 设计系统 token（颜色 / 字体 / 圆角 / 阴影集中管理）
│   └── main.tsx
├── README.md / FEATURE_STATUS.md / CHANGELOG.md / HANDOFF_TO_CODEX.md / ACCEPTANCE.md
└── vite.config.ts              # Vite + vite-plugin-pwa（生成 Service Worker；预缓存上限 3 MiB）
```

锁定版本（`package.json` / `package-lock.json`）：dexie 4.4.7、ts-fsrs 6.0.0、vite-plugin-pwa 2.0.0、vite 8.3.6、react 19.3.1。

## 部署（GitHub Pages）

- 仓库：`chunzhiyi492-lab/topik-master-2027`（公开），`main` 分支，部署地址 https://chunzhiyi492-lab.github.io/topik-master-2027/ 。
- 同步方式：**浏览器网页端逐个上传，一文件一提交**。本地 `git push` 无凭证、GitHub 连接器写回 403，不要再试 push；改动文件先本地提交，再按依赖顺序（被引用文件先传、入口文件最后传）上传，删除时顺序相反。详见 `~/workspace/custom-skills/github_pages_browser_sync/SKILL.md`（不在仓库内）。
- 部署成功只看最后一次上传触发的 Pages 运行状态（Success）；线上页面以刷新后（Service Worker 可能缓存旧版）为准。

## 数据与隐私

- 学习数据只存在本机浏览器（IndexedDB + localStorage），不上传任何第三方；仓库里不放密钥、不放个人学习数据、不放真题 PDF / MP3（真题只链官方下载页，见 `data/SOURCES.md`）。
- 换设备后数据不会自动同步：用设置页的导出备份（整库 JSON）带过去再恢复；恢复是整库覆盖，无合并模式，恢复前请先备份。

## 已知限制（写实）

- 题库出厂为空：仓库不打包任何官方真题；听说读写练习须用户先从 topik.go.kr 下载官方真题、转 JSON 后在练习页导入（格式见 `ACCEPTANCE.md` P5 一节）。自编练习题一律标“自编练习题，非官方真题”。
- 听力音频只记文件名引用，不存音频文件本身、不进 IndexedDB、不进仓库；每次练习需重新选择本机音频文件（浏览器安全限制，页内已明示）。
- 图标是占位图（纯色 + T 字），正式图标待设计替换。
- 备份恢复是整库覆盖，无合并模式；无账号与跨设备同步。
- iPhone Safari 与 Windows 浏览器的真机验证尚未完成：本机（Linux VM）只能验证构建、预览服务与 headless Chrome 验收；发音是否出声、听力播放是否出声、25/60/70 分钟长计时、iPhone 后台计时、PWA 添加主屏幕与断网打开，需在真机上复测。详见 `ACCEPTANCE.md` 各节与 `FEATURE_STATUS.md`。
- Google Fonts 在国内可能加载慢；离线时回退系统字体，页面不断站，但品牌字体效果会降级。
- 直接在本机用命令行启动 Chromium 验证页面会被本地网络访问检查拦截，需经本地 file:// 跳转页（见 `~/workspace/topik-phase1-test/cdp-phase1.mjs`，不在仓库内）。
