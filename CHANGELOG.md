# CHANGELOG

每次功能修改记录：修改内容、测试结果、GitHub 提交状态。P7 及以前的修改记录见 `ACCEPTANCE.md` 各节；本文件从第一阶段（2026-11-09）开始记。

## 第一阶段：完整功能开发与代码交接（2026-11-09）

### 24 模块审计

- 对照源码逐项审计 24 个模块（只审代码存在性，不复测运行效果），结果见 `FEATURE_STATUS.md`：审计时已完成 6 / 部分完成 12 / 未完成 6。
- 审计方法与口径见 `FEATURE_STATUS.md` 首节；缺口最大的三项：语法学习完全缺失、出厂题库为空、学习提醒与资料库为零。

### 语法数据核查与合并

- 核查 12 个正本语法文件（`~/workspace/yonsei-*-vocab-grammar/grammar-*.json`，不含 `grammar-part-*` 中间分片）：正文 400 点 + 附录 280 条，与设计方案数字一致；正文 `meaningZh` 为空 159 点（5–6 册韩文原版无中文别册），`exampleKo` 为空 0 条；id 唯一。
- 合并为 `data/grammar.json`（正文与附录同文件，附录 `kind` 标“附录”，页面层仅展示正文）；`meaningZh` / `exampleZh` 为空留空，不编造。
- 版权判断：商业教材《新延世韩国语》1–6 册《词汇与语法》提取，无开放许可，仅供个人学习；应用内标注来源，不声称官方授权。核查报告在仓库外：`~/workspace/yonsei-grammar-check/grammar-check-report.md`。

### 新首页（`src/pages/Home.tsx`）

- 一屏完整画面：顶部波点带、品牌区（TOPIK MASTER / 2027 / ANGELIC DREAM GARDEN / "A little dream, a little progress." / 在属于自己的花园里，慢慢积累每一份进步。）、中央主视觉、今日学习区、四叶草导航、底部短句（천천히, 하지만 꾸준히. / 慢慢来，但不要停下来。）。
- 主视觉：真实花园摄影 `public/images/garden-hero.jpg`（Pexels，Erika Kujek，Pexels License，见 README）+ CSS 雾面渐变 / 颗粒 / 光晕覆盖层（文字在最上层，不模糊）；图片加载失败时下层深绿渐变仍在。
- 今日学习区接真实数据：`getDayStats`（新词 / 复习 / 正确率 / 分钟）、`countDue()`（今日待复习数）、`getStudyStreak()`（连续天数）；无数据时显示空状态，不编造。
- 复习双入口：今日学习卡片内「今日待复习」显示真实到期数（0 张时显示“今日待复习已完成”）；四叶草导航内「智能复习」进完整复习页；两处共用同一套数据与逻辑。

### Hash 路由（`src/lib/router.ts` + `src/App.tsx`）

- 手写 hash 路由，不引入 react-router；路由：`#/` 首页、`#/vocab`、`#/review`、`#/practice`（`?qtype=` / `?mode=random`）、`#/mock`、`#/wrong`、`#/plan`、`#/focus`、`#/stats`、`#/settings`、`#/grammar`。
- 支持浏览器返回、刷新恢复路由、直接访问功能页、返回首页；未知路由回首页。
- `Practice.tsx` 接受 `initialQtype` / `initialMode`：`?qtype=听力/阅读/写作` 预选随机练习题型，`?mode=random` 定位到随机抽题区（App 的回顶 effect 会跳过该情况，见代码注释）。

### 四叶草导航（`src/components/icons.tsx` + `Home.tsx`）

- 手绘 SVG 四叶草（鼠尾草绿叶 + 珍珠中心点），点开展开 10 个入口（VOCABULARY / GRAMMAR / LISTENING / READING / WRITING / MOCK TEST / RANDOM PRACTICE / STUDY TIMER / LEARNING RECORD / SMART REVIEW），全部真实可用；展开面板底部另有小字链接：错题复练 / 学习计划 / 设置。
- 图标全部 inline SVG 细线图标（描边 1.5px），不用 Emoji。

### 语法页（`src/pages/Grammar.tsx`）

- 按分册筛选（1-1 至 6-2）、搜索（语法形式与中文释义）、点开看中文解释与例句；`meaningZh` 为空显示“待补”；页底标注来源与版权说明。

### 设计系统与清理

- `src/index.css` 重写：颜色 / 字体 / 圆角 / 阴影 token 集中管理（设计方案 §3）；保留各功能页在用的旧类名（`.note` / `.pass` / `.fail` / `button.secondary` / 表格样式），只换配色。
- 删除 `src/App.css`（Vite 模板残留，全仓无引用，已核实）。
- `SelfTest` 从首页移入设置页底部，不占首页。
- `index.html`：`theme-color` 改 `#f6e8f1`，加 Google Fonts CDN（Cormorant Garamond / Noto Serif SC / Noto Sans SC，`display=swap`，离线回退系统字体）。
- `vite.config.ts`：manifest `theme_color` / `background_color` 同步为 `#f6e8f1` / `#f7f2ec`；workbox `globPatterns` 加入 `jpg`（主视觉照片进预缓存）。
- 未引入新依赖；Dexie 数据结构未改；本地存储未清空。

### 测试结果（headless Chrome CDP 实测，2026-11-09）

- 测试脚本：`~/workspace/topik-phase1-test/cdp-phase1.mjs`（不在仓库内）；全新 profile + `vite preview`（4173）。
- **39/39 通过**：首页 390×844 与 1280×900 一屏无滚动、主视觉照片 200、无横向溢出、空状态、今日待复习真实数（加载种子后 8,665 张）、打一张卡后首页同步（新词 1 / 复习 1 / 正确率 100% / 待复习 8,664 张）、四叶草展开 10 入口、导航与浏览器返回、直访与刷新恢复、练习页路由参数、语法页 400 点与搜索/筛选、其余 6 个功能页可打开、设置页含自测、无控制台报错。
- 测试中发现并修复的 3 个真问题：① 首页叠加 `#root` 的 88px 内边距导致一屏溢出 88px（`.home` 负边距抵消 + `box-sizing: border-box`）；② App 回顶 effect 在 `?mode=random` 时把随机抽题区的定位顶回顶部（该情况跳过回顶）；③ 四叶草入口英文过长导致网格项溢出（`min-width: 0` + 字号与字距收紧 + 允许换行）。
- 测试环境限制（非应用问题）：CDP `Page.reload` 被本地网络访问检查拦，刷新恢复改用“经跳转页重新打开同一地址”验证（全新文档加载、重新 parseHash，代码路径与真实刷新一致）；直接从 about:blank 导航到 127.0.0.1 同样被拦，测试经本地 file:// 跳转页。
- 未在本次验收的真机项（需她在 iPhone 上复测）：发音是否出声、听力播放是否出声、25/60/70 分钟长计时、iPhone 后台计时、PWA 添加主屏幕与断网打开、Google Fonts 国内加载速度。

### GitHub 提交状态

- 本地已提交（见 git log，提交信息“第一阶段：新首页 + hash 路由 + 语法页 + 24 模块审计与交接文档”）。
- **未上传仓库、未 git push**（本地 git push 无凭证，GitHub 连接器写回 403；上传由项目负责人用浏览器网页端逐个上传）。
