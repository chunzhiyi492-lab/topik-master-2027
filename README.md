# TOPIK MASTER 2027

个人韩语 TOPIK 备考系统。目标：2027 年 4 月参加 TOPIK II，保 4 冲 5。

当前版本：**T0 项目初始化与技术架构验证**。只有脚手架 + 自测页，词汇、复习、统计功能尚未开发（见 `TASKS.md`）。

## 技术路线（已确认，2026-11-07）

- 形态：PWA 静态站（Vite + React + TypeScript），无后端、无账号、无服务器成本。
- 存储：IndexedDB（Dexie 封装），学习数据只存在本机浏览器。
- 复习：ts-fsrs v6（FSRS-7 默认参数），不自研 SRS 算法。
- 发音：浏览器 `speechSynthesis`，`lang: ko-KR`，免费，无需 API Key。
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

## 本地运行

要求：Node.js ≥ 24（ts-fsrs v6 要求；本机实测 Node v24.22.1）。

```bash
npm install
npm run dev      # 开发模式：http://localhost:5173
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 本地预览生产构建：http://localhost:4173
npm run test:fsrs  # Node 端 ts-fsrs 调度测试
```

打开首页即自动跑 T0 自测（IndexedDB 读写、ts-fsrs 调度、speechSynthesis、ko-KR 语音、Service Worker、manifest），结果写 localStorage（key：`topik-master-t0-selftest`），并有“测试发音”按钮（读 안녕하세요）。

## 目录结构

```
topik-master-2027/
├── public/
│   ├── manifest.webmanifest   # PWA manifest（name TOPIK MASTER 2027，简体中文）
│   ├── icon-192.png / icon-512.png  # 占位图标（纯色 + T 字，正式图标后续替换）
│   └── favicon.svg
├── scripts/
│   └── test-fsrs.mjs          # Node 端 ts-fsrs 测试
├── src/
│   ├── lib/
│   │   ├── db.ts              # Dexie 数据层：vocab / reviews / daily_stats
│   │   ├── srs.ts             # ts-fsrs 封装：四档 不认识/模糊/认识/很熟
│   │   └── speech.ts          # speechSynthesis 封装：ko-KR，可调语速
│   ├── pages/
│   │   └── SelfTest.tsx       # T0 自测页
│   ├── App.tsx                # 首页：项目说明 + 自测页
│   └── main.tsx
├── README.md / TASKS.md / ACCEPTANCE.md / TEST-REPORT-T0.md
└── vite.config.ts             # Vite + vite-plugin-pwa（生成 Service Worker）
```

锁定版本（`package.json` / `package-lock.json`）：dexie 4.4.7、ts-fsrs 6.0.0、vite-plugin-pwa 2.0.0、vite 8.3.6、react 19.3.1。

## 建库与推送步骤（GitHub 私有仓库）

> 背景：2026-11-07 用 GitHub App 接口创建仓库失败（403 Resource not accessible by integration），因此改为本地先建好、再手动建库推送。**不要再试接口创建。**

1. 在 github.com 上手动新建私有仓库，名 `topik-master-2027`，归属 `chunzhiyi492-lab`，**不要勾选** “Add a README / .gitignore / license”（保持空仓库，避免冲突）。
2. 在本目录执行（把 `<你的 GitHub 用户名>` 换成实际值；首次推送按 GitHub 提示完成认证）：
   ```bash
   cd ~/workspace/topik-master-2027
   git config user.name "<你的名字>"
   git config user.email "<你的邮箱>"
   git remote add origin https://github.com/chunzhiyi492-lab/topik-master-2027.git
   git push -u origin main
   ```
   注意：本地初始提交的作者是占位身份 `topik-master-2027 <topik-master-2027@local>`，推送前按上一步改成本人身份；如需改写初始提交作者，可在推送前执行 `git commit --amend --reset-author`。
3. 推送后在 GitHub 仓库页核对：代码在、README 显示正常、没有密钥与个人学习数据。
4. 以后部署（GitHub Pages 静态托管）是后续任务，T0 不做。

## 已知限制（写实）

- 图标是占位图（纯色 + T 字），正式图标待设计替换。
- iPhone Safari 与 Windows 浏览器的真机验证尚未完成：本机（Linux VM）只能验证构建、预览服务与 Node 端 FSRS；IndexedDB、发音、Service Worker 的浏览器内表现必须在真机上打开自测页核对。详见 `TEST-REPORT-T0.md`。
- 浏览器韩语语音来自设备系统语音，数量与音质因设备而异；无韩语语音的设备上自测页会明确报 FAIL 并给出去下载语音的路径，不静默失败。
- 直接在本机用命令行启动 Chromium 验证页面被环境策略拦截（见 `TEST-REPORT-T0.md`），未绕过。
- 学习数据无云同步，换设备需用设置页的导出 / 导入 JSON（后续任务）。
- 不上传任何数据到第三方；仓库里不放密钥、不放个人学习数据、不放真题 PDF / MP3（真题只链官方下载页，见第一份进度报告）。
