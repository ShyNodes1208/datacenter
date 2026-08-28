# TASK-20260828-134500：验收种子机柜数量调整

> 遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。

## 基本信息

- Status：COMPLETED
- Owner：Cursor Developer
- Reviewer：Codex Reviewer
- Branch：`feature/TASK-20260828-134500-rack-seed-counts`
- Requirement Source：用户 2026-08-28 确认：先调整三个机房的机柜数量；北京 150、上海 100、广州 80。
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md`
- Architecture Reference：`docs/architecture/MVP-ARCHITECTURE-BASELINE.md`、`docs/architecture/AGENT-WORKFLOW.md`

## 用户结果

下一次人工执行验收种子脚本时，脚本会准备上海 100 个、北京 150 个、广州 80 个机柜，共 330 个；本任务本身绝不执行该脚本，也不触及现有数据库。

## Task 1: Cursor Developer 实施范围

1. 先新增 `scripts/test_seed_acceptance_data.py` 的无数据库单元测试。它通过 importlib 加载 `scripts/seed-acceptance-data.py`，断言 `KEPT_ROOMS` 为上海 100、北京 150、广州 80，并断言总数为 330；先运行并确认旧脚本失败。
2. 仅修改 `scripts/seed-acceptance-data.py`：将机柜数量纳入每个机房的 `KEPT_ROOMS` 配置；删除通用 `RACKS_PER_ROOM`；`seed_kept_rooms_and_racks()` 按当前机房配置数量循环创建机柜；`print_summary()` 按同一配置校验三个机房依次为 `[100, 150, 80]`，总数为 330。
3. 保留现有机柜编号格式：上海 `R1-01` 至 `R1-100`、北京 `R2-01` 至 `R2-150`、广州 `R3-01` 至 `R3-80`；不得改动设备、线缆、事务或删除逻辑。

## 明确不做

- 不运行 `scripts/seed-acceptance-data.py`，不修改 SQLite 数据库或任何数据文件。
- 不修改前端、后端 API、数据模型、迁移、认证、设备数量、设备布置、线缆规则或第三方依赖。
- 不改变三个机房名称、上海固定 ID、机柜 U 高度和每柜 18–20 台设备的既有校验。

## 验收标准

| ID | 要求 | 验收 |
|---|---|---|
| FR-01 | 每个机房有独立的机柜数量。 | 配置明确表示上海 100、北京 150、广州 80；不再存在通用 `RACKS_PER_ROOM`。 |
| FR-02 | 创建循环按各机房数量执行。 | `seed_kept_rooms_and_racks()` 对每个机房使用其配置的数量；编号保持 `R1/R2/R3-01...`。 |
| FR-03 | 汇总校验匹配新数量。 | `print_summary()` 校验总机柜数为 330，机房顺序上海/北京/广州的机柜数为 `[100, 150, 80]`。 |
| FR-04 | 数据库不在本任务中变化。 | 仅运行单元测试与语法检查；实施报告明确未运行种子脚本。 |
| NFR-01 | 最小范围。 | 仅修改种子脚本和其新增无数据库测试；无依赖、API、数据库或迁移变更。 |

## 验证命令

```bash
python3 -m unittest scripts/test_seed_acceptance_data.py -v
python3 -m py_compile scripts/seed-acceptance-data.py scripts/test_seed_acceptance_data.py
git diff --check
```

## 状态迁移记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-28 13:45 +08:00 | Codex + Terra | IDLE | DRAFT | 已检查现有种子配置、创建循环与汇总校验；确认脚本执行会修改数据库，故排除执行。 |
| 2026-08-28 13:45 +08:00 | Codex + Terra | DRAFT | READY | 用户确认最小方案；Owner/Reviewer 独立；两个允许路径无活跃父子路径锁冲突。 |
| 2026-08-28 13:55 +08:00 | Cursor Developer | READY | IN_PROGRESS | 两个精确脚本路径无父子路径冲突，已登记为 CLAIMED；未执行种子脚本。 |
| 2026-08-28 14:05 +08:00 | Cursor Developer | IN_PROGRESS | READY_FOR_REVIEW | import-only unittest、py_compile、git diff --check 通过；两条锁 CLAIMED → HANDED_OFF；未执行种子脚本。 |
| 2026-08-28 14:10 +08:00 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | MAJOR：`MODULE-LOCKS.md` 同一路径重复存在 HANDED_OFF 与 CLAIMED。 |
| 2026-08-28 14:12 +08:00 | Cursor Developer | CHANGES_REQUESTED | IN_FIX | 已确认无代码范围变更；删除重复 CLAIMED 锁，保留原认领时间及唯一 HANDED_OFF 记录。 |
| 2026-08-28 14:15 +08:00 | Cursor Developer | IN_FIX | READY_FOR_RETEST | 治理记录修复完成；两条路径各保留唯一 HANDED_OFF 锁；按 PYTHONDONTWRITEBYTECODE 完成复验；未运行种子脚本。 |
| 2026-08-28 14:16 +08:00 | Codex Reviewer | READY_FOR_RETEST | COMPLETED | Final PASS；`python3 -m unittest scripts/test_seed_acceptance_data.py -v` 1/1 PASS、`python3 -m py_compile scripts/seed-acceptance-data.py scripts/test_seed_acceptance_data.py` PASS、`git diff --check` PASS；工作树干净；基线至 HEAD 为 3 个本地提交；未执行种子脚本，未改 API/数据库。两条锁已 RELEASED。 |

## Cursor Developer 接手条件

开始前读取本任务、`AGENTS.md`、`docs/architecture/AGENT-WORKFLOW.md`、`tasks/current-task.md` 和计划文件；确认无父子路径锁冲突后，认领两个允许路径并合法进入 `IN_PROGRESS`。若需要执行种子脚本、改数据库、改数据模型、改接口或新增依赖，停止并交回统筹 Agent。
