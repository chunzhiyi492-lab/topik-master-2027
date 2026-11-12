# 交接版内置数据来源

- `vocab-seed.json` 取自韩国国立国语院 2003 年《한국어 학습용 어휘 목록》。从 A 档筛选并按词形去重，词性缩写转换为全称，补齐应用结构字段。925 个词形和词性均逐条与官方文本核对。保留来源、原始资料和许可链接。词表许可为韩国开放政府许可 KOGL 第 1 类。未附官方释义或例句。 [原始资料](https://www.korean.go.kr/front/etcData/etcDataView.do?etc_seq=70) · [KOGL 许可](https://www.kogl.or.kr/info/licenseTypeEn.do)
- `grammar-notes.json` 的八条中文说明和用法场景由项目参考韩国国立国语院《韩国语基础词典》编写，韩文例句和译文为项目原创。来源链接逐条记录。沿用学习记录 ID 以读取已有数据，分组为项目学习阶段。
- `reading-original.json` 与 `writing-original.json` 为项目原创练习，题号用于模拟练习形式。
- 商业教材语法与词汇种子、课名模板、真题附件和听力音频均未进入本包或构建。公开版教材进度使用编号，用户自行导入的学习资料仅在当前浏览器存储。
- 中文释义批量补入（2026-11-12）：`vocab-seed.json` 中缺中文释义的词条经国立国语院《한국어기초사전》API（krdict.korean.go.kr，trans_lang=11）逐条查询补入：取第一义中文译词为 `zh`、中文释义句为 `zh_dfn`，字段 `zh_source` 标 krdict，状态改“待核实”。同音异义词按词性匹配、查无者留空待补，未用机器翻译。中文释义来源：국립국어원 한국어기초사전（CC BY-SA 2.0 KR）。

