# Agent 工作流规范

## 1. 权威性与目标

本文是任务状态、角色边界、模块占用、独立审核、范围变更、Git 交付和最终完成条件的唯一权威来源。

目标是用最短、可验证的路径交付用户当前需要的产品结果，同时保证实现者与最终审核者相互独立。

任何 Agent 开始任务前必须读取 AGENTS.md、本文、tasks/current-task.md、当前任务文件和 tasks/MODULE-LOCKS.md。

## 2. 三角色职责

### Codex Coordinator

负责需求理解、图片与现状分析、MVP、验收标准、产品和技术裁决、任务派发、行政状态、最终复核及 Git 交付。不得编写业务实现，不得兼任最终独立 Reviewer。

### Cursor Developer

负责所有前端、后端、数据库、测试和必要脚本的实现与修复。不得自行改变需求、架构、数据模型、API 契约或范围，不得审核自己的实现。

### Codex Reviewer

在独立会话或主体中只读审核实现，给出 PASS 或 CHANGES_REQUESTED。不得作为 Owner、编码者或修复者。可以创建自己的审核报告。

### 用户

对产品目标、可见效果、重大范围和成本变化、以及独立性例外拥有最终裁决权。

## 3. 标准工作流

1. 用户向 Codex Coordinator 提出目标，并可提供图片、草图或现有页面。
2. Coordinator 核对现有项目，明确用户结果、MVP、非目标、验收标准和最小接入方案。
3. Coordinator 创建任务文件，标记允许路径、禁止路径、依赖预算、测试要求、Owner 和 Reviewer。
4. 任务达到 READY 后，Cursor Developer 检查模块锁并认领允许路径。
5. Developer 完成最小实现和自测，提交实现交接，任务进入 READY_FOR_REVIEW。
6. 独立 Codex Reviewer 对照规格、规则、测试和 diff 审核。
7. 若结论为 CHANGES_REQUESTED，Developer 只修复有效问题并重新测试，再次交给同一独立 Reviewer。
8. 若结论为 PASS，Coordinator 执行最终构建、测试、diff、提交和推送复核。
9. 只有全部完成条件满足后，Coordinator 才记录 COMPLETED 并释放模块锁。

业务实现的默认 Owner 是 Cursor Developer。仅文档、任务规格、架构裁决和治理规则任务可由 Codex Coordinator 作为 Owner；这类任务仍必须由独立 Codex Reviewer 审核。

## 4. 任务状态

合法状态：

- IDLE：没有活动任务
- DRAFT：需求或验收标准仍在整理
- READY：规格完整，可认领
- IN_PROGRESS：Owner 正在实施
- READY_FOR_REVIEW：实现、自测和交接完成，等待首次审核
- CHANGES_REQUESTED：Reviewer 已提出阻断性问题
- IN_FIX：Owner 正在执行最小修复
- READY_FOR_RETEST：修复和复测完成，等待复审
- COMPLETED：独立审核、最终复核、提交和推送全部通过
- BLOCKED：存在明确外部阻断
- CANCELLED：用户或 Coordinator 依据用户决定取消

标准迁移：

- IDLE 到 DRAFT：Coordinator 登记新需求
- DRAFT 到 READY：Coordinator 确认规格和验收标准完整
- READY 到 IN_PROGRESS：Owner 认领路径且没有锁冲突
- IN_PROGRESS 到 READY_FOR_REVIEW：实现、自测和交接齐全
- READY_FOR_REVIEW 到 CHANGES_REQUESTED：Reviewer 发现阻断问题
- CHANGES_REQUESTED 到 IN_FIX：Owner 接受有效问题并开始修复
- IN_FIX 到 READY_FOR_RETEST：修复和复测完成
- READY_FOR_RETEST 到 CHANGES_REQUESTED：复审仍有阻断问题
- READY_FOR_RETEST 到 COMPLETED：Reviewer PASS，且 Coordinator 完成最终复核、提交和推送
- READY_FOR_REVIEW 到 COMPLETED：Reviewer 首次 PASS，且 Coordinator 完成最终复核、提交和推送

任一活动状态在出现真实外部阻断时可进入 BLOCKED；阻断解除后回到进入 BLOCKED 前的合法状态。取消进入 CANCELLED 后不得恢复，必须新建任务。

Reviewer 负责审核结论，Coordinator 负责按照原始结论更新任务状态和锁；这属于行政记录，不改变 Reviewer 的独立性。

## 5. 任务规格最低内容

每个任务至少包含：

- Task ID、名称、状态、分支、Owner、Reviewer、需求来源
- 用户目标、使用者、场景和最终可见结果
- MVP、明确非目标和范围边界
- 允许修改路径和禁止路径
- 依赖预算
- 功能与非功能要求
- 可执行验收标准
- 测试命令与期望结果
- 风险和回滚方式
- 实施交接与审核结论
- 状态迁移、提交和推送记录

规格缺失到会影响正确性、安全、成本或验收时，任务不得进入 READY。

## 6. 模块占用

所有认领记录写入 tasks/MODULE-LOCKS.md。

规则：

1. 路径必须精确到当前任务需要的最小目录或文件。
2. CLAIMED 表示 Owner 正在修改。
3. HANDED_OFF 表示 Owner 已停止修改并交给 Reviewer。
4. RELEASED 表示任务完成、取消或经明确交接后释放。
5. 同一路径及其父子路径同时只能有一个修改 Owner。
6. Reviewer 默认只读，不认领被审核路径；只可拥有自己的审核报告文件。
7. 需要切换 Owner 时，原 Owner 先记录交接并释放，新 Owner 再认领。
8. 任务开始前已存在且未被任务认领的用户改动或未跟踪文件不得修改、删除、暂存或提交。

发现锁冲突时，相关实现必须停止；不得通过扩大路径、复制文件或静默覆盖绕过。

## 7. 范围与变更裁决

任务实施中出现下列任一情况，必须停止相关工作并记录 Change Request：

- 修改用户目标、验收标准或明确非目标
- 新增依赖、服务、页面、接口、数据表或持久化字段
- 修改 API 契约、数据模型或架构边界
- 超出允许路径
- 成本、风险或最终效果发生明显变化

裁决：

- 不改变用户目标且属于最小技术澄清：Codex Coordinator 裁决并记录理由。
- 改变可见效果、重大范围、成本、风险或交付优先级：用户裁决。
- Reviewer 只能指出偏差和风险，不得自行改写规格。
- Cursor Developer 未获裁决前不得继续相关实现。

## 7.1 Change Request 记录字段

每条范围变更必须记录以下字段：Change Request ID、发现者、原任务、变更原因、产品范围影响、技术影响、文件影响、测试影响、风险、Codex Coordinator 裁决、用户裁决、更新后的 Requirement Source、批准状态。

## 7.2 Reviewer 独立性门禁

- Owner 与最终 Reviewer 必须是不同主体。
- Reviewer 不得直接修改被审核代码或文档。
- 任何修复者不得担任最终 Reviewer。
- 例外必须有用户批准记录和补偿性复审。
- 进入 READY 前必须校验 Owner、修复者和 Reviewer 的独立性。
- Reviewer 必须在独立会话或主体中完成审核。
- Reviewer 不得作为 Owner、编码者或修复者。
- Reviewer 不得修改被审核的业务代码。

## 8. 防过度规划、设计和开发门禁

每个计划项、文件、依赖、抽象、接口和流程步骤都必须能直接追踪到当前需求或验收标准。

以下内容默认拒绝：

- 为未来可能需求预留框架、字段或扩展点
- 没有当前验收依据的重构
- 可以在现有模块完成却新建通用层
- 为视觉完整增加未要求的页面、控件或交互
- 把一个低风险功能拆成多个无产品价值的治理任务
- 重复审核同一未变化产物

如果删除某项仍能满足全部验收标准，应优先删除。确需增加复杂度时，必须在任务中说明当前直接收益和最小替代方案。

## 9. 测试与独立审核

Developer 必须执行任务规格列出的测试，并提供命令和结果。不得用“理论可行”代替实际执行。

Reviewer 至少检查：

- 用户目标和验收标准是否真正满足
- 成功路径、边界和失败路径是否有证据
- 安全、权限、输入、审计和数据一致性
- 性能是否符合当前规模
- diff 是否只包含允许范围
- 是否存在无验收依据的复杂度

阻断问题仅限影响功能、安全、数据、维护或验收的缺陷。个人风格和未来增强只能作为非阻断建议。

## 10. Git 和交付

1. 实施必须在任务分支进行，禁止在 main 上做大规模业务开发。
2. 提交前执行相关构建、测试和任务范围 diff 检查。
3. 只暂存任务允许路径，不得纳入任务前已存在的无关文件。
4. 不得提交秘密、Token、口令或生产配置。
5. 每个通过验收的任务必须有提交并推送到 GitHub。
6. 推送前再次核对任务拥有的改动；既有无关未跟踪文件可以继续存在，但必须与任务开始基线一致。

## 11. 最终完成条件

任务进入 COMPLETED 前必须全部满足：

- 验收标准逐项通过
- 必要构建和测试通过
- 独立 Codex Reviewer 给出 PASS
- 所有有效审核问题已关闭
- diff 仅包含任务允许范围
- 没有引入未批准依赖或范围
- 已创建 Git 提交
- 当前任务提交已推送到 GitHub
- 任务文件记录分支、提交哈希、测试、审核和推送结果
- 任务模块锁已释放

任一条件不满足时不得宣称完成。
