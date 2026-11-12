# TOPIK MASTER 2027 · Muse 交接版

本交接包取自本地 `68f71c1` 的代码与六批 Angelic Reverie 视觉实现，并在独立打包目录做了公开内容隔离。解压后在含 `package.json` 的目录运行 `npm ci`、`npm run build`。Node.js 需 24 或以上。使用 `npm run dev` 开发，生产构建输出 `dist/`，本机可用 `npm run preview` 验证。

## 内容范围

- 保留 24 项学习模块的入口、功能代码、视觉和 IndexedDB 记录机制。部分模块依赖用户自行导入的数据。
- 保留韩国国立国语院开放词表的 925 个 A 档词形和词性，8 条原创语法说明与双语例句，以及原创阅读、写作。详见 [数据来源](data/SOURCES.md)。
- 内置延世教材语法、词汇及课名模板已隔离。语法分册筛选不可用，学习阶段筛选、搜索、收藏和练习仍可用于原创条目。未收录的旧语法链接有明确提示，相关本机记录继续保留。教材进度只使用编号，词汇仍可导入你有权使用的本地文件。
- 不附带真题原卷、用户答题卡、浏览器记录、Git 历史或 Pages 部署工作流。

## 测试

- `npm run lint`、`npm run test:fsrs`、`npm run test:reliability`。
- 安装 Playwright Chromium 后运行 `npm run test:e2e`。已有 Edge 时，可通过 `TOPIK_TEST_BROWSER=msedge` 选择它。
- 先构建，再运行 `npm run test:pwa`。本包包含当前生产版的四项 PWA 检查。个人完整版本另含两个需要历史提交的 PWA 升级用例，可在原 Git 工作区运行。当前包仍保留数据库迁移和旧备份恢复自动化测试。
- 使用独立测试网址、浏览器存储和隔离样例。真机 iPhone Safari 与主屏幕应用另行验收。

## GitHub 审查

此 ZIP 是经筛选的源代码快照。提交审查前，须再次确认目标分支及其可达历史无受限教材。不要把本包直接叠加到含受限数据的旧分支，再把旧历史作为公开发布分支的一部分。推送、合并或部署均需项目负责人另行授权。

