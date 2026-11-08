# TOPIK MASTER 2027 — T0 验收

验收日：2026-11-07。逐条打勾，只写实测结果，不写“应该没问题”。

## 通过（本机实测通过）

- [x] **项目目录正常**：`~/workspace/topik-master-2027`，Vite react-ts 脚手架，`git init -b main` 已完成，初始提交待做（见下方备注）。
- [x] **`npm install` 通过**：353 个包安装成功，锁定 dexie 4.4.7、ts-fsrs 6.0.0、vite-plugin-pwa 2.0.0、vite 8.3.6、react 19.3.1。
- [x] **`npm run build` 通过**：`tsc -b && vite build` 退出 0；产物 `dist/` 含 `sw.js`、`manifest.webmanifest`、`icon-192.png`、`icon-512.png`；PWA 提示 precache 20 个文件（399.54 KiB）。
- [x] **`npm run preview` 能启动**：`http://localhost:4173/` 返回 200；`/`、`/manifest.webmanifest`、`/sw.js` 三者均为 200。
- [x] **`npm run test:fsrs` 通过**：新建卡片 review Good 后 due 为 2026-11-11T18:39:55.164Z（约 4.78 天后），review Again 后 due 为 2026-11-07T00:01:00.000Z（1 分钟后），Good 间隔 > Again 间隔；序列化往返 dueAt 一致；preview 返回 4 档 [1, 2, 3, 4]。
- [x] **IndexedDB 数据层代码就绪**：`src/lib/db.ts`，Dexie 库 `topik-master-2027`，表 vocab / reviews / daily_stats，提供写入 / 读取 / 导出 JSON；仅 3 条测试数据（테스트01–03，标注“测试数据，非教材词汇”，无中文释义、无例句）。
- [x] **SRS 层代码就绪**：`src/lib/srs.ts`，ts-fsrs DefaultScheduler（FSRS-7 默认参数），四档映射 不认识 Again / 模糊 Hard / 认识 Good / 很熟 Easy，序列化 / 反序列化函数齐全。
- [x] **发音层代码就绪**：`src/lib/speech.ts`，speechSynthesis 封装，ko-KR，可调语速，`listKoreanVoices()` 无语音时返回空数组并给原因；首页有“测试发音”按钮（读 안녕하세요）。
- [x] **自测页代码就绪**：`src/pages/SelfTest.tsx`，打开自动跑 6 项（IndexedDB、ts-fsrs、speechSynthesis、ko-KR 语音、Service Worker、manifest），显示 PASS / FAIL / 未测，结果写 localStorage（`topik-master-t0-selftest`），含 userAgent 与测试时间。
- [x] **PWA manifest / SW 代码就绪**：`public/manifest.webmanifest`（name TOPIK MASTER 2027，简体中文，standalone），`vite.config.ts` 用 vite-plugin-pwa 生成 SW；构建产物已验证含 `sw.js` 与 `manifest.webmanifest`。
- [x] **文档齐全**：README.md（含建库与推送步骤、已知限制）、TASKS.md、ACCEPTANCE.md（本文件）、TEST-REPORT-T0.md。
- [x] **无编造内容**：库内无任何延世课文词汇、中文释义、例句、页码、考试成绩；测试词明确标注为测试数据。
- [x] **无密钥、无上传**：仓库内无密钥，代码无任何向第三方上传数据的逻辑；GitHub 私有仓接口创建失败（403）后未再试，只做本地 git init。

## 未测（必须真机验证，不算通过）

- [ ] **iPhone Safari 打开自测页**：IndexedDB、ko-KR 语音、Service Worker、manifest 安装项均待真机结果。
- [ ] **Windows 浏览器打开自测页**：同上，待真机结果。
- [ ] **Service Worker 激活与离线打开**：本机 Chromium 无法直接启动验证（见 TEST-REPORT-T0.md），构建产物含 sw.js 只能证明“生成成功”，不能证明“浏览器内已激活、离线可用”。
- [ ] **ko-KR 语音实际可用性**：本机无浏览器语音可测；iPhone 与 Windows 各自的韩语语音数量与音质待真机自测页结果。

## 未完成（不在 T0 范围内，按计划留待后续）

- [ ] GitHub 私有仓 `topik-master-2027` 手动创建与推送（等用户在 github.com 建好空仓后按 README 推送）。
- [ ] 正式图标替换（当前为占位图）。
- [ ] T1–T7 全部功能。

## 备注

- 构建过程中修过 2 个真实问题，均已记录在 TEST-REPORT-T0.md §4：① `preview()` 返回可迭代对象而非数组，测试脚本 `length` 判断失效；② ts-fsrs v6 的 FSRS-6 / FSRS-7 卡片类型同名不同构，`tsc` 报错，srs.ts 在边界处做了明确标注的类型适配（运行时字段一致，Node 实测通过）。
- 本地 git 初始提交作者为占位身份，推送前需改成本人身份（见 README“建库与推送步骤”第 2 步）。

---

# P1 验收 — 词汇地基（#8、#4、#1）

验收日：2026-11-07。分支 `feature/p1-vocab-foundation`（从 main 的 3c436e1 切出），未合并、未 push。
验证环境：本机 headless Chrome 155（全新 profile，CDP 实测）+ `npx vite preview --host 127.0.0.1 --port 4173`。
只写实测结果，不写“应该没问题”。

## 通过（本机实测通过）

- [x] **`npm run build` 通过**：`tsc -b && vite build` 退出 0；PWA precache 20 个文件（749.19 KiB）。种子 JSON 以静态导入打进主 chunk（index 约 687 KB，构建有 chunk 体积警告，见下方“已知不足”）。
- [x] **`npm run test:fsrs` 通过**：PASS，四档齐全，序列化正常（与 T0 一致，srs.ts 未动）。
- [x] **种子加载（#8）**：全新 profile 下点“加载种子”，结果：新增 NIKL **925** 条、新增延世 **247** 条、两批合并 **128** 条、已存在跳过 **0** 条；库内共 **1172** 条，待核实池 **1172** 条。925 + 375 − 128（两批相同韩文词）= 1172，与事前 Python 核对一致。
- [x] **全部种子只进待核实池**：待核实池按来源：NIKL 925 条、课程参考 247 条；按状态筛选“已核实”得 **0** 条。延世文件里 371 条写的是“已核实”，加载器已强制改成“待核实”（页面有文字说明）。
- [x] **合并补字段实测**：搜“한국”得 3 条，其中 `한국` 一条为 NIKL · NIKL-A + 中文“韩国”+ 课次 1册1课（延世的中文释义与课次已补进 NIKL 条，未另建新条）。
- [x] **无中文释义显示“待补”**：`것01`（NIKL，无中文释义）显示“待补”；`기자`（延世 4 条无释义词之一）显示“待补”。全文无编造释义。
- [x] **搜索（#4）**：搜“안녕”得 **4** 条（안녕하다、안녕히、안녕、안녕하십니까）；搜中文“问候”得 **1** 条（인사）。
- [x] **筛选（#4）**：延世课次“1册1课”得 39 条（种子口径；验证 profile 因另有 2 条测试导入，实测为 41 条）；来源分级 NIKL-A 得 925 条、课程-1级参考得 247 条；词性“동사”得 151 条；状态“待核实”得全库、“已核实”得 0 条。收藏：点 ☆ 变 ★，勾“仅看收藏”后只剩该 1 条。
- [x] **每日背词计划（#1）**：默认目标 20 个，今日新词列表正好 **20** 条；改目标为 5 个后列表正好 **5** 条；改回 20 个后恢复 20 条。目标存 localStorage（`topik-master-p1-daily-target`）。
- [x] **刷新后数据不丢失**：重新打开页面再进词汇页，库内仍为 1172 条，今日新词仍为 20 条（IndexedDB 持久化）。
- [x] **重复加载不重复入库**：第二次点“加载种子”，新增 0 条、已存在跳过 1300 条，库内仍为 1172 条。
- [x] **文件导入（#8）**：CSV 导入 1 条（测试文件，仅验证用 profile）→ 新增 1 条，库内 1173 条；JSON 导入 1 条 → 新增 1 条，库内 1174 条。两条测试词只存在于验证用的全新浏览器 profile 里，不在仓库、不在任何持久数据里。
- [x] **截图**：桌面 1280×800 与手机 390×844 各一张（Vocab 页），`~/workspace/p1-vocab/desktop-1280.png`、`~/workspace/p1-vocab/mobile-390.png`；桌面横向溢出 −15px、手机 0px，均无溢出。
- [x] **改动范围守住了**：只改动 `src/lib/import.ts`（新建）、`src/pages/Vocab.tsx`（新建）、`src/lib/db.ts`（仅新增 6 个查询函数）、`src/App.tsx`（仅加“词汇”入口）、`ACCEPTANCE.md`（追加本节）。三个原型页、srs.ts、speech.ts、SelfTest.tsx、data/、scripts/、vite.config.ts、PWA 配置、package.json 均未动；无新依赖；未写任何演示假词进正式词库（T0 的 3 条测试词原样不动）。

## 已知不足 / 未测

- [ ] **iPhone 与 Windows 真机未测**：朗读、触摸、Safari 下 IndexedDB 持久化均待真机复测（同 T0）。
- [ ] **主 chunk 体积警告**：两批种子 JSON 静态导入后主 chunk 约 687 KB，构建报 chunk-size 警告。后续阶段如需优化，可把种子改成运行时 `fetch` 加载或动态 import；不影响 P1 功能。
- [ ] **浏览列表只显示前 200 条**：超过 200 条的筛选结果需缩小筛选范围；分页留待后续阶段。
- [ ] **“未学”的定义**：今日新词 = 没有任何复习记录的词，按入库顺序取前 N 条。P2 接入复习记录后，学过的词自动从今日列表消失（逻辑已就绪：`getUnlearnedVocab` 按 reviews 表排除）。


## P2 复习核心（#2 / #3 / #7 / #5）——2026-11-08

分支：`feature/p2-review-core`（worktree `~/workspace/topik-master-2027-p2`，基于 main ddd7d6d）。

### 改动文件
- 新增 `src/lib/review.ts`（到期列表、今日复习统计、连续天数——周日不算断签、错词本、收藏复习、随机抽词，全部纯函数 + IndexedDB 查询）
- 新增 `src/pages/Review.tsx`（到期复习 / 错词复练 / 收藏复习三队列、复习卡片、四档打分 + FSRS 预览、随机抽词、错词本、收藏、掌握度筛选）
- `src/lib/db.ts`：只新增 5 个查询函数 `getAllReviews` / `getLatestReviewByVocab` / `getLatestGradeMap` / `getWrongVocab` / `getVocabByMastery`，表结构与 Dexie 版本未动
- `src/App.tsx`：只加首页“复习”按钮 + Review 页入口；词汇、金属风、四叶草三个入口保留，手账入口未加回
- `scripts/test-streak.mjs`：连续天数规则单测（10 个用例；已随提交入库，可直接 `node scripts/test-streak.mjs` 运行，但未接进 package.json 的 npm scripts）

### 构建与测试（worktree 内实测）
- `npm run build`：通过。`dist/index.html` 741.34 KiB；precache 20 个条目。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致（Again 约 1 分钟、Hard 约 14 小时、Good 约 4.8 天、Easy 约 54 天）。
- `node scripts/test-streak.mjs`：10/10 通过。覆盖：周日不算断签（周六→周一算连续、周日缺勤不算断）、昨天未学算断、今天已学算连续、空记录 0 天、重复打卡去重。

### 真机浏览器实测（npm run preview，端口 4174，全新 Chrome profile）
先在词汇页点“加载种子”：新增 NIKL 925 条、新增延世 247 条、两批合并 128 条，库内共 1172 条，待核实池 1172 条。

| 验收项 | 实测结果 |
|---|---|
| 到期列表只含到期卡片 | 初始“今日到期 1172 张”；打“认识”后 1171 张；打“不认识”后 1170 张；刷新后仍 1170 张 |
| 打分后间隔按 FSRS 变长，预览与结果一致 | 第一张 것01：打分前预览“认识 · 下次约 4.8 天后（11月12日）”，打分后结果“下次到期：11月12日 11:19（约 4.8 天后（11月12日））”，一致。四档预览分别为 不认识 ~1 分钟、模糊 ~14 小时、认识 ~4.8 天、很熟 ~53.9 天 |
| 打分后该词从今日新词列表消失 | 것01 打“认识”后，词汇页今日新词列表里查不到它（前 3 条变为 하다01、있다01、되다01）。注：列表仍显示 20 条是符合设计的——今日新词取前 20 个未学词，打过分的词被下一条未学词补位 |
| 刷新后进度不丢失 | 刷新后：今日到期 1170 张、今天已复习 3 张、连续学习 1 天，与刷新前一致 |
| 连续天数按“周日不算断签”计算 | 刷新后显示连续学习 1 天；规则单测 10/10 通过（见上） |
| 随机抽词连续抽 10 次无重复、无报错 | 10 次抽到 아이01、허리01、길01、물어보다、예쁘다、셋째、좀¹、먹다、테니스를 치다、그리고，10 个互不相同；页面显示“本轮已抽 10 张” |
| 收藏切换即时生效 | 当前卡 있다01 点“☆ 收藏”后立即变为“★ 已收藏”，收藏计数变为 1 |
| 错词本只含打过“不认识/模糊”的词 | 하다01 打“不认识”后错词复练（1）；点“开始复习错词”进来的就是 하다01；再打“认识”后错词复练（0），不再出现在错词本 |
| 掌握度标记与筛选 | 打分后卡片显示掌握度（것01 认识、하다01 认识、있다01 不认识）；筛选结果：认识 2 个、不认识 0 个（하다01 最新一次已是“认识”）、未学 1170 个 |
| “不认识”约 1 分钟后真的再次到期 | 있다01 打“不认识”（下次到期约 1 分钟后），等 75 秒后刷新，今日到期从 1169 张回升到 1170 张——该卡再次到期 |

截图（`~/workspace/p2-review/`，不进仓库）：`desktop-1280.png`、`mobile-390.png`。桌面与手机均无横向溢出（scrollWidth - innerWidth：桌面 -15、手机 0）。

### 已知不足（老实写）
- 未在 iPhone / Windows 真机上测（与 P1 同款待办）；朗读按钮未在本阶段加（发音是 P3 #6 的事）。
- `getVocabByMastery` 已写好，但词汇页（Vocab.tsx）本阶段冻结未动，所以掌握度筛选目前只在复习页可用；词汇页接筛选留给 P3。
- 桌面截图里打分预览显示“认识 · 下次约 31 分钟后”——这是 있다01 打过一次“不认识”后的 FSRS 状态（Again 之后间隔变短），不是 bug。

## P3 发音与统计（#6 / #21 / #20）——2026-11-08

分支：`feature/p3-pronunciation-stats`（worktree `~/workspace/topik-master-2027-p3`，基于 main 446e351）。

### 改动文件
- 新建 `src/lib/stats.ts`（聚合函数：`getDayStats` / `getWeekStats` / `getStudiedDates` / `getMonthCells` / `buildDailyExport`）
- 新建 `src/pages/Stats.tsx`（今日统计 + 最近 7 天 + 打卡日历 + 导出当日 JSON）
- `src/pages/Vocab.tsx`：浏览表加“发音”列（每行一个 🔊 发音按钮）与“发音（#6）”区（语速滑块 0.5–1.5 + 语音状态提示）；筛选区加“掌握度”下拉（P2 留给 P3 的收尾，用已有的 `getVocabByMastery`）
- `src/pages/Review.tsx`：复习卡片与随机抽词卡片加 🔊 发音按钮；卡片区加语速滑块 + 语音状态提示
- `src/App.tsx`：只加首页“统计”按钮 + Stats 页入口；版本说明改成 P3；词汇、复习、金属风、四叶草入口保留
- 语速存在 localStorage（`topik-master-speech-rate`，默认 0.9），词汇页与复习页共用；`speech.ts` / `srs.ts` / `streak.ts` / `SelfTest.tsx` 未动

### 口径（写死，防以后扯皮）
- 新词数 = 当天第一次打分的词数（按 reviews 表里每条词的最早复习日期算）。`DailyStat.newWords` 从来没人写过，不读它。
- 复习数 = 当天复习记录条数；正确率 = 打“认识 / 很熟”的占比；无复习记录时正确率显示“暂无”。
- 学习分钟数只取 `DailyStat.minutes`（P4 番茄钟写入后才有数），无记录就是 0 分钟，P3 不编造。
- 打卡：有复习记录的日期即已学；周日显示“休息”，不记缺勤、不算断签（复用 P2 的 `streak.ts`）。

### 构建与测试（worktree 内实测）
- `npm run build`：通过。precache 20 个条目（751.73 KiB）；主 chunk 体积警告是 P1 已有的问题。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致（Again 约 1 分钟、Hard 约 14 小时、Good 约 4.8 天、Easy 约 54 天）。

### 真机浏览器实测（npm run preview，端口 4175，全新 Chrome profile）
先在词汇页点“加载种子”：库内共 1172 条。再进复习页打 5 张分：것01、하다01、있다01 打“认识”，되다01、수02 打“不认识”（顺序即到期顺序）。

| 验收项 | 实测结果 |
|---|---|
| 词条发音调用路径真实触发 | 本机 headless Chrome 无韩语语音，**没有听到声音，不谎称听到了**。验证方法：CDP 注入包装了 `speechSynthesis.speak`，点发音后捕获到真实 utterance：`{ text: '나03', lang: 'ko-KR', rate: 0.5 }`；按钮在点击后 100ms 时显示“朗读中…”；页面语音提示明确写着“语音列表为空：浏览器语音尚未加载完成，请稍候再试（等 voiceschanged 事件）”。**需 iPhone 真机复测是否真的出声** |
| 语速滑块 0.5 → utterance.rate 确为 0.5，滑回 1.0 恢复 | 滑到 0.5 后点发音，捕获的 utterance.rate = 0.5、lang = ko-KR；滑回 1.0 后再点，rate = 1。滑块显示同步变为 0.5x / 1.0x |
| 统计页数字与当天实际操作一致 | 今日：新词 5 个、复习 5 张、正确率 60%（答对 3 / 5）、学习分钟 0 分钟（附注“番茄钟尚未开发，P4 接入后才有数”）、连续学习 1 天；7 天合计：新词 5 个 · 复习 5 张 · 正确率 60% · 学习 0 分钟，与 5 张打分记录逐项对得上 |
| 日历标出已学日期；周日显示休息、不记缺勤 | 2026 年 11 月日历逐格核对：周日 1 / 8 / 15 / 22 / 29 日格都写“休息”；今天 11 月 8 日（周日）那格是“8 休息 ● 已学 今天”——学了照常标已学，休息与已学不冲突；连续天数仍按“周日不算断签”算（显示 1 天） |
| 导出当日 JSON 能下载，内容与页面数字一致 | 点“导出当日 JSON”后下载到 `topik-stats-2026-11-08.json`，内容 `day: { date: '2026-11-08', newWords: 5, reviewedWords: 5, correctCount: 3, accuracy: 0.6, minutes: 0 }`，与页面数字一致；页面同时显示导出回执 |
| 掌握度筛选在词汇页可用 | 词汇页选掌握度“认识”→ 共 3 条；选“不认识”→ 共 2 条，与 5 张打分记录一致 |
| 横向溢出 | 桌面 1280 统计页无溢出；手机 390 统计页 scrollWidth - innerWidth = 0，无溢出 |

截图（`~/workspace/p3-stats/`，不进仓库）：`stats-desktop-1280.png`、`stats-mobile-390.png`、`vocab-pronounce-closeup.png`。三张都逐张看过：统计页今日/7 天数字与实测一致；词汇页特写里语速滑块、语音提示、每行 🔊 发音按钮都在。

### 已知不足（老实写）
- **本机没听到声音**：headless Chrome 无韩语语音（`getVoices()` 为空），发音只验证到调用路径与 utterance 参数；是否真的出声、语速变化是否可感知，**必须 iPhone 真机复测**（T0 时 iPhone 的 ko-KR 语音是验证通过的）。
- 未在 iPhone / Windows 真机上测（与 P1、P2 同款待办）。
- **SelfTest 测试词短暂漏进复习队列（T0 旧行为，P3 未改）**：第一轮验收时，脚本在首页刚渲染就点进复习页，第一张卡读到的是 `테스트01`——首页 `SelfTest` 每次挂载都会先写 3 条测试词再删，窗口期只有几毫秒，但快速跳转正好撞上，测试词短暂进了到期队列且被打了一次分（该条打分记录留在库里，测试词本身已被 SelfTest 删掉）。重跑时加了等待（等自测跑完、等队列加载完），5 张分全打在真实词上。`SelfTest.tsx` 在 P3 禁改清单里，没动；P4 已修（见 P4 一节）。

## P4 计划与专注（#19 / #18 / #22）——2026-11-08

分支：`feature/p4-plan-focus`（worktree `~/workspace/topik-master-2027-p4`，基于 main 4ae0d7a）。

### 改动文件
- 新建 `src/pages/Plan.tsx`（每日课表 + TOPIK 目标进度；默认课表就是她确认的真实课表，见下）
- 新建 `src/pages/Focus.tsx`（番茄钟：专注 / 短休息 / 长休息，时长可调，时间戳计时）
- `src/lib/review.ts`：仅串位修复——`getDueList` 与 `getRandomVocab` 排除 `isTestData` 的词（见下）
- `src/App.tsx`：只加首页“计划”“专注”按钮 + 两个入口；版本说明改成 P4；词汇、复习、统计、金属风、四叶草入口保留
- `speech.ts` / `srs.ts` / `streak.ts` / `SelfTest.tsx` / `Vocab.tsx` / `Stats.tsx` / `data/` / `scripts/` / `vite.config` / PWA / `package.json` 未动；未升 Dexie 版本；无新依赖；未写假词进词库

### 默认课表（她确认的真实课表，2026-10-26 起执行）
- 韩语（周一到周六每天相同）：09:00–09:30 发音与拼读、09:30–11:00 延世教材、14:00–14:45 听力与跟读、14:45–15:30 阅读与词汇、15:30–16:00 TOPIK 专项与复盘
- 专业课 17:30–19:30 按周分科：周一计组、周二高数 1、周三计组、周四离散、周五计组 1h + 高数 1h、周六离散 1h + 本周最弱科目 1h
- 英语 20:00–21:00；周日整天休息，无正式课程
- 每节课的时间、科目、内容都可改，改完点“保存课表”进 localStorage（`topik-master-plan`）；“恢复默认课表”可一键还原。

### 口径（写死，防以后扯皮）
- 番茄钟分钟数：只有走完一整轮专注才记分钟（结束时把本轮分钟数加进 `DailyStat.minutes`），暂停、重置、中途放弃不记。统计页“学习分钟”只取 `DailyStat.minutes`。
- 目标进度：距考试天数按 2027 年 4 月 1 日估算（2027 年 4 月 TOPIK 确切日期以 NIIED 官方公布为准，不编造），页面有标注；词汇覆盖 = 累计第一次打分的词数 ÷ 库内词总数；累计复习 = 复习记录总条数；连续天数按 `streak.ts`（周日不算断签）。
- 番茄钟时长设置存在 localStorage（`topik-master-focus-settings`，专注默认 25、短休息 5、长休息 15）；计时器状态（模式、结束时间点、是否进行中）也存在 localStorage（`topik-master-focus-timer`），刷新不丢。

### 自测词串位修复（T0 遗留问题，P3 验收时撞上过）
- 原因：首页 `SelfTest` 每次挂载都会先写 3 条测试词（`테스트01/02/03`，`isTestData=true`）再删，窗口期只有几毫秒；快速点进复习页正好撞上时，测试词短暂进到期队列、还可能被打分。
- 修法：只改队列侧——`review.ts` 的 `getDueList` 与 `getRandomVocab` 排除 `isTestData` 的词；`SelfTest.tsx` 本身的自测逻辑未动（它写了又删是原有行为）。
- 注意：词汇页“今日新词”走 `db.ts` 的 `getUnlearnedVocab`，`db.ts` 不在本阶段改动范围里，理论上同一毫秒窗口里测试词也可能在那一闪而过——窗口极小且词随即被删，未改，留待以后如需再处理。

### 构建与测试（worktree 内实测）
- `npm run build`：通过。precache 20 个条目（765.73 KiB）；主 chunk 体积警告是 P1 已有的问题。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致（Again 约 1 分钟、Hard 约 14 小时、Good 约 4.8 天、Easy 约 54 天）。

### 真机浏览器实测（npm run preview，端口 4176，全新 Chrome profile）
先在词汇页点“加载种子”：库内共 1172 条。再进复习页打 3 张分：것01、하다01 打“认识”，있다01 打“不认识”。**今天是 2026-11-08，周日**，所以计划页默认显示周日休息。

| 验收项 | 实测结果 |
|---|---|
| 首页版本说明为 P4，首页有“计划”“专注”按钮 | 通过（“当前版本：P4 计划与专注”） |
| 周一课表时间逐项正确 | 14 个时间输入值逐项核对：09:00、09:30、09:30、11:00、14:00、14:45、14:45、15:30、15:30、16:00、17:30、19:30、20:00、21:00，全部正确 |
| 周一课表科目/内容逐项正确 | 科目：韩语×5、专业课、英语；内容：发音与拼读、延世教材、听力与跟读、阅读与词汇、TOPIK 专项与复盘、计算机组成原理、英语学习（读 input 值核对，innerText 不含 input 值） |
| 今天是周日，计划页默认显示休息 | 通过（“周日休息，没有正式课程”）；手机计划页同样默认显示休息 |
| 改一节课的时间后保存、刷新还在 | 周一第一节 09:00 改成 08:30，点“保存课表”，刷新后仍是 08:30；再点“恢复默认课表”回到 09:00 |
| 目标页显示距考试天数、目标等级、准备进度随真实记录变化 | 距考试 144 天（按 2027 年 4 月 1 日估算，页面有标注）；目标等级“保 4 冲 5”；打 3 张分后词汇覆盖“已学 3 / 库内 1172 个词”、累计复习 3 张、连续学习 1 天 |
| 番茄钟专注 1 分钟真实走完，记 1 分钟 | 专注时长调到 1 分钟，时钟显示 01:00，点“开始”后**真实等了约 60 秒**走完（不是谎称等了 25 分钟），页面显示“专注完成，已记 1 分钟”，“今天已专注 1 分钟” |
| 统计页“学习分钟”随番茄钟变为 1 | 通过（统计页今日“学习分钟”= 1 分钟；第一次读数时统计表还没渲染完，属脚本时序问题，重测通过） |
| 暂停后剩余时间冻结，继续、重置可用 | 短休息轮开始 2 秒后暂停，2.5 秒后剩余时间不变（04:57 → 04:57）；点“继续”接着走，点“重置本轮”回到整轮 |
| 专注时长调回 25 分钟，默认值正确 | 通过（时钟显示 25:00；短休息默认 5、长休息默认 15） |
| 自测词串位修复：连续 5 次立即进复习页，测试词 0 次出现 | 打开首页后立刻点进复习页（不加等待），连续试 5 次，到期队列第一张每次都是真实词（本轮第 1 / 1170 张），一次都没出现 테스트01/02/03 |
| 横向溢出 | 计划页、专注页桌面与手机均无横向溢出（scrollWidth − innerWidth：桌面 −15、手机 0） |

截图（`~/workspace/p4-plan/`，不进仓库）：`plan-desktop-1280.png`（周一课表）、`plan-mobile-390.png`（周日休息 + 目标进度）、`focus-desktop-1280.png`、`focus-mobile-390.png`。四张都逐张看过：周一 7 节课时间/科目/内容都在；专注页 25:00、“今天已专注 1 分钟”、时长设置 25/5/15 都在；手机两张无溢出。注：时间输入框在 headless Chrome 里显示为 12 小时制（09:00 AM），是浏览器原生渲染，值本身是 24 小时制，已用 DOM 值核对过，不是 bug。

### 已知不足（老实写）
- **25 分钟专注轮没有真实等过**：只把时长调到 1 分钟真实走完验证了“走完 → 记分钟”的链路；25 分钟轮的完整走完未实测（只验证了时钟显示 25:00 与默认值）。iPhone 后台计时（切后台再回来）也未实测——计时按结束时间点算，理论上回来后按时间点补算不丢，但 Safari 后台行为**必须真机复测**。
- 未在 iPhone / Windows 真机上测（与 P1–P3 同款待办）；发音仍需 iPhone 复测是否真的出声（P3 遗留）。
- 词汇覆盖 3/1172 显示为 0%（四舍五入），数字本身是对的，只是刚开始学时百分比看着小。

## P5 试题地基（#9 / #17 / #10）——2026-11-08

分支：`feature/p5-question-bank`（worktree `~/workspace/topik-master-2027-p5`，基于 main 217b641）。

首批题目来源已定：**官方真题本地导入**（她 2026-11-08 23:18 决定）。用户从 topik.go.kr 下载官方真题 PDF 后发来，届时再做成导入格式。**本阶段不编造任何题目、不写任何真题或自编题进仓库**——题库出厂是空的，只搭模型与导入器。

### 改动文件
- `src/lib/db.ts`：升到 Dexie version 2，新建 `questions` / `papers` / `attempts` 三张表；新增查询函数与 `importQuestionBank` 导入器；`clearAllData` 扩展到新表（Dexie transaction 参数上限 7 个，6 张表改逐表清空）；`clearQuestionBank` 只清题库三张表。
- 新建 `src/pages/Practice.tsx`（试卷练习 + 随机抽题 + JSON 导入 + 清空题库）。
- `src/App.tsx`：只加首页“练习”入口；版本说明改成 P5；词汇、复习、统计、计划、专注、金属风、四叶草入口保留。
- `speech.ts` / `srs.ts` / `streak.ts` / `review.ts` / `stats.ts` / `SelfTest.tsx` / `Vocab.tsx` / `Review.tsx` / `Stats.tsx` / `Plan.tsx` / `Focus.tsx` / `data/` / `scripts/` / `vite.config` / PWA / `package.json` 未动；无新依赖；未写任何题目进仓库。

### 导入格式说明（P5 导入器 `importQuestionBank`）
- 文件：单个 JSON，顶层对象 `{ papers?: [...], questions?: [...] }`，两数组至少一个非空。
- 试卷字段：`title`（必填，场次，如“TOPIK 84회”）、`level`（级别，如“TOPIK II”，可空）、`examDate`（考试日期 YYYY-MM-DD，可空）、`source`（必填）、`status`（已核实 / 待核实，缺省“待核实”）、`note`（备注，可空）。同名试卷复用已有试卷，不重复建卷。
- 题目字段：`stem`（必填，题干）、`options`（选项数组；主观题/写作题为空数组）、`answerIndex`（客观题必填，为正确选项下标；主观题必须为空）、`answer`（参考答案/评分要点，可空）、`explanation`（解析，可空）、`source`（必填）、`status`（已核实 / 待核实，缺省“待核实”）、`qtype`（必填：听力/阅读/写作/词汇/语法/其他）、`difficulty`（易/中/难，缺省“中”）、`paperTitle`（所属试卷标题，可空；写了就必须对应上已导入或已有的试卷）、`order`（卷内题序，可空，缺省按导入顺序）。
- 校验铁律：题干、来源、题型缺一不可，缺来源的条目拒绝入库并逐条报错、不静默丢弃；客观题 answerIndex 超出选项范围拒绝；同一试卷内题干重复的题跳过（记入重复跳过数）；先全部校验、再一次性写入。
- 最小示例结构（只写字段名与占位符，不含任何真实题目内容）：
```json
{
  "papers": [
    { "title": "（场次，如 TOPIK 84회）", "level": "TOPIK II", "examDate": "", "source": "（来源）", "status": "待核实", "note": "" }
  ],
  "questions": [
    {
      "stem": "（题干文本）", "options": ["（选项 1）", "（选项 2）"],
      "answerIndex": 0, "answer": "", "explanation": "（解析）",
      "source": "（来源）", "status": "待核实",
      "qtype": "阅读", "difficulty": "中", "paperTitle": "（场次）", "order": 1
    }
  ]
}
```

### 口径（写死，防以后扯皮）
- 错题范围 = 最新一次答题答错的题目（主观题不写 attempts，不在错题范围里）；仅未答 = 没有任何答题记录的题目。
- 正确率 = 答对次数 ÷ 答题总次数（客观题）；主观题（写作/简答）不自动判分，练习页只显示参考答案与解析，不写 attempts，判分与答题记录在 P6 写作练习里接。
- 清空题库只删 questions / papers / attempts，不碰词汇、复习、统计数据。
- 听力题的音频字段（`audio`）与写作计时字段（`timeLimit`）在 P6 再加，本阶段不加。

### 构建与测试（worktree 内实测）
- `npm run build`：通过。precache 20 个条目（779.05 KiB）；主 chunk 体积警告是 P1 已有的问题。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致（Again 约 1 分钟、Hard 约 14 小时、Good 约 4.8 天、Easy 约 54 天）。
- 构建时修过两个小错：Dexie `transaction()` 重载最多 7 个参数，`clearAllData` 的 6 张表 + mode + scope 共 8 个报类型错，改逐表清空；Practice.tsx 删了两个未用到的 import。

### Dexie 迁移实测（同一浏览器 profile、同一端口 4177，先旧版后 P5 版）
先用 main 217b641 的构建（临时 worktree `/tmp/topik-master-2027-old`，已删）打开同一 profile：加载种子（库内共 1172 条），复习页打 3 张分（것01、하다01 打“认识”，있다01 打“不认识”），统计快照：新词 3、复习 3、正确率 67%、分钟 0。然后停掉旧版服务、起 P5 构建（同一端口、同一 profile），确认首页版本说明翻到 P5 后逐项核对：词汇仍为 1172 条、复习“今天已复习 3 张”、统计新词 3、复习 3、正确率 67%——**旧数据一条不少**。

### 真机浏览器实测（npm run preview，端口 4177，全新 Chrome profile 续用迁移 profile）
测试夹具在 `~/workspace/p5-questions/fixture-papers.json`（不进仓库）：2 张试卷、每卷 3 道题，来源一律写“测试样例”，其中 1 道故意缺 `source` 字段。

| 验收项 | 实测结果 |
|---|---|
| 练习页空状态 | 题库 0 场 0 道时显示“题库目前是空的。首批题目来源已定为官方真题本地导入……”+ TOPIK 官网（topik.go.kr）学习资料室链接 + 导入入口 |
| 导入夹具 | 新增试卷 2 场（复用 0 场）、新增题目 5 道（重复跳过 0 道）、拒绝 1 条（第 6 道题缺 source，已拒绝）；试卷表：阅读卷 3 道、听力卷 2 道 |
| 试卷练习按场次练，每题显示来源与核实状态 | 阅读卷第 1 道显示“来源 测试样例 · 核实状态 待核实”；答对后显示解析与来源，答错后显示正确答案（Q2 选 B 答错，显示“正确答案：A.”） |
| 答题记录写入 attempts，刷新不丢 | 练完 3 道（2 对 1 错）后练习页显示“已答 3 次 · 正确率 67%”；刷新后仍为已答 3 次 |
| 随机抽题按题型/难度/错题范围抽取正确 | 范围“仅错题”只抽到 1 道（答错的第 2 道 학교에 갑니다）；范围“全部”抽 5 道（第 1 / 5 道） |
| 清空题库 | 试卷 0 场、题目 0 道、空状态回来；词汇仍为 1172 条（清空只动题库三张表） |
| 全库“官方真题”检索校验 | `grep -rn "官方真题" src/ data/ ACCEPTANCE.md`：全部命中都在说明性文字里（App 版本说明、db.ts 注释、Practice.tsx 注释与空状态/导入区文案），0 道题目带该标记——本阶段库里本来就没有题目 |

截图（`~/workspace/p5-questions/`，不进仓库）：`practice-desktop-1280.png`、`practice-mobile-390.png`（练习页空状态 + 导入入口）。两张都逐张看过：试卷 0 场、题目 0 道、空状态说明、随机抽题筛选、导入区、清空题库都在；桌面与手机均无横向溢出（scrollWidth − innerWidth：桌面 −15、手机 0）。注：手机上随机抽题那行“抽 5 道”会换行，是正常换行、无溢出。

### 已知不足（老实写）
- 未在 iPhone / Windows 真机上测（与 P1–P4 同款待办）；发音仍需 iPhone 复测是否真的出声（P3 遗留）。
- 25 分钟专注轮没有真实等过（P4 遗留）；iPhone 后台计时未实测（P4 遗留）。
- **同一 profile 从旧构建切到新构建时，旧 Service Worker 会继续提供缓存的旧版页面**：本次迁移验收第一轮，首页版本说明一直停留在 P4（数据核对却通过了——因为读的是旧构建 + 旧数据，Dexie 升级根本没跑）；用 CDP 清掉该 origin 的 cache_storage + service_workers（不动 IndexedDB 与 localStorage）并带缓存破坏参数重新导航后，才切到 P5 构建、升级真正跑起来。线上部署后如遇手机上仍显示旧版本，先关掉 PWA 再重开（或刷新）即可。
- 写作/主观题本阶段只展示参考答案与解析，不记录答题、不计入正确率与错题范围，P6 再接。

## P6 听说读写（#11 / #12 / #13 / #14）——2026-11-08

分支：`feature/p6-skills-mock`（worktree `~/workspace/topik-master-2027-p6`，基于 main 35c83b4）。

首批题目来源仍是 P5 已定的**官方真题本地导入**，她还没发来卷子文件时本阶段继续用测试夹具验证。**不编造任何题目、不写任何真题或自编题进仓库、不打包任何音频进仓库**——题库出厂仍为空。测试夹具与截图都在 `~/workspace/p6-skills/`（不进仓库）。

### 改动文件
- `src/lib/db.ts`：升到 Dexie version 3（升级钩子归一化旧题目记录：缺 `audio` 的补空字符串）；`Question` 加 `audio?: string`（音频文件名引用，只记引用、不存音频文件本身；空/缺省 = 未导入音频）与 `timeLimit?: number`（限时分钟，1–600 正整数；缺省 = 未设限时）；`Attempt` 加 `subjective?: boolean`（写作等主观题标记，不自动判分、不计正确率、不进错题范围）与 `writingSeconds?: number`；新增 `updateQuestionAudio(id, fileName)` 与 `getLatestWritingAttempt(questionId)`；`getWrongQuestionIds` 跳过 subjective 答题；`importQuestionBank` 接受 `audio`（字符串，可空）与 `timeLimit`（1–600 正整数，否则拒绝入库并报错）。
- `src/lib/db.ts` 另修一处 P5 导入器去重键（与 TOPIK I 转录实测有关，见下）：去重键由 `paperId::stem` 改为 `paperId::order`（order 缺失默认 0 时退回按题干去重）。102 回 TOPIK I 听力转录实测：同组题题干相同，旧键初版只进了 13/30；改键后同组题按题号区分，重复导入仍按题号跳过。
- `src/pages/Practice.tsx`：新增并导出共用组件 `ListeningAudio`（听力音频块：文件选择 `accept="audio/*"`、`<audio controls>`、音频引用持久化、topik.go.kr 学习资料室链接）与 `WritingCard`（写作卡片：textarea、字数 = 去空白字符数、用时 = 本卡片打开后经过秒数、自查清单 5 项存 localStorage、保存后可看参考答案与解析）；阅读题 `timeLimit` 倒计时（时间戳算剩余，500ms tick，时间到只提示、不锁题）；写作答案写 attempts（subjective，不计正确率）；正确率统计排除 subjective 答题。
- 新建 `src/pages/MockExam.tsx`：模拟考试（#14），听力 → 阅读 → 写作按环节计时走完；各环节时长可调（localStorage 持久化），默认按 TOPIK II 公开结构（听力 60 / 阅读 70 / 写作 50 分钟），页面标注“按 TOPIK II 公开结构，实际以当年准考证为准”；结束页只出成绩摘要（已答 / 未答 / 用时），不自动判分、不出分数（自动计分在 P7 的 #15 接上）；词汇 / 语法 / 其他题型的题不计入本次模拟（页内明示数量）；客观题答案在环节结束时统一写 attempts，写作答案 subjective 写 attempts。
- `src/App.tsx`：只加首页“模拟考试”入口；版本说明改成 P6；其余入口保留。
- `speech.ts` / `srs.ts` / `streak.ts` / `review.ts` / `stats.ts` / `SelfTest.tsx` / `Vocab.tsx` / `Review.tsx` / `Stats.tsx` / `Plan.tsx` / `Focus.tsx` / `MetalPrototype` / `CloverDreamcore` / `data/` / `scripts/` / `vite.config` / PWA / `package.json` 未动；无新依赖；未写任何题目进仓库；未放任何音频文件进仓库。

### 口径（写死，防以后扯皮）
- 音频只记文件名引用，不存音频文件本身、不进仓库、不进 IndexedDB 的题目记录大二进制；每次练习需重新选择本机音频文件（浏览器安全限制决定了文件无法跨会话保留，页面上明说，不假装已保存）；官方音频请从 topik.go.kr 学习资料室下载。
- 写作答案存 attempts（`subjective: true`，`correct: false`），不自动判分、不计正确率、不进错题范围；字数 = 去空白字符数；用时 = 本卡片打开后经过的秒数（页面内计时），不是整场用时。
- 模拟考试只出摘要（已答 / 未答 / 用时），不自动判分、不出分数；环节到点自动进入下一环节（本环节已作答的题先记入答题记录）；退出模拟考试时本环节已作答的题也会先记入答题记录。
- 导入器去重键 = 同一场内题号（`paperId::order`）；题号缺失（默认 0）时退回按题干去重。重复导入同一文件仍全部跳过。

### 构建与测试（worktree 内实测）
- `npm run build`：通过。precache 20 个条目（795.57 KiB）；主 chunk 体积警告是 P1 已有的问题。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致。
- 构建时修过两个小错：Practice.tsx 曾一度误删初始 refresh 的 useEffect 与 resetCard，已补回；tsc 曾报 `current` / `isObjective` 重复声明，已删旧的一处。

### Dexie 迁移实测（同一浏览器 profile、同一端口 4177，先旧版后 P6 版，最终构建重验过一次）
先用 main 35c83b4 的构建（临时 worktree `/tmp/topik-master-2027-old`，detached HEAD，已留）打开同一 profile：加载种子（库内共 1172 条），复习页打 3 张分，导入 P5 夹具（新增试卷 2 场、新增题目 5 道），快照：词汇 1172、复习 3、题目 5、试卷 2、答题 0、Dexie 底层版本号 20（声明版本 2 ×10）。然后停掉旧版服务、起 P6 构建（同一端口、同一 profile），先清掉该 origin 的 cache_storage + service_workers（不动 IndexedDB 与 localStorage，P5 的教训），确认首页版本说明翻到 P6 后逐项核对：Dexie 底层版本号 30（声明版本 3）、词汇 1172、复习 3、题目 5、试卷 2、答题 0——**旧数据一条不少**；5 道旧题目记录迁移后都有 `audio` 字段且值为空字符串；再导入 P6 夹具：新增试卷 1 场、新增题目 5 道、拒绝 1 条（timeLimit 为 0 的题），带 `audio: "test-tone.mp3"` 的听力题与 `timeLimit: 1` 的阅读题正确入库。迁移在最终构建（含去重键修与写作卡片修）上重验一次，8/8 通过。

### 真机浏览器实测（npm run preview，端口 4178，全新 Chrome profile）
测试夹具在 `~/workspace/p6-skills/fixture-p6.json`（不进仓库）：试卷“P6 测试卷”（来源“P6 测试夹具”，状态待核实），题目 5 道（1 道带 `audio: "test-tone.mp3"` 的听力题、1 道无 audio 的听力题、1 道 `timeLimit: 1` 的阅读题、1 道无 timeLimit 的阅读题、1 道写作题），另有 1 道 `timeLimit: 0` 的无效项。测试音频 `~/workspace/p6-skills/test-tone.mp3`（ffmpeg 生成的 3 秒 440Hz 正弦提示音，12KB，明确标注测试音频、不是真题音频；不进仓库）。验收驱动 `/tmp/cdp-p6-acc.mjs`，26/26 通过：

| 验收项 | 实测结果 |
|---|---|
| 导入 P6 夹具 | 新增试卷 1 场、新增题目 5 道、拒绝 1 条（timeLimit 为 0） |
| 听力题显示音频引用 | Q1 显示“音频引用：test-tone.mp3” |
| 听力音频真实加载并播放 | 选文件后 `<audio>` 出现；`audio.play()` 后 readyState 4、paused false、currentTime 0.97 秒前进中、playing 事件触发、duration 正好 3 秒（测试提示音）；状态文案“正在播放” |
| 听力题答题后显示解析 | 选 A（提示音 440Hz）提交后显示“答对了”+ 解析“测试夹具：音频为 3 秒 440Hz 正弦提示音。” |
| 无音频的听力题 | Q2 明确显示“未导入音频”，不静默失败；答题后仍可正常提交 |
| 阅读题倒计时 | Q3（timeLimit 1）显示“剩余 01:00”并逐秒递减，60 秒到点显示“时间到！请提交答案（练习模式不锁题）”；提交后仍可答题（不锁题） |
| 无 timeLimit 的阅读题 | Q4 显示“本题未设限时” |
| 写作题字数与用时 | 输入“안녕하세요 저는 학생입니다”后显示“字数：12（不计空格） · 本次用时：00:02” |
| 写作自查清单 | 5 项可逐项打勾（checked=5），存 localStorage（key `topik-master-writing-checklist-<questionId>`） |
| 写作保存 | 点“保存答案”后显示“已保存：答案与用时已记录，刷新后还在。”；attempts 里多一条 subjective=true、writingSeconds=2、全文正确的记录 |
| 正确率统计排除主观题 | 客观 4 题全对 + 写作 1 题后，练习页显示“已答 4 次 · 正确率 100%（答对 4 / 4）”——写作不计 |
| 写作答案刷新后还在 | 退出练习、重进同一场、重新答完 Q1–Q4 到 Q5，textarea 里仍是“안녕하세요 저는 학생입니다” |
| 模拟考试默认时长 | 听力 60 / 阅读 70 / 写作 50 分钟（页内写明按 TOPIK II 公开结构，实际以当年准考证为准） |
| 模拟考试时长可调 | 改成各 1 分钟后 localStorage `topik-master-mock-durations` 为 `{listening:1, reading:1, writing:1}` |
| 模拟考试听力环节到点自动推进 | 听力环节 1 分钟到点自动进入阅读环节，提示“时间到，已自动进入下一环节。” |
| 模拟考试结束页成绩摘要 | 听力已答 2 未答 0、用时 0 分 59 秒；阅读已答 2 未答 0、用时 0 分钟（立即交卷）；写作已答 1 未答 0、用时 0 分 2 秒；合计已答 5 未答 0、用时 1 分 1 秒；页内无“得分 / 分数 / 正确率”字样，不自动判分 |
| 模拟考试时长恢复默认 | 改回后 localStorage 为 `{listening:60, reading:70, writing:50}` |

验收中发现并修掉一个真 bug（#13）：重进写作题时 textarea 是空的——`WritingCard` 的初始文案同步 effect 只依赖 `question.id`，而最新一次保存的答案是异步读到的，读到时 effect 不再跑，输入框 stays 空（答案其实已在 attempts 里）。已修：`initialText` 变化时再同步一次，但用户已在本卡片打过字就不覆盖（`touchedRef`）。修后重测，刷新/重进后答案正常回填（见上表）。

截图（`~/workspace/p6-skills/`，不进仓库，逐张看过）：`listening-playback.png`（桌面，听力播放页：播放器 0:01/0:03 播放中、“正在播放”、音频引用与选项都在）、`mock-exam-desktop-1280.png`（桌面，模拟考试写作环节：环节 3/3、剩余 00:59、写作卡片与自查清单）、`mock-exam-mobile-390.png`（手机 390×844，模拟考试听力环节：环节 1/3、剩余 60:00、音频引用块，无横向溢出）。

### 已知不足（老实写）
- **本机 headless Chrome 只能验证 audio 元素真实加载并触发播放事件、currentTime 前进，没听到声音**（与 P3 发音同款限制）：是否真的出声，需她在 iPhone 上复测（或有声环境下复测）。
- 60 / 70 分钟的环节时长没有真实等过（验收把各环节调到 1 分钟实测自动推进与摘要，默认值只核对了数字正确）；25 分钟专注轮、iPhone 后台计时未实测（P4 遗留）；未在 iPhone / Windows 真机上测（与 P1–P5 同款待办）。
- 验收第一轮阅读计时到点曾一次没出现（90 秒内没等到“时间到”），单独探针重测时倒计时 01:00 → 00:00 正常走完、60 秒整出现“时间到”；判定为当时并行转录任务占满机器导致的偶发卡顿，不是应用 bug（倒计时按时间戳算剩余，计时器晚 tick 也会一次跳到正确剩余值）。
- 模拟考试里词汇 / 语法 / 其他题型的题不计入环节（页内明示数量）；真实 TOPIK II 卷只有听力/阅读/写作三种题型，不受影响。
- 驱动教训（给以后验收留的）：CDP `DOM.setFileInputFiles` 在本页上不稳定（全新 profile 时 files.length 一直为 0、复用 profile 时又能成；且 `handleAudioFile` 处理完会主动清空 input value，所以 files.length 本来就不能当成功信号）；改用页内 DataTransfer（真实文件字节 base64 → File → input.files + change 事件）才稳定。另：`Runtime.evaluate` 用 `returnByValue: true` 时别返回 DOM 节点（会报 `Object reference chain is too long`，waitFor 会吞掉它一直超时）；`Page.navigate` 直跳 127.0.0.1 会被本地网络访问检查拦成 `chrome-error://chromewebdata/`（清掉 SW 缓存后尤其），可靠路线是 file:// 跳转页 `location.replace`（缓存破坏参数直接写进跳转目标）。

## P7 考试闭环与收尾（#15 / #16 / #23 / #24）——2026-11-09

分支：`feature/p7-exam-loop`（worktree `~/workspace/topik-master-2027-p7`，基于 main 6d0f8c2）。

**24 项固定功能至此全部落地**（P1–P7）。**不编造任何题目、不写任何真题或自编题进仓库、不打包任何音频进仓库**——题库出厂仍为空。测试夹具与截图都在 `~/workspace/p7-exam/`（不进仓库）。

### 改动文件
- 新建 `src/lib/scoring.ts`：自动计分纯函数（不碰 IndexedDB、不碰 React）：`scoreItems` / `accuracyPct`。口径见下。
- 新建 `src/pages/AnswerCard.tsx`：共用答题卡组件（Practice 与 MockExam 共用；考后回顾也在 MockExam 里复用）。每题一格，点格子跳题；状态色用内联样式（index.css 不在 P7 可改清单里）：未答白底、答对绿底、答错红底、已答蓝底（模拟考试进行中专用，不泄露对错）、主观题已写紫底、主观题未写白底紫虚线框；当前题粗边框；图例用文字写明，不只靠颜色。
- `src/lib/db.ts`：不改表结构、不升 Dexie 版本（仍为 version 3）。新增 `getAllAttempts` / `countAttempts` / `getLatestAttemptByQuestion`；新增备份与恢复 `exportBackupJSON` / `parseBackupJSON` / `importBackupJSON` / `BACKUP_FORMAT_VERSION`（= 1）/ `BACKUP_APP`。恢复用 Dexie 数组形式事务（6 张表一次事务内清空并写入，失败整批回滚）。
- `src/pages/Practice.tsx`：本次练习的答题卡（每格状态 + 点格子跳题，跳回已答过的题恢复该题作答状态与解析）+ 实时成绩条 + “交卷看成绩”成绩页（客观题总数/已答/答对/答错/未答/正确率/按题型分项 + 写作已写数与“待自评”）+ “再练一次”（清空本次作答记录）。答题卡与成绩只反映“本次练习”，不读历史答题记录（历史正确率在练习首页另有统计）。
- `src/pages/MockExam.tsx`：考试进行中加答题卡（只显示已答/未答与主观题已写/未写，不泄露对错——P6 口径“考试模式不显示对错”）；结束页接上 #15 自动计分（客观题总数/已答/答对/答错/未答/正确率/按题型分项 + 写作“待自评”）+ 考后答题回顾卡（分环节，答对/答错才在此显示）+ 原用时摘要保留。
- 新建 `src/pages/WrongQuestions.tsx`：错题复练（#16）。错题 = 最新一次答错的客观题（`getWrongQuestionIds`，P5/P6 口径；写作等主观题不进错题本，词汇错词在复习页错词本）。按题型筛选；逐题重答，答对当场显示“已移出错题本”（最新答题记录变答对，自动移出范围），答错仍在；本轮结束显示移出数与剩余数，可“再练剩余错题”。
- 新建 `src/pages/Settings.tsx`：备份与恢复（#23）+ 离线使用与安装（#24）+ 清空全部数据（两步确认：先点“清空全部数据”武装，再点“确认清空全部数据”并过 window.confirm）。备份导出下载单个 JSON 文件；恢复先解析校验（不过则明确报错、不写库）、再展示预览表（备份各有多少条 vs 本地现在各有多少条）、再二次确认才覆盖。
- `src/App.tsx`：只加首页“错题复练”与“设置（备份 / 离线与安装）”入口；版本说明改成 P7（24 项全部落地）。
- `speech.ts` / `srs.ts` / `streak.ts` / `review.ts` / `stats.ts` / `SelfTest.tsx` / `Vocab.tsx` / `Review.tsx` / `Stats.tsx` / `Plan.tsx` / `Focus.tsx` / `MockExam.tsx` 以外的页面 / `MetalPrototype` / `CloverDreamcore` / `TASKS.md` / `data/` / `scripts/` / `public/` / `vite.config` / `package.json` 未动；无新依赖；未写任何题目进仓库；未放任何音频文件进仓库。**正式图标未换**：分期计划 P7 原要求替换 `public/icon-192.png` / `icon-512.png`，但本次任务明确禁改 `public/`，T0 占位图标仍在，安装功能本身不受影响（见已知不足）。

### 口径（写死，防以后扯皮）
- 计分只判客观题（options 非空、answerIndex 不为 null）：选对 = 答对，选错 = 答错，没选 = 未答；正确率 = 答对 ÷ 已答客观题（未答不计入分母），四舍五入到整数百分比；已答为 0 时正确率显示“—”；按题型分项同理。主观题（写作）不自动判分、不计正确率，只记“已写 / 未写”，成绩页标“待自评”。
- 模拟考试进行中答题卡只显示已答/未答（蓝色“已答”格），不显示对错；对错只在考后回顾卡与成绩页出现。练习页的答题卡在提交后立即显示对错（练习模式即时反馈）。
- 错题复练：答对后该题最新答题记录为“答对”，自动移出错题范围；答错仍在；复练的答题记录同样进 attempts；一轮只练一遍，本轮答对的题当场移出本轮队列。
- 备份格式：`{ app: 'topik-master-2027', formatVersion: 1, dexieVersion: 3, exportedAt, vocab, reviews, daily_stats, questions, papers, attempts }`。恢复只认本应用（app 字段）与 formatVersion 1；版本不符、结构不对、关键字段缺失、日期无效，整份拒绝并报错，不写半份数据。恢复 = 一次性覆盖本地全部数据（先校验、再看预览、再二次确认）。JSON 里的日期字符串恢复时转回 Date。
- 离线：应用外壳（Service Worker 缓存）+ 已导入的数据断网可练；听力音频文件本身不进缓存，断网后需本机仍有该音频文件、练习时重新选择才能播。安装只写浏览器自带路径，不编造能力：iOS Safari 没有安装弹窗，只能手动“添加到主屏幕”；桌面 Chrome/Edge 有安装图标时可装，没有时收藏网址同样能用。

### 构建与测试（worktree 内实测）
- `npm run build`：通过。precache 20 个条目（821.97 KiB）；主 chunk 体积警告是 P1 已有的问题。
- `npm run test:fsrs`：通过，FSRS-7 间隔与 T0 一致。
- 计分函数单测（tsc 转译后 node 直跑，手工算例）：客观 4 道（答 3 对 2 错 1 未答 1）+ 主观 1 道已写 → 总数 4 / 已答 3 / 答对 2 / 答错 1 / 未答 1 / 正确率 67%，按题型阅读 1/2/2 正确率 50%、听力 0/0/1 正确率 null、语法 1/1/1 正确率 100%，空输入总数 0 正确率 null——全部通过。
- 构建时修过两个小错：Practice.tsx 里 `current.id` 在 setState 回调闭包里丢了收窄（TS2345），改成先取局部变量 `qid` 再用。

### 真机浏览器实测（npm run preview，端口 4179，全新 Chrome profile）
测试夹具在 `~/workspace/p7-exam/fixture-p7.json`（不进仓库）：试卷“P7 测试卷”（来源“P7 测试夹具”，状态待核实），题目 5 道（Q1 阅读答对、Q2 阅读故意答错、Q3 听力故意不答、Q4 写作、Q5 语法答对）。验收驱动 `/tmp/cdp-p7-acc.mjs`，58/58 通过。计分数字全部手工核对过：

| 验收项 | 实测结果 |
|---|---|
| 首页版本说明为 P7 | 首页写明“当前版本：P7 考试闭环与收尾” |
| 导入 P7 夹具 | 新增试卷 1 场、新增题目 5 道（重复跳过 0 道） |
| 练习 Q1 答对 | 提交后显示“答对了”；答题卡第 1 格变绿 rgb(26,127,55)；实时成绩“客观题已答 1/4 道 · 答对 1 道 · 正确率 100%” |
| 练习 Q2 答错 | 提交后显示“答错了”；答题卡第 2 格变红 rgb(207,34,46) |
| 答题卡点格子跳题 | 点第 3 格跳到第 3 道；第 3 格仍白色（未答） |
| 练习 Q4 写作保存 | 显示“已保存”；答题卡第 4 格变紫 rgb(130,80,223)（主观题已写） |
| 练习 Q5 答对 | 答题卡第 5 格变绿 |
| 练习交卷成绩（手工核对） | 客观题总数 4 / 已答 3 / 答对 2 / 答错 1 / 未答 1 / 正确率 67%（2/3）；写作已写 1/1 · 待自评；按题型：阅读 1/2/2 正确率 50%、听力 0/0/1 正确率 —、语法 1/1/1 正确率 100% |
| 再练一次 | 答题卡第 1 格回到白色，实时成绩清零（已答 0/4） |
| 错题本只有 Q2 | 错题共 1 道（Q3 未答不进，Q1/Q5 答对不进） |
| 错题复练答对移出 | 选 B 提交后显示“答对了，已移出错题本”；本轮结果“答对 1 道（已移出），错题本现在共 0 道”；返回显示“错题本是空的” |
| 模拟考试时长可调 | 各环节改成 1 分钟（localStorage 持久化，P6 已有能力） |
| 考试中答题卡不泄露对错 | 听力 Q3 未答格白色；阅读 Q1 选后格变蓝 rgb(9,105,218)（已答）；进行中页面无“答对了/答错了”字样 |
| 模拟考试成绩（手工核对） | 客观题总数 3 / 已答 2 / 答对 1 / 答错 1 / 未答 1 / 正确率 50%（1/2）；写作已写 1/1 · 待自评；按题型：听力 0/0/1 正确率 —、阅读 1/2/2 正确率 50%；用时摘要仍在 |
| 考后回顾卡片 | 阅读卡 Q1 绿、Q2 红；听力卡 Q1 白（未答）；写作卡 Q1 紫（已写） |
| 加载种子 | 库内 1172 条（与 P1 实数一致） |
| 复习打 1 张“认识” | 成功（复习记录 + 当日统计各 +1） |
| 设置页本地数据计数 | 词汇 1172 条 · 复习记录 1 条 · 统计 1 天 · 题目 5 道 · 试卷 1 场 · 答题记录 8 条（练习 4 + 错题复练 1 + 模拟考试 3；写作 2 条 subjective 不计入练习页“已答”口径，但 attempts 总数含它们） |
| 安装指引 | 显示 iPhone“添加到主屏幕”步骤；写明“iOS Safari 没有‘安装应用’弹窗”，不编造能力 |
| 导出备份 | 文件已下载（`topik-master-2027-backup-20261108-1642.json`）；内容为合法 JSON，含 app/formatVersion 1/dexieVersion 3 与六类数组，计数与设置页一致（1172/1/1/5/1/8） |
| 坏备份被拒（formatVersion 99） | 明确报错“版本不受支持”，本地数据未动（仍为 1172 条） |
| 非 JSON 文件被拒 | 明确报错“不是有效的 JSON 文件” |
| 清空全部数据（二次确认） | 点“清空全部数据”武装、再点“确认清空全部数据”并过确认框后，六类计数全为 0 |
| 恢复备份 | 恢复前预览表显示备份计数（词汇 1172 等）与本地现在计数；确认恢复后显示“恢复完成”，六类计数与备份前一致（1172/1/1/5/1/8） |
| 断网后刷新 | 应用仍从 Service Worker 缓存打开（P7 首页）；练习页“P7 测试卷”在列、题目 5 道，断网可练 |
| 截图（逐张看过） | `p7-answer-card.png`（答题卡：1 号格绿底粗边框、4 号格紫虚线框、图例与实时成绩条）、`p7-score-practice.png`（练习成绩页：4/3/2/1/1、67%、写作 1/1 待自评）、`p7-score-mock.png`（模拟考试成绩页：3/2/1/1/1、50%）、`p7-backup-settings.png`（设置页：计数 1172/1/1/5/1/8、导出成功文案、Service Worker 已接管）、`p7-offline.png`（断网后练习页：P7 测试卷在列、5 道） |

验收中修过两个驱动问题（都不是应用 bug）：① 夹具导入的页内 fetch 被 CORS 拦——静态服务换成带 `Access-Control-Allow-Origin: *` 的小服务才通；② 复习页初始空队列也会显示“到期复习”，等待条件误判——改成等打分按钮真正出现再点；③ 设置页计数是异步读的，等待条件只等了标题——改成等计数行出现。

### 已知不足（老实写）
- **未在 iPhone / Windows 真机上测**（与 P1–P6 同款待办）：PWA 添加到主屏幕后的图标与启动页、断网后真机打开、备份文件在手机上的导出/导入流程，都需她在 iPhone 上复测；本机只验证了 headless Chrome 里的 Service Worker 缓存与离线重载。
- 正式图标未换：`public/icon-192.png` / `icon-512.png` 仍是 T0 占位图（本次任务禁改 `public/`）；添加到主屏幕后显示的是占位图标，不影响使用。
- 60 / 70 分钟的环节时长没有真实等过（验收把各环节调到 1 分钟实测自动推进与摘要，默认值只核对了数字正确；P6 遗留）；25 分钟专注轮、iPhone 后台计时未实测（P4 遗留）。
- 备份恢复是整库覆盖（没有“合并”模式）：恢复前页面已二次确认并展示预览表；误删后没有撤销，只能用之前导出的备份再恢复一次。
- 模拟考试里词汇 / 语法 / 其他题型的题不计入环节（P6 遗留，页内明示数量）；真实 TOPIK II 卷只有听力/阅读/写作三种题型，不受影响。
