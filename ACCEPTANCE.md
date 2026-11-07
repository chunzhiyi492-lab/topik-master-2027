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

