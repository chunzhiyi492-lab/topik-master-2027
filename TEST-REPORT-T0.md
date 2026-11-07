# TOPIK MASTER 2027 — T0 测试报告

测试日：2026-11-07
测试环境：Linux VM（Muse 运行环境），Node v24.22.1，npm 10.9.4
结论先说：**构建、预览服务、Node 端 FSRS 全部通过；浏览器内的 IndexedDB、发音、Service Worker 尚未验证，必须等 iPhone / Windows 真机打开自测页。**

## 1. 实测结果表

| # | 检查项 | 命令 / 方法 | 结果 | 输出摘要 |
|---|---|---|---|---|
| 1 | 脚手架 | `npm create vite@latest topik-master-2027 -- --template react-ts` | 通过 | create-vite 9.3.4，react-ts 模板，目录生成成功 |
| 2 | 依赖安装 | `npm install dexie ts-fsrs vite-plugin-pwa` | 通过 | added 353 packages in 58s；锁定 dexie 4.4.7、ts-fsrs 6.0.0、vite-plugin-pwa 2.0.0、vite 8.3.6、react 19.3.1。有一条非阻塞警告：glob@11.1.0 已废弃（来自某依赖的旧版本，不影响构建） |
| 3 | FSRS Node 测试 | `npm run test:fsrs`（`scripts/test-fsrs.mjs`） | 通过 | 见 §2；退出码 0 |
| 4 | 类型检查 + 构建 | `npm run build`（`tsc -b && vite build`） | 通过 | 退出码 0；50 个模块；PWA precache 20 个文件（399.54 KiB）；生成 `dist/sw.js`、`dist/workbox-9c191d2f.js`、`dist/manifest.webmanifest` |
| 5 | 预览服务 | `npm run preview -- --port 4173` + `curl` | 通过 | `http://localhost:4173/` 200；`/manifest.webmanifest` 200（name：TOPIK MASTER 2027）；`/sw.js` 200；首页 HTML 含 manifest 链接与 `registerSW.js` |
| 6 | IndexedDB 读写 | 自测页 `src/pages/SelfTest.tsx`（浏览器内跑） | **未测** | 本机无可用浏览器验证（见 §3）；代码已就绪，逻辑为写 3 条测试数据 → 读回核对 → 清理 |
| 7 | ko-KR 语音 | 自测页 + “测试发音”按钮（浏览器内跑） | **未测** | 同上；代码已就绪，无语音时报 FAIL 并给下载路径，不静默失败 |
| 8 | Service Worker 激活与离线 | 自测页 + 构建产物检查 | **未测（产物已生成）** | `dist/sw.js` 已生成只能证明“生成成功”，不能证明“浏览器内已激活、离线可用” |
| 9 | manifest 安装 | 自测页 + `curl` | 半通过 | `curl` 取 manifest 200 且内容正确；“添加到主屏幕”是否出现安装提示待真机验证 |
| 10 | GitHub 仓库 | GitHub App 接口创建 | **失败（已知，不再试）** | 403 Resource not accessible by integration；已改本地 `git init -b main`，目录 `~/workspace/topik-master-2027` 正常，待手动建库推送 |
| 11 | 本机 Chromium 直启 | `/opt/meta-chromium/chrome --headless=new --dump-dom http://localhost:4173/` | **未测（环境拦截）** | 退出码 13，错误：`Hatch WebGL domain policy is required for browser startup`；按 README 说明，需由 browser-daemon 提供的策略才能启动，未绕过 |

## 2. FSRS 测试详情（Node 端，全部通过）

基准时间：`2026-11-07T00:00:00.000Z`，新建卡片，ts-fsrs v6 默认 FSRS-7 参数。

| 反馈 | 下次 due | scheduledDays |
|---|---|---|
| 不认识 Again | 2026-11-07T00:01:00.000Z | 0.00069（约 1 分钟） |
| 模糊 Hard | 2026-11-07T14:20:20.645Z | 0.597（约 14 小时） |
| 认识 Good | 2026-11-11T18:39:55.164Z | 4.778（约 4.8 天） |
| 很熟 Easy | 2026-12-30T20:52:05.937Z | 53.870（约 54 天） |

断言结果：Good 的 due 晚于 Again 的 due（通过）；卡片 JSON 序列化往返后 dueAt 一致（通过）；preview 返回 4 档 `[1, 2, 3, 4]`（通过）。

## 3. 本机能验证什么、不能验证什么（诚实划分）

**本机已验证：**
- 依赖安装、类型检查、生产构建、PWA 产物生成（SW + manifest + 图标进 dist）
- 预览服务器能启动并正确返回首页、manifest、SW 文件
- ts-fsrs 在 Node 端的调度数学正确（间隔单调：Again < Hard < Good < Easy）

**本机不能验证（全部标“未测”，不写成已通过）：**
- 浏览器内 IndexedDB 是否可写、3 条测试数据读写是否成功——需真机自测页
- 当前设备有无韩语语音、发音是否出声——需真机自测页 + 点“测试发音”按钮
- Service Worker 是否在浏览器内激活、断网后首页能否打开——需真机自测页 + 断网复测
- iPhone Safari 与 Windows 浏览器的兼容性——本机是 Linux VM + 无可用 Chromium，**一台设备的结果不能代替另一台**

## 4. 构建中修过的 2 个真实问题

1. **测试脚本 bug（已修，通过）**：ts-fsrs v6 的 `preview()` 返回可迭代对象而非数组，`preview.length` 为 `undefined`，首次运行 `npm run test:fsrs` 报错退出 1。改为 `[...scheduler.preview(...)]` 转数组后再判断，通过。
2. **srs.ts 类型报错（已修，通过）**：ts-fsrs v6 内 FSRS-6 / FSRS-7 两套卡片类型同名不同构，`newCard` 返回值类型缺 `stabilityFast`（运行时实际有，实测值为 0），`review` / `preview` 入参类型与 `DefaultSchedulerCard` 对不上，`tsc` 首次报错退出 1。已在 `src/lib/srs.ts` 边界处做明确标注的类型适配（补 `stabilityFast`、入参以 `never` 中转，返回值转回 `SrsCard`），运行时字段一致，Node 实测与构建均通过。不是绕过算法，只是类型层适配。

## 5. 下一步：真机验证步骤（给用户 / 主 agent）

T0 不算真正完成，直到下面两台真机都跑过自测页。需要先有一个 iPhone / Windows 都能打开的地址：`localhost:4173` 只在本机 VM 有效，手机打不开。建议顺序：

1. **先建库推送**（按 README“建库与推送步骤”）：github.com 手动新建私有仓 `topik-master-2027` → 本地推送。
2. **部署一个可公开访问的静态地址**（后续小任务，T0 不做）：例如 GitHub Pages（仓库 Settings → Pages → 从 `main` 分支部署），或复用现有发布流程。拿到 `https://…` 地址后再做第 3 步。
3. **iPhone Safari**：打开该地址 → 等自测自动跑完 → 截图自测表 → 点“测试发音”确认是否出声 → 尝试“添加到主屏幕”看有无安装提示。
4. **Windows 浏览器**（Chrome 或 Edge）：同上跑一遍，截图自测表。
5. 把两张截图与 localStorage 的 `topik-master-t0-selftest` 结果发回核对；若某项 FAIL，按自测页详情里的原因处理（例如无韩语语音时按提示去系统设置里下载韩语语音包）。

在真机结果回来之前，T1 不开始。
