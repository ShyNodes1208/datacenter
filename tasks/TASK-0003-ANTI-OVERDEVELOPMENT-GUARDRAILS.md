# TASK-0003：建立防过度规划和防过度开发门禁

## 基本信息

- Task ID：TASK-0003
- Task Name：建立防过度规划、过度设计和过度开发门禁
- Status：READY
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：chore/anti-overdevelopment-guardrails
- Requirement Source：hangyu 明确要求所有项目避免过度开发
- Product Baseline：只建立流程门禁，不开发任何机房业务功能

## 任务目标

在现有 Agent 工作流中增加最小范围和复杂度控制，使任何计划、架构或代码都必须能够映射到已批准需求和验收标准。

超出当前需求的功能、抽象、依赖、数据模型和重构必须停止，并走书面 Change Request。

## 最小实现范围

本任务只增加以下规则：

1. 需求、任务、代码和验收标准之间的可追踪关系。
2. 每个任务必须定义最小实现范围和明确不实现范围。
3. 每个任务必须定义复杂度预算。
4. 未批准的依赖、抽象、数据模型变化和无关重构必须停止。
5. 未来需求只能记录，不得提前进入当前代码。
6. POC 与正式功能必须隔离。
7. Reviewer 必须执行防过度开发专项检查。
8. 未通过范围和复杂度门禁的任务不得进入 COMPLETED。

## 明确不实现

- 不开发任何机房业务功能
- 不创建新的应用项目
- 不修改 src/ 或 tests/
- 不引入第三方依赖
- 不设计微服务、消息队列、缓存或插件系统
- 不重构现有 Agent 工作流
- 不修改现有任务状态集合
- 不重新审核已经关闭的 TASK-0001 和 TASK-0002
- 不建立复杂的自动度量平台

## 允许修改

- AGENTS.md
- docs/architecture/AGENT-WORKFLOW.md
- tasks/TASK-TEMPLATE.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md
- agents/claude-product-manager.md
- agents/codex-architect.md
- agents/codex-backend.md
- agents/codex-reviewer.md
- agents/cursor-frontend.md
- scripts/validate-agent-workflow.ps1

## 禁止修改

- src/
- tests/
- reviews/
- docs/product/
- docs/contracts/
- docs/ui/
- README.md
- tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md
- tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- tasks/TASK-EXAMPLE.md
- 已关闭任务的历史证据

## 必须建立的规则

### 1. 范围可追踪

每项计划、代码、数据表、接口、页面和依赖必须对应：

- Requirement Source
- 功能要求
- 验收标准

无法建立对应关系的内容不得实现。

### 2. 最小实现和非目标

任务模板必须增加：

- 最小实现范围
- 明确不实现范围
- 推迟到未来的内容

### 3. 复杂度预算

任务模板必须增加：

- 允许新增依赖
- 允许新增抽象
- 允许修改的数据模型
- 预计修改文件范围
- 复杂方案采用理由

不适用时必须填写 N/A 和理由。

### 4. 强制停止条件

出现以下情况必须停止相关工作并提交 Change Request：

- 新增未批准功能
- 新增第三方依赖
- 修改 API 契约
- 修改数据模型
- 增加新的基础设施
- 增加任务未要求的页面或接口
- 进行无关重构
- 为未来需求提前建立抽象
- 修改超过任务允许范围

### 5. 简单方案优先

Codex Architect 必须优先选择满足当前验收标准的最简单方案。

使用更复杂方案时必须记录：

- 简单方案为什么不能满足当前需求
- 复杂方案解决的当前问题
- 新增维护成本
- 已批准的技术裁决

### 6. 抽象门禁

接口、基类、工厂、插件机制或通用框架必须至少满足以下一项：

- 当前存在两个及以上真实实现
- 当前需求明确要求可替换实现
- 已有证据证明直接实现无法满足需求
- 已批准 ADR 明确要求

### 7. POC 隔离

POC 只验证技术可行性，不得在未批准情况下演变为正式业务功能。

### 8. Reviewer 专项检查

Reviewer 必须检查：

- 是否存在无法映射到验收标准的代码
- 是否实现未来阶段功能
- 是否新增未批准依赖
- 是否存在无现实需求支撑的抽象
- 是否进行了无关重构
- 是否扩大数据模型或 API
- 删除额外实现后，当前验收标准是否仍可通过

明显过度开发至少记录为 MEDIUM。

显著增加部署、迁移或维护风险时记录为 HIGH。

### 9. 最终完成门禁

任务进入 COMPLETED 前必须确认：

- 所有实现均可映射到验收标准
- 没有未批准依赖
- 没有未批准数据模型或 API 变化
- 没有无关重构
- 没有提前实现未来需求
- 已采用满足当前需求的最简单可行方案
- Reviewer 防过度开发检查通过

## 校验脚本要求

validate-agent-workflow.ps1 至少增加以下检查：

- TASK-TEMPLATE.md 包含最小实现范围
- TASK-TEMPLATE.md 包含明确不实现范围
- TASK-TEMPLATE.md 包含复杂度预算
- TASK-TEMPLATE.md 包含需求到验收标准的对应关系
- AGENT-WORKFLOW.md 包含防过度开发完成门禁

脚本只检查规则和关键字段，不建立复杂代码量统计系统。

## 验收标准

- [ ] AC-01：权威工作流包含防过度规划和防过度开发规则。
- [ ] AC-02：任务模板包含最小实现、非目标和复杂度预算。
- [ ] AC-03：任务模板要求实现内容映射到验收标准。
- [ ] AC-04：所有 Agent 角色引用统一的防过度开发规则。
- [ ] AC-05：Reviewer 具有明确的过度开发检查项和缺陷等级。
- [ ] AC-06：未批准依赖、抽象、数据模型和无关重构会触发停止。
- [ ] AC-07：未来需求不得提前进入当前代码。
- [ ] AC-08：校验脚本能够检查新增关键字段。
- [ ] AC-09：Windows PowerShell 校验全部通过。
- [ ] AC-10：未修改业务代码或扩大本任务范围。

## 构建和测试

本任务不涉及业务构建。

必须执行：

```powershell
git diff --check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/validate-agent-workflow.ps1
```

## Git 要求

- 提交信息：docs: add anti-overdevelopment guardrails
- 推送分支：chore/anti-overdevelopment-guardrails
- 不得合并 main

## 最终状态

开发完成后进入 READY_FOR_REVIEW，由 Codex Reviewer 独立复审。
