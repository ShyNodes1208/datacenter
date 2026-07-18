# TASK-0007 第四次定点规格复审报告

## 审核信息

- 审核范围：仅 BF-RT3-001、BF-RT3-002 及本轮修正造成的回归
- 待复审提交：`67ccaa56396a1e09c13a6c3139730ce356928e47`
- 上一轮复审提交：`53a5fbc8224aaf12e0f945cf841409d970246403`
- Reviewer：Codex Reviewer
- 日期：2026-07-18
- 最终结论：**NEEDS_CHANGES**
- Findings：BLOCKER 1 / MAJOR 0 / MINOR 0 / NOTE 0

## 定点复审结果

| Finding | 状态 | 结论 |
|---|---|---|
| BF-RT3-001 | **OPEN** | 当前 `DRAFT`、三项任务文档锁 `CLAIMED` 及计划由 Architect 执行 `DRAFT -> READY` 本身合法；但历史表仍有一条未标记无效、且与 Git 事实矛盾的 Reviewer 状态迁移记录。 |
| BF-RT3-002 | **CLOSED** | 唯一新增上限为 16、唯一修改上限为 5；两个 DTO 明确为独立文件，不再存在 15 文件替代算法。 |

## Finding

### BF-RT4-001 — BLOCKER — Reviewer 的无效历史迁移仍未标记

- 文件及位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md` 交接记录第 816–818 行；`docs/architecture/AGENT-WORKFLOW.md` 第 3.2 节
- 问题描述：第 816 行仍记载 Codex Reviewer 在提交 `f517ee3` 执行了 `DRAFT（HANDED_OFF） -> READY_FOR_RETEST（NEEDS_CHANGES）`，且没有像第 817 行一样标注为无效。独立 Git 证据表明 `f517ee3` 只新增 `SPEC-RETEST-2.md`，提交前后任务文件状态均为 `DRAFT`，Reviewer 没有修改任务状态。第 817 行标记的是后续 `95eea07` 的另一条 `DRAFT -> READY_FOR_RETEST`，不能修复第 816 行的错误归因。权威封闭迁移表同样不允许 `DRAFT -> READY_FOR_RETEST`。
- 风险：状态审计继续伪称 Reviewer 发起了未发生且不合法的迁移；规格批准后仍会保留相互矛盾的权威历史，BF-RT3-001 要求的“无效历史迁移明确标记、不得伪造”没有满足。
- 最小修复方向：保留历史但把第 816 行同样明确标为无效，并写明 `f517ee3` 只提交审核报告、任务有效状态保持 `DRAFT`；随后将第 817–818 行表述为对无效记录的审计标注及恢复最后合法状态，不得把 `READY_FOR_RETEST -> DRAFT` 宣称为封闭状态机中的常规合法迁移。当前有效 `DRAFT`、CLAIMED 任务文档锁及未来 Architect `DRAFT -> READY` 路径无需改动。

## BF-RT3-001 其余检查

- `DRAFT` 是合法状态，来源为 `IDLE` 或 `BLOCKED`；允许澄清、设计、补全文档，禁止业务代码和开发模块认领。
- `DRAFT` 的合法目标只有 `READY`、`BLOCKED`、`CANCELLED`；`DRAFT -> READY_FOR_RETEST` 与 `READY_FOR_RETEST -> READY` 均非法。
- TASK 与 current-task 当前均为 `DRAFT`，Owner、Reviewer、下一步一致。
- 三项 `CLAIMED` 记录只覆盖任务规格管理文件，Owner 为当前规格负责人；未认领开发模块。Reviewer 对被审文件只读，并新增独立 review 路径，不需要接管三项锁。
- `READY` 的有权发起者是 Architect。Reviewer PASS 后，Architect 可在 READY 进入条件满足时执行合法的 `DRAFT -> READY`；之后实施 Owner 才检查冲突、认领开发模块并进入 `IN_PROGRESS`。
- 当前没有预记 READY、没有实施锁、没有编码。

## BF-RT3-002 证据

- 新增清单序号 1–16 连续、唯一，路径不重复；每项均有用途和关联 AC。
- Migration、Designer、ModelSnapshot 分别计数；Roles、Tool Manifest、配置示例及三个测试文件分别计数。
- LoginRequest 与 UserInfoResponse 明确为两个独立文件。
- 修改清单唯一为 5 个：后端 csproj、Program.cs、appsettings.json、测试 csproj、根 `.gitignore`。
- `appsettings.Development.json` 未列入修改清单；任务管理文件单独分类，不计入实施预算。
- “预计实际新增约 16 个文件，以逐文件清单为准”受精确 16 项清单和 16 上限约束，不形成 15/16 二选一；超过上限必须走 Change Request。

## 回归检查

本轮 diff 只涉及状态/交接和文件预算文字。此前通过的精确版本、四角色、组合角色、error JSON、OnValidatePrincipal、Development Bootstrap、Antiforgery、SQLite/WAL 失败规则、测试隔离、业务实体/API 排除及依赖边界未回归。

## Git 与验证

- 分支：`feature/task-0007-backend-foundation`
- 审核开始 HEAD 与远端：均为 `67ccaa56396a1e09c13a6c3139730ce356928e47`
- 工作区：审核开始时干净
- 修正 diff：仅 `tasks/TASK-0007-BACKEND-FOUNDATION.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`
- 代码、测试、脚本、依赖、Tool Manifest、Migration、数据库、实施锁：无变化
- `git diff --check 53a5fbc..67ccaa5`：PASS，退出码 0
- `git diff --check`（报告创建前）：PASS，退出码 0
- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：PASS 20 / FAIL 0 / TOTAL 20，退出码 0

## 最终判定

- 是否允许进入规格批准流程：**否**
- 是否允许进入实现：**否**
- 原因：BF-RT3-001 尚未完整关闭；应只修正历史审计记录后再次定点复审。
