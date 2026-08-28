# TASK-20260828-143000：验收种子设备管理 IP 唯一性修复

> 遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。

## 基本信息

- Status：READY_FOR_REVIEW
- Owner：Cursor Developer
- Reviewer：Codex Reviewer
- Branch：`fix/TASK-20260828-143000-seed-ip-uniqueness`
- Requirement Source：用户 2026-08-28 指示执行机柜数量种子脚本；首次执行因 `Servers.ManagementIP` 唯一约束失败并回滚，需最小修复后完成同一目标。
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md`
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`

## 根因与用户结果

`fill_synthetic_devices()` 把全机房递增序号 `n` 截断为 `min(n, 254)` 作为 IP 第四段。设备数超过 254 后，同一机柜内的多个新设备都会使用 `.254`，因 `Servers.ManagementIP` 唯一约束导致种子事务失败并回滚。

修复后，合成设备 IP 由机房序号、机柜序号和该机柜内的设备序号组成；上海 100、北京 150、广州 80 个机柜按每柜 19 台设备计算的 6,270 个合成 IP 均不重复。本任务不运行种子脚本或修改数据库。

## Task 1: Cursor Developer 实施范围

1. 先修改既有 `scripts/test_seed_acceptance_data.py`，新增失败测试：调用新纯函数 `synthetic_management_ip(room_index, rack_n, device_ordinal)`，为 `(1,100)`、`(2,150)`、`(3,80)` 的每个机柜和每柜设备序号 `1..19` 生成 IP；断言总数与去重数均为 `6270`，并断言最后一个 IP 为 `10.3.80.19`。旧脚本必须因函数不存在失败。
2. 仅修改 `scripts/seed-acceptance-data.py`：新增上述纯函数，返回 `f"10.{room_index}.{rack_n}.{device_ordinal}"`；在 `fill_synthetic_devices()` 的两个创建循环中，以当前 `counts[rack_id] + 1` 作为 `device_ordinal` 调用该函数，替代 `min(n, 254)` 的 IP 拼接。
3. 保留设备名称规则、机柜数量、设备类型、U 位/布置、端口、线缆、事务、删除和现有服务器的处理逻辑。`ensure_server()` 不得在已有名称时更新其既有管理 IP。

## 明确不做

- 不执行 `scripts/seed-acceptance-data.py`，不直接修改 SQLite 数据库或数据文件。
- 不修改前端、后端 API、数据模型、迁移、认证、机房/机柜数量、设备目标数量或第三方依赖。
- 不改变已存在设备的名称或管理 IP。

## 验收标准

| ID | 要求 | 验收 |
|---|---|---|
| FR-01 | 大规模合成 IP 唯一。 | 3 个机房、100/150/80 个机柜、每柜 19 台的 6,270 个 `synthetic_management_ip()` 返回值去重后仍为 6,270。 |
| FR-02 | IP 地址可预测。 | `synthetic_management_ip(3, 80, 19)` 为 `10.3.80.19`。 |
| FR-03 | 生成逻辑使用柜内序号。 | 两个合成设备创建循环均使用 `counts[rack_id] + 1` 生成 IP，不再使用 `min(n, 254)`。 |
| FR-04 | 不破坏已有设备。 | `ensure_server()` 的既有名称返回路径不更新 `ManagementIP`。 |
| NFR-01 | 最小范围与零数据库写入。 | 仅修改脚本和已有无数据库测试；测试不调用 `main()`，实施阶段不得运行种子脚本。 |

## 验证命令

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v
git diff --check
```

## 状态迁移记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-28 14:30 +08:00 | Codex + Terra | IDLE | DRAFT | 已完整读取异常堆栈，首次执行可复现；事务回滚后数据库仍为 30 个机柜。`n` 递增与 `min(n,254)` 共同造成重复 IP。 |
| 2026-08-28 14:30 +08:00 | Codex + Terra | DRAFT | READY | 用户的执行目标需要此最小修复；Owner/Reviewer 独立；两个目标路径无活跃父子路径锁冲突。 |
| 2026-08-28 14:35 +08:00 | Cursor Developer | READY | IN_PROGRESS | 两个精确脚本路径无父子路径冲突，已登记为 CLAIMED；未执行种子脚本。 |
| 2026-08-28 14:45 +08:00 | Cursor Developer | IN_PROGRESS | READY_FOR_REVIEW | unittest、py_compile、git diff --check 通过；两条锁 CLAIMED → HANDED_OFF；未执行种子脚本。 |

## Cursor Developer 接手条件

开始前读取本任务、`AGENTS.md`、`docs/architecture/AGENT-WORKFLOW.md`、`tasks/current-task.md` 与计划文件；确认无父子路径锁冲突后认领两条允许路径并进入 `IN_PROGRESS`。若修复需要执行种子脚本、改数据库、改 API/模型、变更已有设备 IP 或增加依赖，停止并交回统筹 Agent。
