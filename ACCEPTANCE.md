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
