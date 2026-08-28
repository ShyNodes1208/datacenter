# TASK-20260828-150000：验收种子合成设备 IP 地址段修复

> 遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。

## 基本信息

- Status：COMPLETED
- Owner：Cursor Developer
- Reviewer：Codex Reviewer
- Branch：`fix/TASK-20260828-150000-seed-ip-namespace`
- Requirement Source：用户 2026-08-28 要求执行 330 机柜验收种子。前一 IP 唯一性修复在真实库中仍冲突：`10.1.4.19` 已属于旧设备 `STG-SH-019`，而新设备 `FW-SH-068` 也生成该地址；事务已回滚。
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`

## 根因与用户结果

前一修复只保证新生成的地址彼此不同，却与旧合成设备保留的历史 `10.*` 地址段重叠。`ensure_server()` 必须保留已有名称设备的管理 IP，故不能迁移历史地址。

当前开发库经查询确认 `172.17.*`、`172.18.*`、`172.19.*` 均为空。修复后新增合成设备分别使用上海 `172.17.<rack>.<slot>`、北京 `172.18.<rack>.<slot>`、广州 `172.19.<rack>.<slot>`；330 机柜规模的 6,270 个新地址不重叠，且不会改动旧设备。

## Cursor Developer 实施范围

1. 先修改 `scripts/test_seed_acceptance_data.py` 的大规模 IP 测试：期望末值为 `172.19.80.19`，并断言三个机房首地址为 `172.17.1.1`、`172.18.1.1`、`172.19.1.1`。旧实现必须因仍返回 `10.*` 失败。
2. 仅修改 `scripts/seed-acceptance-data.py` 的 `synthetic_management_ip()`：返回 `f"172.{16 + room_index}.{rack_n}.{device_ordinal}"`。不得修改两个调用点、设备名称、`ensure_server()`、机柜数量或其他逻辑。

## 明确不做

- 不执行种子脚本，不修改 SQLite 数据库或历史设备 IP。
- 不修改前端、后端 API、数据模型、迁移、机柜/设备数量、端口、线缆或依赖。

## 验收标准

| ID | 要求 | 验收 |
|---|---|---|
| FR-01 | 新地址段隔离历史数据。 | 房间 1/2/3 的首地址分别为 `172.17.1.1`、`172.18.1.1`、`172.19.1.1`。 |
| FR-02 | 330 机柜规模无重复。 | 100/150/80 个机柜、每柜 19 台时生成的 6,270 个地址去重数仍为 6,270，末值为 `172.19.80.19`。 |
| FR-03 | 历史设备不受影响。 | 不改变 `ensure_server()`；已有名称记录仍直接返回且不更新管理 IP。 |
| NFR-01 | 最小范围。 | 仅修改脚本与既有无数据库测试；实施阶段不运行种子脚本。 |

## 验证命令

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v
git diff --check
```

## 状态迁移记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-28 15:00 +08:00 | Codex + Terra | IDLE | DRAFT | `/tmp` 副本追踪显示首个冲突：新 `FW-SH-068` 与历史 `STG-SH-019` 同为 `10.1.4.19`；真实库未写入。查询证实 172.17/18/19 均为 0 占用。 |
| 2026-08-28 15:00 +08:00 | Codex + Terra | DRAFT | READY | 已确认根因、单一修复假设和精确无数据库测试；Owner/Reviewer 独立且目标路径无活跃冲突。 |
| 2026-08-28 15:05 +08:00 | Cursor Developer | READY | IN_PROGRESS | 两个精确脚本路径无父子路径冲突，已登记为 CLAIMED；未执行种子脚本。 |
| 2026-08-28 15:15 +08:00 | Cursor Developer | IN_PROGRESS | READY_FOR_REVIEW | unittest、git diff --check 通过；两条锁 CLAIMED → HANDED_OFF；未执行种子脚本。 |
| 2026-08-28 15:16 +08:00 | Codex Reviewer | READY_FOR_REVIEW | COMPLETED | Final PASS；`HEAD`、上游与 merge-base 均为 `649e17be741cecfaef1ba93a95bc7e0b0a63510c`；无数据库 unittest 2/2 PASS、`git diff --check` PASS；未执行 seed，未改 API/数据库；两条锁已 RELEASED。 |

## Cursor Developer 接手条件

读取本任务、`AGENTS.md`、权威工作流、`tasks/current-task.md` 和计划；确认无锁冲突后认领脚本与测试路径。若需要执行种子脚本、变更数据库、迁移旧设备 IP 或改变任何 API/数据模型，停止并交回统筹 Agent。
