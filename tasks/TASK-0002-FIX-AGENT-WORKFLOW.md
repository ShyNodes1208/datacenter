# TASK-0002：修复 Agent 工作流程审核缺陷

## 基本信息

- Task ID：TASK-0002
- Task Name：修复 Agent 工作规范和任务流程缺陷
- Status：READY
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：chore/agent-workspaces
- Requirement Source：reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- Related Review：TASK-0001

## 任务目标

修复审核报告中的 AWF-001 至 AWF-007，建立完整、可执行、可验证的多 Agent 协作工作流。

本任务只修复规范、模板和流程，不得编写业务代码。

## 开始前必须阅读

1. AGENTS.md
2. reviews/architecture/AGENT-WORKFLOW-REVIEW.md
3. agents/ 下全部角色文件
4. tasks/TASK-TEMPLATE.md
5. tasks/current-task.md
6. tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md

## 允许修改

- AGENTS.md
- agents/claude-product-manager.md
- agents/codex-architect.md
- agents/codex-backend.md
- agents/codex-reviewer.md
- agents/cursor-frontend.md
- docs/architecture/AGENT-WORKFLOW.md
- tasks/TASK-TEMPLATE.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md
- tasks/TASK-EXAMPLE.md
- scripts/validate-agent-workflow.ps1

## 禁止修改

- reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md
- README.md
- src/
- tests/
- docs/product/
- docs/contracts/
- docs/ui/

## 必须修复的缺陷

### AWF-001：任务状态机

建立唯一、封闭的任务状态集合，至少包含：

- IDLE
- DRAFT
- READY
- IN_PROGRESS
- READY_FOR_REVIEW
- CHANGES_REQUESTED
- IN_FIX
- READY_FOR_RETEST
- COMPLETED
- BLOCKED
- CANCELLED

必须为每种状态定义：

- 含义
- 允许进入的前置状态
- 可发起状态变更的角色
- 进入条件
- 退出条件
- 允许执行的操作
- 禁止跳转
- 失败回退方式

### AWF-002：模块占用机制

建立 tasks/MODULE-LOCKS.md，至少记录：

- Task ID
- 模块或路径
- 唯一修改者
- 认领时间
- 当前状态
- 释放条件
- 释放时间

任务进入 IN_PROGRESS 前必须检查路径重叠；发现冲突必须进入 BLOCKED，不得继续修改。

必须定义开发到审核、审核到修复、修复到复审的书面交接规则。

### AWF-003：任务模板

修复未闭合的 Markdown 代码围栏。

任务模板必须包含：

- 需求基线
- Owner 和 Reviewer
- 模块占用信息
- 允许修改和禁止修改
- 功能要求和非功能要求
- 验收标准
- 构建命令和结果
- 测试命令和结果
- 开发完成证据
- 审核结果
- 缺陷修复记录
- 复审结果
- 提交说明
- 提交哈希
- 推送结果
- 本地和远端哈希
- 最终完成条件

不适用的字段必须填写 N/A 和理由，不得留空。

### AWF-004：Reviewer 独立性

必须明确：

- Owner 与最终 Reviewer 必须是不同主体
- Reviewer 不得修改被审核代码
- 修复者不得担任最终 Reviewer
- 例外必须由 hangyu 批准
- 例外必须记录原因和补偿性复审方式
- 任务进入 READY 前必须检查 Owner 与 Reviewer 不同

### AWF-005：Claude 与 Architect 边界

必须明确：

- Claude 负责需求范围、业务优先级、产品验收
- Architect 负责技术拆分、模块边界、文件范围和技术验收
- 产品需求基线批准后，Architect 才能形成技术任务
- 产品争议由 Claude 裁决
- 技术争议由 Architect 裁决
- 涉及范围和技术双方的问题必须分别裁决并更新任务文件

### AWF-006：范围变更

必须建立范围变更流程：

- 只能实现任务功能要求和验收标准明确列出的内容
- 发现新需求或契约变化时必须停止开发
- 提交书面 Change Request
- Claude 裁决需求范围
- Architect 裁决技术影响
- 更新 Requirement Source、任务文件和验收标准后才能恢复

### AWF-007：完成报告一致性

全局完成报告字段必须作为最低要求。

所有角色文件必须引用同一份权威定义，只能增加字段，不得删除字段。

Backend 和 Frontend 的完成报告必须包含提交说明。

## 单一权威来源

必须创建：

docs/architecture/AGENT-WORKFLOW.md

该文件作为以下规则的唯一权威来源：

- 任务状态机
- 状态迁移
- 模块占用
- 角色交接
- Reviewer 独立性
- 范围变更
- 完成报告

AGENTS.md、角色文件和任务模板应引用该文件，避免复制产生规则漂移。

## 示例要求

必须创建 tasks/TASK-EXAMPLE.md，使用修复后的任务模板完整填写一个示例。

示例必须包含：

- 完整状态流转示例
- 模块路径占用示例
- Owner 和 Reviewer 分离
- 构建和测试证据示例
- Git 提交和推送证据示例
- 发生范围变化时的 Change Request 示例

## 校验脚本

创建 scripts/validate-agent-workflow.ps1，用于至少检查：

- 必需文件是否存在
- current-task 中 Status 是否为合法状态
- Owner 与 Reviewer 是否相同
- 任务模板是否包含关键字段
- MODULE-LOCKS.md 是否存在
- Markdown 代码围栏是否成对

脚本必须兼容 Windows PowerShell。

## 验收标准

- [ ] AC-01：AWF-001 至 AWF-007 均有明确修复。
- [ ] AC-02：存在唯一权威工作流文件。
- [ ] AC-03：任务状态和迁移规则完整。
- [ ] AC-04：模块占用和冲突检测规则可执行。
- [ ] AC-05：Owner 与 Reviewer 强制分离。
- [ ] AC-06：范围变更必须停止并审批。
- [ ] AC-07：任务模板 Markdown 结构完整。
- [ ] AC-08：存在完整示例任务。
- [ ] AC-09：校验脚本在 Windows PowerShell 执行成功。
- [ ] AC-10：未修改审核报告和业务代码。
- [ ] AC-11：所有变更已提交并推送 GitHub。
- [ ] AC-12：工作区干净，本地和远端哈希一致。

## 必须执行的检查

- git diff --check
- powershell -ExecutionPolicy Bypass -File scripts/validate-agent-workflow.ps1
- git status
- git diff origin/main...HEAD --stat

## Git 要求

- 提交信息：docs: fix agent workflow review findings
- 推送分支：chore/agent-workspaces
- 不得合并 main

## 完成报告要求

必须报告：

- 修复的缺陷编号
- 修改文件
- 校验命令
- 校验结果
- 提交说明
- 提交哈希
- 推送结果
- 本地和远端哈希
- 已知限制
