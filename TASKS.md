# TOPIK MASTER 2027 — 开发任务清单

来源：第一份进度报告（2026-11-07）§5。一次只做一项，做完验收再做下一项，不许一次开发整个系统。

## T0 — 项目初始化与技术架构验证（已完成，见 ACCEPTANCE.md / TEST-REPORT-T0.md）

- [x] 脚手架：Vite + React + TypeScript；锁定 dexie 4.4.7、ts-fsrs 6.0.0、vite-plugin-pwa 2.0.0
- [x] 最小可用 PWA：manifest（TOPIK MASTER 2027，简体中文）、vite-plugin-pwa 生成 Service Worker、首页 + 自测入口
- [x] 数据层 `src/lib/db.ts`：Dexie 库 `topik-master-2027`，表 vocab / reviews / daily_stats，写入 / 读取 / 导出 JSON；仅 3 条标注“测试数据，非教材词汇”的测试词
- [x] SRS 层 `src/lib/srs.ts`：ts-fsrs DefaultScheduler（FSRS-7 默认参数），四档 不认识 / 模糊 / 认识 / 很熟；Node 测试 `scripts/test-fsrs.mjs` 通过
- [x] 发音层 `src/lib/speech.ts`：speechSynthesis 封装，ko-KR，可调语速，`listKoreanVoices()` 无语音时返回空数组并给原因
- [x] 自测页 `src/pages/SelfTest.tsx`：自动跑 6 项并显示 PASS / FAIL / 未测，结果写 localStorage（`topik-master-t0-selftest`），含“测试发音”按钮
- [x] 文档：README.md、TASKS.md（本文件）、ACCEPTANCE.md、TEST-REPORT-T0.md
- [x] 验证：`npm install`、`npm run build`、`npm run preview` 能启动、`npm run test:fsrs` 通过
- [ ] 待用户真机验证：iPhone Safari 与 Windows 浏览器各打开一次自测页（见 TEST-REPORT-T0.md §5）
- [ ] 待手动建库推送：github.com 新建私有仓 `topik-master-2027` 后按 README 推送（接口创建已失败，不再试）

## T1 — 词汇种子管道（未开始，等 T0 验收确认后）

- 从 julienshim 合并管道的 `results.tsv` 生成种子 JSON
- 每条带来源与分级依据；中文释义缺失标“待补”
- 输出 `data/vocab-seed.json` 与 `data/SOURCES.md`
- 首批范围：延世 1 册 1–10 课生词 + NIKL A 级；其余进待核实池

## T2 — 词汇浏览与筛选（未开始）

- 按延世课次 / 来源分级 / 词性 / 收藏筛选；可搜韩文与中文
- 列表显示来源标签；无中文释义的词显示“待补”，不显示编造释义

## T3 — SRS 复习（未开始）

- 每日复习列表自动生成；反馈四档；复习后间隔按 FSRS 变化
- 刷新后进度不丢失；连续天数按“周日不算断签”计算

## T4 — 每日统计（未开始）

- 记录新学词数、复习词数、正确率、当日学习分钟数；可导出当日 JSON
- 周日显示休息页，不记为缺勤

## T5 — 发音与备份（未开始）

- 点词可发音（ko-KR），可调语速；无韩语语音时提示
- 设置页可导出全部数据、导入 JSON、清空（二次确认）

## T6 — PWA 离线（未开始）

- 断网后已打开过的词汇页与复习页可用
- 可添加到 iPhone 主屏幕；图标与启动页正常（替换 T0 占位图标）

## T7 — 测试与验收包（未开始）

- 每个任务有可复现的测试步骤
- `ACCEPTANCE.md` 列出全部验收项与实测结果（通过 / 未通过 / 未测），不写“应该没问题”
