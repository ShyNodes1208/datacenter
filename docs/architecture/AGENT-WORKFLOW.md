# Agent 工作流规范

## 1. 权威性与适用范围

本文档是任务状态、状态迁移、模块占用、角色交接、Reviewer 独立性、产品与技术裁决、范围变更、完成报告、Git 同步和最终完成条件的唯一权威来源。`AGENTS.md`、`agents/*.md` 和任务文件只能引用本文档或增加特定任务约束，不得复制后改写本文规则。冲突时以本文档为准。

所有状态值必须使用本文定义的大写名称，不得创建自定义状态。

## 2. 角色与裁决边界

- **Claude + DeepSeek**：负责需求范围、业务规则、产品优先级、产品验收标准和产品争议裁决。
- **Codex Architect**：负责技术架构、模块边界、文件修改范围、API、数据模型、技术验收标准和技术争议裁决。
- **Owner**：只实现任务的功能要求、验收标准和已批准技术设计明确要求的内容，并提供证据。
- **Reviewer**：独立审核和复审，不直接修改被审核内容。
- **hangyu**：批准 Reviewer 独立性例外及需要项目负责人决定的取消操作。

产品需求基线未书面批准前，Architect 不得创建正式开发任务。事项同时涉及产品范围和技术实现时，必须依次完成：Claude 裁决产品范围；Architect 评估技术影响；更新 `Requirement Source`、任务文件和验收标准；书面更新完成后才可继续开发。

## 3. 封闭状态集合

合法状态只有：`IDLE`、`DRAFT`、`READY`、`IN_PROGRESS`、`READY_FOR_REVIEW`、`CHANGES_REQUESTED`、`IN_FIX`、`READY_FOR_RETEST`、`COMPLETED`、`BLOCKED`、`CANCELLED`。

### 3.1 状态定义

| 状态 | 含义 | 允许的前置状态 | 有权发起者 | 进入条件 | 退出条件 | 当前允许操作 | 禁止操作 | 失败或回退路径 |
|---|---|---|---|---|---|---|---|---|
| `IDLE` | 当前没有活动任务 | `COMPLETED`、`CANCELLED`，或项目初始化 | Architect | 上一任务已归档且占用已释放 | 已建立新任务草案 | 选择需求、创建草案 | 开发、审核、占用模块 | 信息不足时保持 `IDLE` |
| `DRAFT` | 任务正在编写和裁决 | `IDLE`、`BLOCKED` | Claude（产品部分）、Architect（技术部分） | 已有 Task ID 和 Requirement Source | 产品基线、Owner、Reviewer、范围与验收标准齐备 | 澄清、设计、补全文档 | 修改业务代码、认领开发模块 | 缺少裁决转 `BLOCKED`；放弃转 `CANCELLED` |
| `READY` | 已获准开始但尚未开发 | `DRAFT`、`BLOCKED` | Architect | 产品基线已批准；Owner/Reviewer 不同；范围、验收、命令、架构引用完整；例外已记录 | Owner 完成模块冲突检查并成功认领 | 预检查、认领模块 | 未认领即开发；更改批准范围 | 冲突或前置失效转 `BLOCKED`；放弃转 `CANCELLED` |
| `IN_PROGRESS` | Owner 正在首次开发 | `READY`、`BLOCKED` | Owner | `MODULE-LOCKS.md` 无父子路径冲突且记录为 `CLAIMED` | 实现、构建、测试、证据和交接记录齐备 | 修改允许文件、构建、测试 | 越界修改、未批范围扩张、Reviewer 修改 | 受阻转 `BLOCKED`；范围变化走 Change Request；放弃转 `CANCELLED` |
| `READY_FOR_REVIEW` | 首次开发完成，等待独立审核 | `IN_PROGRESS`、`BLOCKED` | Owner | 构建/测试通过或有批准的 N/A；开发证据和书面交接完整；锁为 `HANDED_OFF` | Reviewer 给出通过或缺陷结论 | Reviewer 只读检查、执行验证 | Owner 继续修改；Reviewer 修改被审内容 | 缺陷转 `CHANGES_REQUESTED`；环境受阻转 `BLOCKED` |
| `CHANGES_REQUESTED` | Reviewer 已要求修改 | `READY_FOR_REVIEW`、`READY_FOR_RETEST`、`BLOCKED` | Reviewer | 缺陷有编号、等级、证据、复现和修复要求 | 指定修复者并重新取得模块占用 | 评估缺陷、计划修复 | 未认领即修复；Reviewer 自行修复 | 无法修复转 `BLOCKED`；取消转 `CANCELLED` |
| `IN_FIX` | 修复者正在修复已记录缺陷 | `CHANGES_REQUESTED`、`BLOCKED` | Owner 或指定修复者 | 修复者不是最终 Reviewer；锁重新为 `CLAIMED`；修复范围明确 | 修复、回归测试、证据和交接完整 | 仅修复已列缺陷、运行回归 | 新增未批准功能；最终 Reviewer 参与修复 | 受阻转 `BLOCKED`；新范围走 Change Request；放弃转 `CANCELLED` |
| `READY_FOR_RETEST` | 修复完成，等待同一独立 Reviewer 复审 | `IN_FIX`、`BLOCKED` | 修复者 | 缺陷修复记录、回归结果和书面交接完整；锁为 `HANDED_OFF` | Reviewer 完成复审 | Reviewer 只读复审和重跑验证 | 修复者继续修改；Reviewer 修改被审内容 | 未通过转 `CHANGES_REQUESTED`；环境受阻转 `BLOCKED` |
| `COMPLETED` | Reviewer 已确认全部门禁通过 | `READY_FOR_REVIEW`、`READY_FOR_RETEST` | 最终 Reviewer | 验收与复审通过；无开放缺陷；校验通过；已提交并推送；工作区干净；本地/远端哈希一致；锁已释放 | 归档后当前指针可转 `IDLE` | 归档、报告、合并申请 | 继续修改任务内容、未授权改结论 | 发现问题必须创建新任务，不得回写状态 |
| `BLOCKED` | 因冲突、缺失裁决或外部条件暂停 | `DRAFT`、`READY`、`IN_PROGRESS`、`READY_FOR_REVIEW`、`CHANGES_REQUESTED`、`IN_FIX`、`READY_FOR_RETEST` | 发现阻塞的当前责任角色 | 已记录原因、证据、责任人、解除条件和恢复目标状态；停止相关修改 | 阻塞解除且原目标状态的进入条件重新满足 | 调查、书面升级、处理非阻塞事项 | 绕过阻塞继续相关开发或审核 | 回到记录的 `DRAFT`/`READY`/`IN_PROGRESS`/`READY_FOR_REVIEW`/`CHANGES_REQUESTED`/`IN_FIX`/`READY_FOR_RETEST`，或转 `CANCELLED` |
| `CANCELLED` | 任务经批准终止 | `DRAFT`、`READY`、`IN_PROGRESS`、`READY_FOR_REVIEW`、`CHANGES_REQUESTED`、`IN_FIX`、`READY_FOR_RETEST`、`BLOCKED` | Claude（产品取消）与 Architect（技术影响确认）；争议由 hangyu 决定 | 已记录原因、裁决和未完成影响；锁已释放 | 归档后当前指针可转 `IDLE` | 归档和报告 | 继续开发、审核或复用旧批准 | 若要恢复必须创建新任务，不得复活原任务 |

### 3.2 封闭迁移表

只有下列迁移合法：

| 起点 | 允许终点 |
|---|---|
| `IDLE` | `DRAFT` |
| `DRAFT` | `READY`、`BLOCKED`、`CANCELLED` |
| `READY` | `IN_PROGRESS`、`BLOCKED`、`CANCELLED` |
| `IN_PROGRESS` | `READY_FOR_REVIEW`、`BLOCKED`、`CANCELLED` |
| `READY_FOR_REVIEW` | `COMPLETED`、`CHANGES_REQUESTED`、`BLOCKED`、`CANCELLED` |
| `CHANGES_REQUESTED` | `IN_FIX`、`BLOCKED`、`CANCELLED` |
| `IN_FIX` | `READY_FOR_RETEST`、`BLOCKED`、`CANCELLED` |
| `READY_FOR_RETEST` | `COMPLETED`、`CHANGES_REQUESTED`、`BLOCKED`、`CANCELLED` |
| `BLOCKED` | `DRAFT`、`READY`、`IN_PROGRESS`、`READY_FOR_REVIEW`、`CHANGES_REQUESTED`、`IN_FIX`、`READY_FOR_RETEST`、`CANCELLED` |
| `COMPLETED` | `IDLE` |
| `CANCELLED` | `IDLE` |

未列出的迁移全部禁止，尤其禁止 `DRAFT`/`READY`/`IN_PROGRESS` 直接到 `COMPLETED`，禁止绕过 `CHANGES_REQUESTED`、`IN_FIX` 或 `READY_FOR_RETEST`。每次状态变化必须在任务的交接记录中写明时间、发起者、前后状态和证据。

## 4. 模块占用与冲突控制

`tasks/MODULE-LOCKS.md` 是模块占用登记表。进入 `IN_PROGRESS` 前，Owner 必须将路径规范化为仓库相对路径，检查完全相同路径及目录父子重叠；路径比较在 Windows 上不区分大小写。任何活跃的 `CLAIMED` 或 `HANDED_OFF` 记录与目标路径相同、为其父路径或子路径，都构成冲突。发现冲突时不得写文件，任务必须转 `BLOCKED`，并记录冲突 Task ID。

锁记录字段至少包含 `Task ID`、`Module or Path`、`Owner`、`Claimed At`、`Status`、`Release Condition`、`Released At`。锁状态只有 `CLAIMED`、`HANDED_OFF`、`RELEASED`：

1. 首次开发：Owner 检查冲突并登记 `CLAIMED`，之后才可进入 `IN_PROGRESS`。
2. 开发交审：进入 `READY_FOR_REVIEW` 时改为 `HANDED_OFF`，继续阻止其他任务占用；Reviewer 只有只读权。
3. 要求修复：进入 `CHANGES_REQUESTED` 时保持 `HANDED_OFF`；进入 `IN_FIX` 前由原 Owner 或指定修复者重新检查冲突并将同一记录改为 `CLAIMED`。最终 Reviewer 不得成为锁 Owner。
4. 修复交复审：进入 `READY_FOR_RETEST` 时再次改为 `HANDED_OFF`。
5. 完成或取消：转入 `COMPLETED` 或 `CANCELLED` 前改为 `RELEASED` 并填写 `Released At`。普通 `BLOCKED` 不自动释放；是否保留必须记录，释放后恢复开发必须重新认领。

不得仅依赖 Agent 自觉、聊天声明或不同工作区隔离来避免冲突。

## 5. 交接规则

- **开发到审核**：Owner 记录变更文件、构建/测试命令与结果、验收证据、已知限制、提交说明和待核验点，将锁改为 `HANDED_OFF`，再转 `READY_FOR_REVIEW`。
- **审核到修复**：Reviewer 记录审核结论和完整缺陷清单，转 `CHANGES_REQUESTED`；Owner/指定修复者确认缺陷范围并重新认领后转 `IN_FIX`。
- **修复到复审**：修复者逐项记录修复、提交回归证据、将锁改为 `HANDED_OFF`，再转 `READY_FOR_RETEST`；最终 Reviewer 独立复审。

## 6. Reviewer 独立性

Owner 与最终 Reviewer 必须是不同主体；Reviewer 不得直接修改被审核代码或文档；任何修复者不得担任最终 Reviewer。任务进入 READY 前必须校验 Owner 与 Reviewer 不同。

唯一例外由 **hangyu** 明确书面批准。任务必须记录例外原因、批准人、批准时间/记录、涉及范围和补偿性复审方式；补偿性复审必须由未参与开发和修复的独立主体执行。没有完整记录即不得进入 `READY`。

## 7. 范围变更（Change Request）

开发 Agent 只能实现功能要求、验收标准和已批准技术设计明确列出的内容。发现新需求、API 契约变化、数据模型变化、超出允许修改范围、新增第三方依赖、影响其他模块或验收标准无法覆盖的新行为时，必须停止相关开发并转 `BLOCKED`（不受影响且不接触同一锁的工作可继续）。

书面 Change Request 至少包含：`Change Request ID`、`发现者`、`原任务`、`变更原因`、`产品范围影响`、`技术影响`、`文件影响`、`测试影响`、`风险`、`Claude 裁决`、`Architect 裁决`、`更新后的 Requirement Source`、`批准状态`。

Claude 先裁决产品范围，Architect 再裁决技术影响。只有批准状态为 `APPROVED`，且 Requirement Source、任务文件、允许/禁止范围和验收标准完成书面更新后，相关开发才能从 `BLOCKED` 恢复。`REJECTED` 的变更不得实现。

## 8. 防过度规划、过度设计和过度开发门禁

本门禁与第 7 节 Change Request 配合执行，不改变现有状态机、模块锁或 Reviewer 独立性规则。

### 8.1 可追踪性与最小实现

每个实际实现，包括代码、页面、API、数据表或字段、第三方依赖、基础设施和抽象层，都必须同时映射到 `Requirement Source`、功能要求和验收标准；无法映射的内容不得实现。每个任务必须明确最小实现范围、明确不实现范围和推迟到未来的内容。未来需求只能进入 backlog，不得提前进入当前实现。

### 8.2 最简单可行方案与复杂方案记录

必须优先采用满足当前验收标准的最简单可行方案。采用复杂方案时，必须记录简单方案为何不能满足当前需求、复杂方案解决的当前问题、新增维护成本以及批准该方案的技术裁决；不得仅因“未来可能需要”增加设计或实现。

### 8.3 强制停止条件

发现新增未批准功能、新增未批准依赖、修改 API 契约、修改数据模型、增加基础设施、增加未要求的页面或接口、无关重构、为未来需求提前抽象，或修改超出任务允许范围时，必须停止相关工作，并依第 7 节发起 Change Request；未经批准不得恢复。

### 8.4 抽象门禁

新增接口、基类、工厂、插件机制或通用框架，必须至少满足一项：当前存在两个及以上真实实现；当前需求明确要求可替换实现；已有证据证明直接实现不满足需求；已批准 ADR 明确要求。否则不得新增。

### 8.5 POC 隔离

POC 只用于验证技术可行性。未经批准，POC 不得成为正式业务功能、不得自动进入生产代码、不得借此扩大产品范围。

### 8.6 Reviewer 专项检查

Reviewer 必须检查是否存在无法映射到验收标准的实现、未来阶段功能、未批准依赖、无现实需求支撑的抽象、无关重构或扩大的数据模型/API，并验证删除额外实现后当前验收标准是否仍可通过。明显过度开发至少记为 `MEDIUM`；明显增加部署、迁移、数据或维护风险时记为 `HIGH`。

### 8.7 防过度开发完成门禁

除第 9、10 节既有条件外，任务进入 `COMPLETED` 前还必须确认：所有实现均映射到验收标准；没有未批准依赖；没有未批准数据模型或 API 变化；没有无关重构；没有提前实现未来需求；采用当前最简单可行方案；Reviewer 的防过度开发专项检查已通过。

## 9. 完成报告最低字段

所有角色的完成报告至少包含：任务 ID、最终状态、当前分支、Owner、Reviewer、修改文件、实现/审核内容、构建命令与结果、测试命令与结果、验收证据、审核结论、缺陷与修复/复审结果、Change Request、提交说明、提交哈希、推送结果、本地哈希、远端哈希、模块锁释放证据、已知限制、最终完成条件。角色文件只能追加字段，不得删除这些字段。任何不适用字段必须填写 `N/A：具体理由`，不得静默留空。

## 10. Git、推送与最终完成条件

提交前必须执行任务要求的构建、测试、工作流校验和 `git diff --check`，并确认没有越界或敏感文件。每个通过验收的任务必须创建本地提交并推送当前远端分支。推送后必须核对工作区干净，且 `git rev-parse HEAD` 与对应 `origin/<branch>` 完全一致。

任务只有在独立 Reviewer 验收/复审通过、所有缺陷关闭、构建和测试通过或有批准的 N/A、校验通过、锁已释放、提交与推送成功、工作区干净、本地与远端哈希一致时，才可由 Reviewer 转为 `COMPLETED`。开发者交审只能转为 `READY_FOR_REVIEW` 或 `READY_FOR_RETEST`，不得自行标记 `COMPLETED`。
