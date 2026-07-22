# TASK-0017：TASK-0008 合并治理与跨分支状态修复

> 必须遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。本任务只修复已发生事实与任务状态记录不一致；独立规格审核 PASS 且合法进入 READY 前不得实施。

## 基本信息

- Task ID：TASK-0017
- Task Name：TASK-0008 合并治理与跨分支状态修复
- Status：DRAFT
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：`chore/task-0017-governance-repair`
- Requirement Source：项目负责人 2026-07-22 对 G02 的书面批准；`reviews/tasks/TASK-0008-POST-MERGE-VALIDATION.md`
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`
- Module Lock：3 项精确规格锁 `CLAIMED` by Codex Architect；0 项实施锁
- Implementation Started：NO

## Reviewer 独立性

- Owner 与 Reviewer 不同：是；Codex Architect 与 Codex Reviewer 不同
- Reviewer 只读审核，不修改本规格
- 例外：N/A：无独立性例外

## 已核实事实

### TASK-0008

- TASK-0008 保持 `COMPLETED`，feature tip 为 `939dd005e17d5eb3f93cdf0a7ce4648f19429467`。
- TASK-0008 已由普通双父 merge commit `e3804299df48ecc9d8d4d5a51d4902504c550616` 合入 main；双父 merge 本身没有被当前全局工作流明确禁止。
- 合并前没有 TASK-0008 专用 authorization，也没有执行任务要求的独立 merge gate；缺口是该独立合并门禁未执行。
- `reviews/tasks/TASK-0008-POST-MERGE-VALIDATION.md` 已在 `8e1a0785fa168c381265a3f1cd43b1ae7ec296fb` 完成补偿性技术验证：前端 44/44、后端 28/28、Workflow 20/20，技术结论 PASS。
- 当前 main 可保留 TASK-0008；不重新实现、不回退。
- post-merge validation 不能追溯替代事前授权或门禁；不得倒签、补造 authorization 或 merge gate。

### TASK-0009

- 正式分支：`feature/task-0009-readonly-room-list`；G01 提交：`2690bdeb9e0ec15c20cb63b52b395cf28763ed0f`。
- TASK-0009 与其 current-task 均为 `BLOCKED`；规格审核 PASS，业务规格未修改。
- 三项规格锁均为 `RELEASED`；实施锁 0；Implementation Started：NO。
- 当前不得进入 READY、不得实施。
- 恢复前必须重新核验最新 main 基线、获得明确的同步方式裁决、确认三项规格路径无冲突并重新认领精确规格锁。

## 任务目标与严格范围

1. 如实登记 TASK-0008 已发生的未经任务门禁合并及 post-merge technical validation PASS。
2. 明确 TASK-0008 保持 COMPLETED，不重做、不回退、不倒签。
3. 在实施阶段修复 main 中 `tasks/current-task.md` 的过期 TASK-0008 指针和描述。
4. 登记 TASK-0009 已在其 feature 上进入 BLOCKED、规格锁已释放。
5. 只为 TASK-0009 后续独立恢复定义一次性的最小决策条件：最新 main 基线只读核验、同步方式明确批准、锁冲突检查与重新认领。
6. 经独立审核后关闭本次事实与状态不一致。

## 明确排除范围

- 不修改 `docs/architecture/AGENT-WORKFLOW.md`，不建立全局或未来任务 merge policy。
- 不修改 TASK-0008 已完成任务文件，不重做、不回退 TASK-0008。
- 不修改 TASK-0009 任务文件或业务规格，不同步、不恢复、不实施 TASK-0009。
- 不创建或倒签 merge authorization、merge gate，不创建 TASK-0018。
- 不修改产品或架构业务基线、`src/`、`tests/`、Migration、依赖或分支历史；不删除分支。

## TASK-0009 后续恢复的一次性决策条件

TASK-0017 完成后，TASK-0009 只能在其自身独立前置单元中继续。该单元必须先只读核验 feature 与最新 main 的基线关系，由有权角色明确批准同步方式，检查三项规格路径无冲突并由 Codex Architect 重新认领精确规格锁；本任务不选择或执行具体同步命令。

## 需求追踪矩阵

| 当前要求 | Requirement Source | 验收标准 |
|---|---|---|
| 如实登记 TASK-0008 合并、门禁缺口和技术验证 | G02 书面批准；TASK-0008 post-merge validation | AC-01、AC-02 |
| 修复 main 当前任务指针 | G02 书面批准；main 的过期 current-task | AC-03 |
| 登记 TASK-0009 G01 状态与锁证据 | G02 书面批准；提交 `2690bde` | AC-04 |
| 仅定义一次性恢复决策条件 | G02 书面批准 | AC-05 |
| 保持严格文件与非目标边界 | G02 书面批准；工作流防过度开发门禁 | AC-06 |

## 复杂度预算

- 新增依赖、接口、数据模型、产品字段、全局规则：0
- 产品代码、测试、Migration、TASK-0008/TASK-0009 业务规格修改：0
- 仅使用现有任务状态、精确文件锁和 Markdown 管理记录

## 验收标准

- [ ] AC-01：TASK-0017 准确记录 TASK-0008 实际合并历史、缺失事前门禁和补偿性技术验证 PASS。
- [ ] AC-02：TASK-0017 明确 TASK-0008 保持 COMPLETED，且不重做、不回退、不倒签。
- [ ] AC-03：main 的 current-task 在实施阶段合法从过期 TASK-0008 指针切换到 TASK-0017。
- [ ] AC-04：TASK-0017 准确记录 TASK-0009 的 BLOCKED 状态、G01 提交和三项规格锁释放证据。
- [ ] AC-05：TASK-0017 只定义 TASK-0009 后续同步的决策条件，不在本任务中执行同步、恢复或业务实施。
- [ ] AC-06：TASK-0017 不修改 AGENT-WORKFLOW、产品代码、测试、依赖、TASK-0008 已完成文件或 TASK-0009 业务规格。

## 精确文件预算

| 操作 | 路径 | 用途 |
|---|---|---|
| 新增 | `tasks/TASK-0017-TASK-0008-MERGE-GOVERNANCE-REPAIR.md` | TASK-0017 规格与后续状态证据 |
| 修改 | `tasks/current-task.md` | 当前指针与一次性事实状态修复 |
| 修改 | `tasks/MODULE-LOCKS.md` | TASK-0017 精确规格锁及后续锁状态 |

- 新增：1；修改：2；总计：3。
- Reviewer 后续可在独立审核单元新增一份规格审核报告；该报告不属于本轮修改范围。
- 预算外文件变化必须停止；实施锁数量为 0。

## 5～10 分钟执行单元

| 单元 | 唯一范围 |
|---|---|
| G17-01 | 创建 DRAFT；仅本任务文件、current-task 和 MODULE-LOCKS。本轮执行。 |
| G17-02 | 独立规格审核；Reviewer 只新增一份规格审核报告。 |
| G17-03 | 仅在有 Finding 时修复规格；只修改 TASK-0017。 |
| G17-04 | Reviewer PASS 后由 Codex Architect 执行 `DRAFT → READY` 并释放规格锁。 |
| G17-05 | 实施最小 main 状态修复；只修改本任务批准的三个管理文件。 |
| G17-06 | 独立实施审核并按权威工作流完成合法迁移。 |

不得在任何 G17 单元中执行 TASK-0009 分支同步或业务实施。

## 验证命令

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
git diff --name-status
git status --short --branch
git diff --cached --name-status
```

## 构建与测试

- 构建：N/A：本任务仅管理文档，不修改产品代码。
- 产品测试：N/A：本任务仅管理文档，不修改实现或测试。
- 工作流校验：待本轮执行并以命令输出为准。

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 说明 |
|---|---|---|---|---|---|
| 2026-07-22 10:40:10 +08:00 | Codex Architect | IDLE | DRAFT | Codex Reviewer | TASK-0008 保持 COMPLETED；当前指针经 IDLE 建立 TASK-0017 DRAFT；登记三项规格锁，仅等待独立规格审核 |

## 审核与完成字段

- 审核结论：N/A：等待独立 Codex Reviewer 规格审核
- 缺陷与复审：N/A：尚未审核
- Change Request：N/A：未发现范围变更
- 已知限制：当前为 DRAFT，不允许实施或进入 READY

## 防过度开发检查

- 当前只创建 TASK-0017 DRAFT；不实施治理修复。
- AC 为 6 条；执行单元为 6 个；文件预算为 3。
- 不创建 TASK-0018，不修改全局工作流、TASK-0008、TASK-0009、产品代码、测试或依赖。
- 不执行分支同步，不创建或倒签授权/门禁，不自行审核。

## 最终完成条件

- 独立 Reviewer 完成规格审核与实施审核，所有 Finding 关闭。
- AC-01～AC-06 全部通过；工作流校验和 `git diff --check` 通过。
- 仅三个批准管理文件发生变化；无实施锁；规格锁按合法状态迁移释放。
- 提交已推送，工作区与暂存区干净，本地与远端 hash 一致。
- 仅由独立 Reviewer 在权威工作流条件全部满足后转为 COMPLETED。

---

> 当前为 DRAFT；下一步仅允许 Codex Reviewer 执行 G17-02 独立规格审核。不得实施 TASK-0017、继续 TASK-0009 或创建 TASK-0018。
