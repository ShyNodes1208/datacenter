# Agent 工作规范和任务流程审核报告

## 审核结论

**FAIL**

共发现 7 项缺陷：BLOCKER 0 项、HIGH 3 项、MEDIUM 4 项、LOW 0 项。状态流转、任务模板和并发修改控制存在关键缺口，当前规则尚不足以稳定支撑后续多 Agent 协同开发，不建议在修复并复审前合并。

## 审核对象和范围

- 比较基线：`main...HEAD`
- 审核分支：`chore/agent-workspaces`
- 审核提交：`f882356`、`f3585e9`
- 审核对象：`AGENTS.md`、`agents/` 下全部角色说明、`tasks/current-task.md`、`tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md`、`tasks/TASK-TEMPLATE.md`
- 审核范围：角色职责与边界、Architect/Backend/Reviewer 职责隔离、Reviewer 独立性、Windows/PowerShell 约束、任务全生命周期、本地提交与 GitHub 推送、任务模板约束力、IDLE/READY 机制、并发修改控制、范围变更控制，以及规则的完整性、一致性和可验证性

## 执行过的检查命令

```powershell
Get-Location
git branch --show-current
git status
git fetch origin
git log --oneline -5
git rev-list --left-right --count HEAD...origin/chore/agent-workspaces
git rev-parse main
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
Get-ChildItem agents -File
Get-ChildItem tasks -File
rg -n "IDLE|READY|DRAFT|IN_PROGRESS|REVIEW|FIX|RETEST|COMPLETED|completed|Status" AGENTS.md agents tasks
rg -n "同一时间|只修改|允许修改|禁止修改|Reviewer|Owner|提交|推送|PowerShell|WSL|Linux" AGENTS.md agents tasks
```

检查时当前目录为 `D:\AIProjects\datacenter-layout`；分支正确，工作区干净；执行 `git fetch origin` 后，本地与远端分支 ahead/behind 为 `0/0`。

## 正面确认项

1. 五个角色文件均已建立，产品、架构、后端、前端和审核的主要职责方向清晰；2D 主入口、局部 3D 辅助、Grid Plan 适配层和 API 契约归属等关键边界有明确约束。
2. Codex Architect 负责设计和契约，Codex Backend 负责实现，Codex Reviewer 负责独立审核；未发现 Reviewer 直接参与当前被审核内容开发的证据。
3. `AGENTS.md` 明确限定 Windows、PowerShell、禁用 Linux/WSL，角色文件要求开始前读取该全局规范，当前新增命令也均为 PowerShell 可执行命令。
4. `AGENTS.md` 明确要求任务验收后本地提交、所有本地提交同步 GitHub、提交前测试、推送前检查意外文件，并以本地提交和远端推送同时成功作为 completed 门禁。
5. 后端和前端均被要求只修改当前任务允许的文件，且禁止擅自修改对方职责范围内的契约或结构。
6. Reviewer 规则要求基于证据报告缺陷、开发者修复后重新验证、复审未通过不得进入 completed。

## 缺陷清单

### AWF-001

- **严重等级：** HIGH
- **涉及文件：** `tasks/current-task.md`、`tasks/TASK-TEMPLATE.md`、`AGENTS.md`、`agents/codex-reviewer.md`
- **具体证据或位置：** `tasks/current-task.md:5-10` 只展示 `READY`；`tasks/TASK-TEMPLATE.md:7` 只给出自由文本 `DRAFT`；全仓搜索仅在 `AGENTS.md:140` 和 `agents/codex-reviewer.md:36` 出现 completed 门禁，未定义 IDLE，也未定义开发、审核、修复、复审状态及迁移规则。
- **问题说明：** 没有完整、封闭且可执行的任务状态机，也没有为各状态定义进入条件、退出条件、责任人和允许动作。当前材料无法说明任务如何从 IDLE/READY 进入开发、审核、修复、复审并最终完成。
- **可能影响：** 不同 Agent 可对同一任务状态作不同解释；开发可能在未 READY 时开始，缺陷未修复或未复审的任务也可能被错误推进。
- **修复要求：** 在规范中定义唯一状态集合，至少覆盖 `IDLE`、`READY`、开发中、待审核、修复中、待复审和 `COMPLETED`；逐个规定迁移发起者、前置证据、目标状态、失败回退及禁止跳转，并让 `current-task.md` 和任务模板引用该状态定义。

### AWF-002

- **严重等级：** HIGH
- **涉及文件：** `AGENTS.md`、`tasks/current-task.md`、`tasks/TASK-TEMPLATE.md`
- **具体证据或位置：** `AGENTS.md:93` 仅声明“同一时间只能有一个 Agent 修改同一个业务模块”；`tasks/TASK-TEMPLATE.md:5-27` 只有 Owner、允许修改和禁止修改字段；`tasks/current-task.md:5-10` 没有模块占用、认领时间、占用状态或交接信息。
- **问题说明：** 单 Agent 修改同一模块目前只是原则，缺少模块粒度的认领、冲突检测、释放和交接机制，不能被执行或验证。
- **可能影响：** 多个 Agent 可能在不同任务或工作区同时修改重叠文件，造成覆盖、冲突、契约漂移和难以归责的混合提交。
- **修复要求：** 定义可核验的模块占用记录，至少包含任务 ID、模块/路径、唯一修改者、认领时间、状态和释放条件；规定任务进入开发前必须检查重叠占用，检测到冲突必须停止，并定义开发到修复、开发者到 Reviewer 的书面交接步骤。

### AWF-003

- **严重等级：** HIGH
- **涉及文件：** `tasks/TASK-TEMPLATE.md`
- **具体证据或位置：** `tasks/TASK-TEMPLATE.md:49-56` 的 `powershell` 围栏未闭合，文件在“构建命令”占位符后结束；模板没有审核、缺陷修复、复审、Git 提交、GitHub 推送、完成证据和最终报告字段。
- **问题说明：** 模板在语法和流程内容上均不完整，不能把全局规则转换成每个后续任务可填写、可检查的具体约束。
- **可能影响：** 后续任务可能生成格式损坏或缺少测试/审核/推送门禁的任务书，Reviewer 无法按统一证据验收。
- **修复要求：** 闭合 PowerShell 代码围栏；增加明确的构建命令、测试命令、开发完成证据、审核结果、缺陷修复、复审结果、提交信息、提交哈希、推送结果、本地/远端哈希和完成条件字段，并要求不适用项写明理由而非留空。

### AWF-004

- **严重等级：** MEDIUM
- **涉及文件：** `agents/codex-reviewer.md`、`agents/codex-architect.md`、`tasks/TASK-TEMPLATE.md`
- **具体证据或位置：** `agents/codex-reviewer.md:31` 使用“默认不得”修改被审核代码；`agents/codex-architect.md:44` 只禁止 Architect 同时担任同一任务开发者和最终审核者；`tasks/TASK-TEMPLATE.md:8-9` 分列 Owner 与 Reviewer，但未要求两者必须是不同主体，也未定义例外审批。
- **问题说明：** Reviewer 独立性有原则声明，但没有对所有角色生效的身份隔离硬规则，“默认”一词还留下未定义例外。
- **可能影响：** 后续任务可把 Owner 和 Reviewer 指派给同一主体，或由 Reviewer 先修改被审核代码再审核，导致自审和审计可信度下降。
- **修复要求：** 明确规定同一任务的开发 Owner、修复者与最终 Reviewer 必须是不同主体；若确需例外，必须由谁批准、记录何种理由以及需要何种补偿性复审均应写明，并在任务进入 READY 前校验 Owner 与 Reviewer 不同。

### AWF-005

- **严重等级：** MEDIUM
- **涉及文件：** `agents/claude-product-manager.md`、`agents/codex-architect.md`
- **具体证据或位置：** `agents/claude-product-manager.md:24,58-63` 让产品经理形成实施计划、拆分小任务；`agents/codex-architect.md:26-27` 同时让 Architect 拆分技术任务并定义允许/禁止修改文件。
- **问题说明：** 产品实施规划与架构技术任务拆分存在重叠，但未定义谁对任务边界、拆分结果和文件范围拥有最终决定权，也没有规定交付顺序和冲突裁决路径。
- **可能影响：** 两个角色可能创建相互矛盾的任务、验收口径或文件范围，开发 Agent 无法判断应遵循哪一份计划。
- **修复要求：** 明确 Claude 只负责需求范围、业务优先级和产品验收，Architect 负责在已批准需求基线上形成技术拆分和文件边界；规定产品基线先批准、架构任务后生成，以及两者冲突时由哪个角色就哪类问题裁决。

### AWF-006

- **严重等级：** MEDIUM
- **涉及文件：** `agents/codex-backend.md`、`agents/cursor-frontend.md`、`tasks/TASK-TEMPLATE.md`
- **具体证据或位置：** `agents/codex-backend.md:32-39` 和 `agents/cursor-frontend.md:32-39` 主要限制修改文件和契约；`tasks/TASK-TEMPLATE.md:13-35` 有目标与要求占位符，但没有需求基线版本、范围变更申请、停止执行或升级裁决流程。
- **问题说明：** 现有规则能限制“改哪些文件”，但不能阻止开发 Agent 在允许文件内增加未获批准的行为，也没有在发现需求缺口时强制暂停并请求产品/架构裁决。
- **可能影响：** 开发者可在技术实现中自行扩大功能范围，导致验收标准失真、工期增加或引入未经评估的安全和兼容性风险。
- **修复要求：** 要求开发只实现任务“功能要求 + 验收标准”显式列出的行为；任何新增行为、契约变化或新文件范围必须停止实施，提交书面变更请求，由产品经理裁决需求范围、Architect 裁决技术影响，更新 Requirement Source、任务文件和验收标准后才能恢复。

### AWF-007

- **严重等级：** MEDIUM
- **涉及文件：** `AGENTS.md`、`agents/codex-backend.md`、`agents/cursor-frontend.md`
- **具体证据或位置：** `AGENTS.md:134-139` 要求完成报告包含“提交说明”；`agents/codex-backend.md:41-50` 和 `agents/cursor-frontend.md:41-51` 的完成报告清单均缺少该字段。
- **问题说明：** 角色级完成报告与全局强制报告字段不一致，已经出现规则漂移。
- **可能影响：** Agent 按角色文件执行时可能提交不完整的完成证据，Reviewer 无法快速确认提交意图与任务内容是否一致。
- **修复要求：** 让 Backend 和 Frontend 的完成报告清单显式包含“提交说明”，并规定全局报告字段为最低要求、角色文件只能追加不能删减；建议由角色文件引用单一的全局完成报告定义以避免再次漂移。

## 风险清单

1. **状态值漂移风险：** `DRAFT`、`READY` 使用大写，而 completed 使用小写，且均为自由文本；即使补齐流程，如果不统一大小写和合法值，自动检查仍容易失效。
2. **重复规则漂移风险：** 开始前阅读、Git、完成报告和文件边界分散在全局、角色和任务文件中，AWF-007 已证明复制式规则会发生遗漏。
3. **人工门禁风险：** 当前规则没有配套的 PowerShell 校验脚本或 CI 检查，分支、状态、Owner/Reviewer 分离、允许文件和远端哈希只能依赖人工确认。
4. **分支类型歧义风险：** `AGENTS.md` 的分支规则列出 `feature/*`、`fix/*`、`poc/*`、`review/*`，本任务却使用 `chore/*`；未说明列表是否穷举以及 `chore/*` 的适用条件。

## 最终建议

本次审核结论为 FAIL。先由规范所有者修复 AWF-001 至 AWF-003，再处理 AWF-004 至 AWF-007；修复时不得由 Reviewer 直接修改被审核规范。修复提交应同时给出状态迁移示例、两个任务发生路径重叠时的冲突处理示例，以及一份使用修订后模板填写的完整示例任务。完成后由独立 Reviewer 重新执行 `main...HEAD` 全量差异审核，并逐项记录复审状态；只有全部 HIGH 缺陷关闭、其余缺陷关闭或有明确批准的处置结论，且本地提交与 GitHub 推送证据一致后，才建议合并。
