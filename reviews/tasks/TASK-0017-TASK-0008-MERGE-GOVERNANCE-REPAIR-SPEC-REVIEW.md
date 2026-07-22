# TASK-0017 合并治理修复规格审核

## 审核信息

- Reviewer：Codex Reviewer
- 审核时间：2026-07-22 11:02:50 +08:00（Asia/Shanghai）
- 审核类型：G17-02 独立规格审核
- 当前分支：`chore/task-0017-governance-repair`
- 审核基线 HEAD：`b7af368840e1ff754c33e4992e03205a34c54333`
- 任务状态：`DRAFT`
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- 最终结论：`NEEDS_CHANGES`

## Git 前置门禁

PASS。fetch 后本地与 `origin/chore/task-0017-governance-repair` 均为 `b7af368840e1ff754c33e4992e03205a34c54333`；工作区干净，暂存区为空。相对 `origin/main` 仅有：

- `A tasks/TASK-0017-TASK-0008-MERGE-GOVERNANCE-REPAIR.md`
- `M tasks/current-task.md`
- `M tasks/MODULE-LOCKS.md`

没有产品代码、测试、Migration、依赖、TASK-0008、TASK-0009 或全局工作流变化。

TASK-0017 与 current-task 均为 `DRAFT`；Owner 为 Codex Architect，Reviewer 为 Codex Reviewer，Blocker 无。三项精确规格锁为 `CLAIMED` by Codex Architect；当前实施锁为 0。

## 历史事实核对

### TASK-0008

PASS。任务准确记录：

- TASK-0008 由双父提交 `e3804299df48ecc9d8d4d5a51d4902504c550616` 合入 main；
- 当前全局工作流没有明确禁止双父 merge；
- 合并前没有 TASK-0008 专用 authorization，也没有执行任务要求的独立 merge gate；
- 缺口是任务要求的独立合并门禁未执行，而不是仅因拓扑为双父 merge；
- post-merge validation 已由提交 `8e1a0785fa168c381265a3f1cd43b1ae7ec296fb` 记录；技术验证为 PASS；
- 当前 main 可保留 TASK-0008；无需重新实现或回退；
- post-merge validation 不能追溯替代事前门禁；不得倒签或补造 authorization/merge gate。

未发现虚构、倒签或历史重写陈述。

### TASK-0009

PASS。Git 证据确认：

- 正式分支为 `feature/task-0009-readonly-room-list`；
- G01 提交为 `2690bdeb9e0ec15c20cb63b52b395cf28763ed0f`；
- TASK/current-task 状态为 `BLOCKED`；规格审核仍为 PASS，业务规格未变化；
- 三项规格锁为 `RELEASED`；实施锁 0；Implementation Started 为 NO；
- 当前不得进入 READY 或实施。

TASK-0017 的 main 记录明确不替代 TASK-0009 feature 上的 G01 释放提交，表述准确。

## 严格范围审核

PASS。TASK-0017 只处理已经发生的 TASK-0008 合并/补偿验证事实、main 过期状态描述、TASK-0009 BLOCKED/锁释放事实和恢复前最小决策条件。范围没有扩展到产品功能、代码、测试、依赖、全局工作流或未来 merge policy。

## 明确排除审核

PASS。规格明确排除：

- 修改 `AGENT-WORKFLOW.md` 或建立全局 merge policy；
- 创建 TASK-0018；
- 修改或回退 TASK-0008；
- 修改、同步、恢复、实施或合并 TASK-0009；
- 倒签 authorization 或补造 merge gate；
- 修改产品/架构业务基线、`src/`、`tests/`、Migration、依赖；
- 删除分支、rebase、reset 或历史重写。

## AC 审核矩阵

| AC | 单一性 | 可验证性 | 范围一致性 | 结论 |
|---|---|---|---|---|
| AC-01 | 单一主要结果：准确记录合并、缺口与 PMV | 可由 Git 历史和 PMV 报告验证 | 仅事实登记 | PASS |
| AC-02 | 单一主要结果：保持 TASK-0008 完成且不追溯改造 | 可由任务/current-task 差异验证 | 不修改已完成任务 | PASS |
| AC-03 | 单一主要结果：修复 main 当前指针 | 可由 current-task 与 Git 差异验证 | 仅状态记录 | PASS |
| AC-04 | 单一主要结果：登记 TASK-0009 G01 阻断事实 | 可由 `2690bdeb…` 验证 | 不修改 TASK-0009 | PASS |
| AC-05 | 单一主要结果：只定义一次性恢复决策条件 | 可由任务/current-task 文本验证 | 不执行同步、恢复或实施 | PASS |
| AC-06 | 单一主要结果：保持禁止修改边界 | 可由 Git 文件范围验证 | 无产品代码或全局治理 | PASS |

AC 结果：6/6 PASS。当前 Finding 属于实施状态与模块锁门禁缺口，不改变 AC 的业务/事实范围判断。

## 文件预算审核

范围预算本身 PASS：新增 1、修改 2、合计 3。

| 操作 | 路径 | 必要性 | 结论 |
|---|---|---|---|
| A | `tasks/TASK-0017-TASK-0008-MERGE-GOVERNANCE-REPAIR.md` | 规格及后续状态证据 | PASS |
| M | `tasks/current-task.md` | 修复当前指针和事实状态 | PASS |
| M | `tasks/MODULE-LOCKS.md` | 登记 TASK-0017 锁生命周期 | PASS |

预算不含 TASK-0008、TASK-0009、`AGENT-WORKFLOW.md`、reviews 预占文件、docs、src、tests、Migration 或依赖。Reviewer 报告由 Reviewer 独立新增，不属于治理实施预算。未发现额外候选文件。

## 微任务审核

| 单元 | 单目标/时间盒 | 角色隔离 | 状态与锁闭合 | 结论 |
|---|---|---|---|---|
| G17-01 | DRAFT 与三份规格管理文件 | Architect 编写 | 已完成，三项规格锁 CLAIMED | PASS |
| G17-02 | Reviewer 只新增规格审核报告 | 独立 Reviewer | 不迁移、不释放 | PASS |
| G17-03 | 仅有 Finding 时修正 TASK-0017 | Architect 修正规格 | 当前因 G17-SR-001 需要执行 | PASS |
| G17-04 | PASS 后 DRAFT → READY 并释放规格锁 | Architect 执行 | 动作本身符合工作流 | PASS |
| G17-05 | 最小 main 状态修复 | Architect 实施 | 未定义实施锁与 READY → IN_PROGRESS → READY_FOR_REVIEW | FAIL |
| G17-06 | 独立实施审核与完成迁移 | Reviewer 审核 | 缺少 G17-05 合法交审前置，当前不能接手 | FAIL |

微任务结果：4/6 PASS，2/6 FAIL。无需增加 G17-07 或更多流程；最小修正应留在现有 G17-05/G17-06 内。

## current-task 审核

PASS。顶部指向 TASK-0017，状态 DRAFT，Owner/Reviewer 正确；保留 TASK-0008 完成历史，明确 governance gap OPEN；TASK-0009 仅作为跨分支 BLOCKED 事实记录，不冒充 main 当前活动任务。Implementation Started 为 NO，当前实施锁为 0。

## 模块锁审核

当前规格阶段 PASS：三项路径精确，Owner 均为 Codex Architect，状态均为 CLAIMED；Release Condition 均为 Reviewer PASS 后由 Architect 执行 DRAFT → READY 时释放。没有改写 TASK-0008 锁历史，也没有声称 main 记录替代 TASK-0009 G01。

后续实施生命周期 FAIL：规格在 G17-04 释放三项规格锁后，G17-05 仍要修改相同三个管理文件，却同时规定“实施锁数量为 0”并在最终完成条件中要求“无实施锁”。它没有定义实施前重新冲突检查和 CLAIMED、合法进入 IN_PROGRESS、交审时 HANDED_OFF 以及 IN_PROGRESS → READY_FOR_REVIEW。

## 防过度开发专项审核

范围设计 PASS：

- AC 6 条；微任务 6 个；治理实施文件 3 个；
- 不创建 TASK-0018；
- 不修改全局工作流或设计完整 merge policy；
- 不增加全局授权角色或未来 feature 策略；
- 不提前同步 TASK-0009；
- 不修改产品代码、测试、依赖或已完成任务；
- 不预建不必要报告。

G17-SR-001 的修正只需补齐现有三路径在既有状态机下必需的锁与交审动作，不需要新文件、新任务、新规则、新依赖或第七个微任务，符合最小必要原则。

## Findings

### G17-SR-001

- 等级：MAJOR
- 文件和章节：`tasks/TASK-0017-TASK-0008-MERGE-GOVERNANCE-REPAIR.md`；“基本信息”“精确文件预算”“5～10 分钟执行单元”“最终完成条件”
- 问题：G17-05 计划修改三个管理文件，但 G17-04 已释放其规格锁，规格又要求实施锁始终为 0；同时没有定义 `READY → IN_PROGRESS → READY_FOR_REVIEW` 及锁 `CLAIMED → HANDED_OFF`。G17-06 因而没有合法的 `READY_FOR_REVIEW` 审核入口。
- 证据：权威工作流第 3.1/3.2 节要求首次开发从 READY 合法进入 IN_PROGRESS，并从 IN_PROGRESS 交至 READY_FOR_REVIEW；第 4 节要求进入 IN_PROGRESS 前锁为 CLAIMED，交审时改为 HANDED_OFF；第 5 节要求完整书面交接。当前规格只写 G17-04 释放规格锁、G17-05 修改、G17-06 审核完成。
- 风险：按现规格执行会在无活跃模块锁、无 IN_PROGRESS 和无 READY_FOR_REVIEW 交接的情况下修改并审核文件，违反唯一权威工作流；Reviewer 无法合法完成 TASK-0017。
- 最小修正方向：仅修改现有 TASK-0017 规格。在 G17-05 内明确：对同一三个精确路径重新检查冲突并登记实施锁 CLAIMED，执行 READY → IN_PROGRESS，完成三个文件的最小修复和验证，登记交接证据，将锁改为 HANDED_OFF，再执行 IN_PROGRESS → READY_FOR_REVIEW；G17-06 仅由独立 Reviewer 审核，PASS 后释放这三项实施锁并执行 READY_FOR_REVIEW → COMPLETED。同步修正“实施锁 0/无实施锁”为“当前规格阶段为 0，实施阶段按上述既有生命周期认领并最终释放”。不新增文件、任务、规则、微任务或实现范围。
- 是否影响 AC：否；6 条 AC 的事实与范围仍可保持不变
- 是否影响文件预算：否；仍为原三个治理文件
- 是否阻止 G17-04：是；规格未 PASS，不得进入 G17-04
- 是否属于过度开发：否；这是现有工作流要求的最小必要门禁。当前规格没有过度治理，但缺少必要实施门禁

Finding 统计：BLOCKER 0 / MAJOR 1 / MINOR 0 / NOTE 0。

## 最终结论与许可

- 最终结论：`NEEDS_CHANGES`
- 真实历史：PASS
- 严格范围与明确排除：PASS
- AC：6/6 PASS
- 文件预算：3/3 PASS
- 微任务：4/6 PASS
- current-task：PASS
- 当前规格锁：PASS
- 后续实施锁生命周期：FAIL
- 防过度开发：PASS；没有要求扩大范围
- 允许进入 G17-03：是，仅修复 G17-SR-001
- 允许进入 G17-04：否
- 允许实施 TASK-0017：否
- 允许继续 TASK-0009：否
- 允许创建 TASK-0018：否

本 Reviewer 未修改 TASK-0017、current-task、MODULE-LOCKS、TASK-0008、TASK-0009、全局工作流或产品代码；未执行状态迁移、释放锁或治理实施。
