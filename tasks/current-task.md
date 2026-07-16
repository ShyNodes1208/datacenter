# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0003
- Task Name：建立防过度规划、过度设计和过度开发门禁
- Status：READY
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：chore/anti-overdevelopment-guardrails
- Task File：tasks/TASK-0003-ANTI-OVERDEVELOPMENT-GUARDRAILS.md
- Requirement Source：hangyu 明确要求所有项目避免过度开发
- Product Baseline：只建立流程门禁，不开发机房业务功能
- Architecture Reference：docs/architecture/AGENT-WORKFLOW.md
- Module Lock：进入 IN_PROGRESS 前由 Codex Architect 认领

## 当前约束

- 只执行 TASK-0003 明确列出的内容
- 不修改业务代码
- 不增加第三方依赖
- 不调整任务状态集合
- 不重写现有工作流
- 不实现复杂自动度量平台
- 不提前开发机房落位业务功能
