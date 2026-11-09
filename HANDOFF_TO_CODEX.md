# HANDOFF TO CODEX — TOPIK MASTER 2027 第二阶段视觉精修交接

> 交接日：2026-11-09。第一阶段（完整功能开发）已完成并本地提交，**未上传仓库**（上传由项目负责人用浏览器做）。第二阶段只做视觉精修，**不要改业务逻辑与数据结构**。

## 一、项目一句话

个人韩语 TOPIK 备考 PWA（Vite 8 + React 19 + TypeScript，Dexie/IndexedDB 本地优先，无后端、无账号），目标 2027 年 4 月 TOPIK II 保 4 冲 5；线上地址 https://chunzhiyi492-lab.github.io/topik-master-2027/ 。

## 二、技术架构

| 层 | 说明 |
|---|---|
| 入口 | `src/main.tsx` → `src/App.tsx`（hash 路由，见 `src/lib/router.ts`） |
| 路由 | 手写 hash 路由，不引入 react-router；`#/` 首页、`#/vocab`、`#/review`、`#/practice`（`?qtype=` / `?mode=random`）、`#/mock`、`#/wrong`、`#/plan`、`#/focus`、`#/stats`、`#/settings`、`#/grammar`；未知路由回首页 |
| 数据 | Dexie 4.4.7，库名 `topik-master-2027`，**v3**，6 张表：`vocab` / `reviews` / `daily_stats` / `questions` / `papers` / `attempts`（`src/lib/db.ts`）；不要升版本、不要改表结构 |
| 复习算法 | ts-fsrs v6（FSRS-7），封装在 `src/lib/srs.ts`，不要自研、不要改参数 |
| 发音 | 浏览器 `speechSynthesis`，`lang: ko-KR`（`src/lib/speech.ts`） |
| PWA | vite-plugin-pwa，`registerType: autoUpdate`，`navigateFallback: 'index.html'`，预缓存上限 3 MiB（主包约 2.7 MB，七批种子所致）；`base: '/topik-master-2027/'`（GitHub Pages 子路径，**不要改**） |
| 样式 | `src/index.css` 是全站唯一生效样式：设计 token（颜色 / 字体 / 圆角 / 阴影）集中在 `:root`，首页与语法页的类名也在此文件；`src/App.css` 已删除（Vite 模板残留） |
| 字体 | Google Fonts CDN（`index.html`，Cormorant Garamond / Noto Serif SC / Noto Sans SC，`display=swap`）；离线回退系统字体 |
| 部署 | GitHub Pages；同步靠浏览器网页端逐个上传（本地 `git push` 无凭证）；部署成功只看最后一次上传触发的 Pages 运行 |

## 三、组件与文件位置

| 文件 | 作用 | 第二阶段能不能动 |
|---|---|---|
| `src/pages/Home.tsx` | 首页一屏（品牌 / 主视觉 / 今日学习 / 四叶草导航 / 底部） | **重点精修对象**：只改视觉，不改数据接口与路由目标 |
| `src/index.css` | 全站样式 + 设计 token | 可以改 token 与首页类名；**不要改类名本身**（各功能页共用 `.note` / `.pass` / `.fail` / `button.secondary` / 表格样式） |
| `src/components/icons.tsx` | 细线 SVG 图标集（含四叶草） | 可以换图标画法，保持描边 1.5px、不用 Emoji |
| `src/pages/Grammar.tsx` | 语法页 | 可做视觉精修，不改数据字段与“待补”规则 |
| `src/App.tsx` | 路由入口 | **不要动**（除非修路由 bug；改动前先读 `src/lib/router.ts` 注释） |
| `src/pages/Vocab.tsx` 等 9 个功能页 | 学习功能 | **不要动业务逻辑**；如需统一样式，只改 `index.css` 中的共用类 |
| `src/lib/` 全部 | 数据层与业务逻辑 | **不要动** |
| `data/*.json` | 种子与语法数据 | **不要动**（只读；内容问题找项目负责人，不自行改数） |
| `public/images/garden-hero.jpg` | 首页主视觉（Pexels 许可） | 可以换图，**必须**是合法许可的真实摄影并更新 README 来源记录；不要用无许可图片 |
| `index.html` / `vite.config.ts` | 字体链接、manifest 颜色、PWA 配置 | 字体自托管可以做，但要实测包体积与预缓存上限（单文件不得超 3 MiB） |

## 四、数据结构（只读摘要，详见 `src/lib/db.ts`）

- `VocabEntry`：`ko / pos / zh / source / source_level / yonsei_lesson / status / example_ko / example_zh / favorite / isTestData`。铁律：不许标“官方 TOPIK X 级”，只用 NIKL-A/B/C、TOPIK-초급/중급、课程-X级参考；`zh` 为空显示“待补”，不编造。
- `ReviewRecord`：`vocabId / reviewedAt / grade（不认识/模糊/认识/很熟） / dueAt / cardJson`。
- `DailyStat`：`date / newWords / reviewedWords / correctCount / minutes`（分钟只由番茄钟写入，无记录就是 0）。
- `Question`：`stem / options / answerIndex / answer / explanation / source（必填） / status / qtype / difficulty / paperId / order / audio（文件名引用） / timeLimit`。
- `Paper` / `Attempt`：见 `db.ts`。
- 语法数据：`data/grammar.json`，`{ source, licenseNote, counts, points: [{ id, book, lesson, pattern, meaningZh, exampleKo, exampleZh, note, page, kind }] }`，正文 400 + 附录 280；附录只在数据层，页面仅展示正文。

## 五、已知问题（第二阶段注意）

1. **首页英文标题的撇号间距**：`TODAY'S STUDY` 的 `'` 后字母间距偏大（Cormorant + letter-spacing），看着像 `TODAY' S`；已把字距从 .06em 降到 .04em，仍不完美，精修时可处理（不要改文案本身）。
2. **四叶草入口英文换行**：`RANDOM PRACTICE` / `LEARNING RECORD` 在 390px 宽下会换两行（已允许换行、不再溢出），精修时可统一行高或微调字号。
3. **Google Fonts 国内加载慢**：离线回退系统字体；如改自托管 woff2，须实测包体积（Noto Serif SC 完整文件数 MB，需子集化）与预缓存上限。
4. **主视觉照片是单张横版**：`garden-hero.jpg`（1600×1067）在 16dvh 通栏区用 `background-position: center 38%` 裁切；换图时注意横版与暗调，备选竖版图 `garden-hero-alt.jpg` 在仓库内（未使用）。
5. **PWA 图标仍是 T0 占位图**（纯色 + T 字），正式图标待设计替换（`public/icon-192.png` / `icon-512.png`）。
6. **真机未测**：发音是否出声、听力播放是否出声、25/60/70 分钟长计时、iPhone 后台计时、PWA 添加主屏幕与断网打开、Google Fonts 国内加载速度——均需真机复测，改视觉时不要把这些当成已验证。
7. **Service Worker 缓存旧版**：改完部署后，线上页面首次打开可能仍显示旧版，刷新后才更新；验收时务必刷新后再看。

## 六、视觉修改注意事项

- **首页视觉可单独改，不影响学习功能**：首页只读 `getDayStats` / `countDue` / `getStudyStreak` 三个只读接口（`src/lib/stats.ts` / `src/lib/review.ts`），改布局、颜色、动效都不会碰到写库逻辑；但**不要删**今日学习区的数字与「今日待复习」按钮（复习双入口是已确认的设计决策）。
- **克制原则**：LESS DECORATION, MORE ATMOSPHERE；每页一个核心视觉主体；不要每张卡片都加蕾丝/蝴蝶结、不要每个按钮都做成花朵、不要用随机 Emoji 当图标；装饰只走边缘。
- **色彩与字体以 `src/index.css` 的 `:root` token 为准**：Lace Pink `#F6E8F1` / Ivory `#F7F2EC` / Vintage Rose `#C99AAF` / Dusty Pink `#E8C5D8` / Forest `#202820` / Moss `#78866B` / Sage `#A5AA94` / Pearl `#EDE5E9` / Plum `#554052`；英文标题 Cormorant Garamond，中文标题 Noto Serif SC，正文 Noto Sans SC，韩语学习内容字号不小于 15px。
- **移动端基准 390×844**：首页闭合态必须一屏无滚动（已实测 `scrollHeight == innerHeight`）；四叶草展开后允许滚动；点击区不小于 52px 高；`100dvh` + `env(safe-area-inset-bottom)` 已处理。
- **动效只用 `transform` / `opacity`**：不要大面积 `backdrop-filter`（iPhone Safari 性能）；`prefers-reduced-motion` 时停用动效（`index.css` 已有媒体查询）。
- **不要引入新依赖**；不要把静态图片冒充真实功能；不要伪造学习记录；没有真实数据时显示空状态。

## 七、本地验证

```bash
npm install
npm run build    # 类型检查 + 生产构建（必须通过）
npm run preview  # http://127.0.0.1:4173/topik-master-2027/
```

- headless Chrome 验收脚本在仓库外：`~/workspace/topik-phase1-test/cdp-phase1.mjs`（39 项，含真实数据闭环；直接从 about:blank 导航到 127.0.0.1 会被本地网络访问检查拦，脚本内已用 file:// 跳转页绕过）。
- 改完先 `npm run build`，再跑验收脚本，39/39 通过才能交；把结果追加进 `CHANGELOG.md`。
