# T1 词汇种子 — 来源说明（SOURCES.md）

取数日期：2026-11-07。生成脚本：`scripts/build-vocab-seed.mjs`（`node scripts/build-vocab-seed.mjs`，
或离线用 `node scripts/build-vocab-seed.mjs --tsv <本地 TSV 路径>`）。

## 1. 批量来源：julienshim 合并词表（唯一批量来源）

- 仓库：https://github.com/julienshim/combined_korean_vocabulary_list（公开，默认分支 master）
- 原始文件：`results.tsv`（仓库根目录），下载地址
  https://raw.githubusercontent.com/julienshim/combined_korean_vocabulary_list/master/results.tsv
- 取数时仓库状态（2026-11-07 核实）：README 版本 2026.08.30，当前提交
  4af92f804c827a4cf0102ffb4edcdcff3c8c466e，29 星，72 提交
- 许可证：仓库代码为 MIT License。原始词表权利仍属国立国语院与 TOPIK 机构；
  `results.tsv` 是该仓库管道生成的派生数据，本项目只把它用作种子数据来源。
- 原始词表（该仓库 README 所列，原始文件不在本仓库）：
  - 国立国语院《한국어 학습용 어휘 목록》.xls（2003），来源 www.korean.go.kr
  - TOPIK《토픽 어휘 목록_공개 목록》.xlsx（2015），来源 www.topik.go.kr
- 文件校验（2026-11-07 实测）：7,497 行数据（另 1 行表头），UTF-8，制表符分隔，
  SHA-256：`bb5789e46d818842ed6cc15c7946805ad1aed9fd1d0912d884cc48a8556b9a3c`
- 列：`rank`（NIKL 排名，TOPIK 独有词为空）、`word`（韩文词）、`part_of_speech`（词性）、
  `hanja`（汉字）、`explanation`（韩文释义/例短语）、`nikl_level`（A/B/C）、`topik_level`（초급/중급）

### 分级依据（铁律：不标“官方 TOPIK X 级”）

TOPIK 不公布 1–6 级官方词表。本项目只用三类标注：

- `NIKL-A` / `NIKL-B` / `NIKL-C`：国立国语院 2003《韩语学习用词汇目录》三档
  （A 初级 / B 中级 / C 高级）
- `TOPIK-초급` / `TOPIK-중급`：TOPIK 2015 公开词汇目录的两档
- `课程-X级参考`：2018《国际通用韩语教育标准课程》词汇等级表，参考分级，非官方 TOPIK 等级

本种子只用第一类：`source = NIKL`，`source_level = NIKL-A`。

### 取数统计（2026-11-07 实测，与仓库 README 一致）

| 范围 | 行数 |
| --- | --- |
| TSV 总行数 | 7,497 |
| NIKL A 级 | 982 |
| NIKL B 级 | 2,111 |
| NIKL C 级 | 2,872 |
| 仅 TOPIK 有（无 NIKL 等级） | 1,532 |
| 仅 NIKL 有（无 TOPIK 等级） | 1,505 |
| 两表共有 | 4,460 |

NIKL A 级 982 行中：同时带 TOPIK-초급 854 行、TOPIK-중급 19 行、无 TOPIK 分级 109 行。
这些 TOPIK 分级是逐条的补充信息，种子条目本身不设第二分级字段，聚合数记在这里；
逐条对应关系可从 `results.tsv` 按 ko 查回（该文件由脚本每次重新下载，不提交进仓库）。

### 去重规则

- 同一 `ko` 只留一条。982 行 NIKL A 级中有 55 个词出现多次（共 112 行），
  均为同一词的不同词性（如 `가다01` 同时是 동사和 보조 용언），去重去掉 57 行，种子剩 925 条。
- 保留规则（按顺序）：优先保留 `topik_level` 非空的（分级信息更全）；
  其次保留 `explanation` 非空的；最后取 `rank` 最小（rank 越小越常用）；再平保留首次出现的。
- `ko` 保留来源原始词形，含同形异义词编号（如 `가다01`、`가구03`）：
  编号是来源表的消歧标记，不是词本身的一部分；后续人工核对中文释义时再去掉编号、拆分同形词。
  去重不合并不同编号的同形词（如 `가구03` 与 `가구04` 是两个不同词条）。
- 排序：按 NIKL `rank` 升序（越小越常用），无 rank 的排最后，再按 ko 排序。

### 中文释义“待补”说明

`results.tsv` 没有中文释义（`explanation` 列是韩文释义/例短语，不是中文）。
因此种子 925 条的 `zh`、`example_ko`、`example_zh` 一律留空，`status` 一律为“待核实”，
中文释义后续人工核对时逐条补，绝不编造。韩文释义未导入（`VocabEntry` 无对应字段），
需要时从 `results.tsv` 按 ko 查回。

## 2. 延世 1 册 1–10 课生词（待她实书核对，未进种子）

- 课名已核实（2026-10-24）：1 인사와 소개（问候与介绍）、2 물건（物品）、3 학교（学校）、
  4 친구（朋友）、5 고향（家乡）、6 학교생활（学校生活）、7 음식（食物）、8 하루 생활（一天的生活）、
  9 주말（周末）、10 과거 일（过去的事）。核实依据见
  `workspace/goals/topik-korean-exam-preparation/references/新延世韩国语-1册-核实目录.md`。
- 各课的具体生词没有任何可靠来源（该核实文件已明说以她手中中文版实书为准），
  本次不写任何课次生词。`data/yonsei-1-template.json` 是待核实模板：
  每课只含课名与状态“待核实”，词汇数组为空。
- 她提供方式（二选一）：把每课生词页拍照片发来，或按课抄词表（韩文、中文释义、词性）。
  收到后由 Muse 填入对应课的数组并改状态，绝不凭记忆编造。

## 3. 待核实池（未进种子，以后分批核对）

以下范围本次不进 `data/vocab-seed.json`，原始数据在 `results.tsv` 里，留待以后分批核对：

- NIKL B 级 2,111 行、NIKL C 级 2,872 行
- 仅 TOPIK 有的 1,532 行（无 NIKL 等级）
- 延世 1 册 1–10 课生词（等她实书核对，见上节）

## 4. 种子文件说明

- `data/vocab-seed.json`：925 条 NIKL A 级种子，`VocabEntry` 数组（不含 `id`，由 Dexie 写入时自增），
  按 rank 排序。SHA-256：`a6e82fb5547a99812bf9c2fa33d6df60142ed9dba2ad540035fe82746d645814`
- 每条字段：`ko`（原始词形）、`pos`（来源词性，未知留空——本批无空值）、`zh`（空，待补）、
  `source`（NIKL）、`source_level`（NIKL-A）、`yonsei_lesson`（空）、`status`（待核实）、
  `example_ko` / `example_zh`（空）、`favorite`（false）、`isTestData`（false）
- 校验（脚本内置，写前写后各验一次）：必填字段齐全、ko 非空、无重复、
  全文无“官方 TOPIK”字样。2026-11-07 实测通过。
