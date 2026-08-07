# TASK-0051：Agent 角色与工作流重建

> Requirement Source：hangyu 于 2026-08-07 要求归档旧角色分工，并建立“Codex 统筹 → Cursor 开发 → 独立 Codex 审核”的活动工作流。

## 基本信息

- Task ID：TASK-0051
- Task Name：Agent 角色与工作流重建
- Status：COMPLETED
- Owner：Codex Coordinator
- Reviewer：Codex Reviewer（独立会话/主体）
- Branch：codex/agent-workflow-realignment
- Requirement Source：2026-08-07 用户书面要求
- Product Baseline：不改变既有产品功能范围
- Architecture Reference：AGENTS.md、docs/architecture/AGENT-WORKFLOW.md
- Module Lock：见 tasks/MODULE-LOCKS.md 中 TASK-0051 精确文件锁

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是
- 修复者与最终 Reviewer 不同：是
- 例外原因：N/A：不使用独立性例外
- hangyu 批准记录：N/A：不使用独立性例外
- 补偿性复审方式：N/A：不使用独立性例外

## 前置条件

- [x] 用户已批准角色替换目标
- [x] Owner/Reviewer 独立性已检查
- [x] 目标治理文件无活跃重叠锁
- [x] 已识别无关未跟踪文件并明确保留

## 允许修改

- AGENTS.md
- agents/
- docs/architecture/AGENT-WORKFLOW.md
- docs/archive/agent-governance-v1-2026-08-07/
- scripts/validate-agent-workflow.ps1
- tasks/TASK-TEMPLATE.md
- tasks/TASK-EXAMPLE.md
- tasks/TASK-0051-AGENT-GOVERNANCE-REALIGNMENT.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md
- reviews/tasks/TASK-0051-AGENT-GOVERNANCE-REVIEW.md（仅独立 Reviewer 创建）

## 禁止修改

- src/
- tests/
- 既有产品、架构、ADR、历史任务和历史审核内容
- API 契约、数据库模型、依赖和业务功能
- 与本任务无关的未跟踪文件

## 功能要求

1. 将旧版活动治理文件完整保存到易识别的带日期归档目录。
2. 固定活动路径只保留 Codex Coordinator、Cursor Developer、Codex Reviewer 三种角色。
3. Coordinator 负责读图、需求理解、产品与技术裁决、任务编写和最终产品复核，但不直接编写业务代码。
4. Cursor Developer 负责前后端、数据库迁移、测试和脚本的已批准实现，不得擅自改变需求或契约。
5. Codex Reviewer 必须由未参与开发或修复的独立会话/主体承担。
6. 任务模板、示例和工作流校验器同步到新角色模型。

## 非功能要求

1. 旧规则原文不得丢失；归档明确标注为非活动规则。
2. 不修改业务代码或历史审计证据。
3. 保留状态机、模块锁、范围变更、防过度开发和 Git 门禁。
4. 新流程应比旧流程更容易理解和执行。

## 范围与非目标

- 最小实现范围：归档旧治理文件，生成三角色活动规则，更新模板、校验器和当前任务状态。
- 明确不实现范围：不开发机房页面、不恢复线缆层、不清理历史任务、不处理 TASK-0021 遗留锁。
- 推迟到未来的内容：TASK-0051 完成后再建立机房 2.5D 与线缆展示任务。

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| 旧治理文件归档 | 2026-08-07 用户要求 | FR-01 | AC-01、AC-02 |
| 三角色活动规则 | 2026-08-07 用户要求 | FR-02 | AC-03、AC-04 |
| 模板和校验器同步 | 2026-08-07 用户要求 | NFR-01 | AC-05、AC-06 |
| 审核独立性 | 2026-08-07 用户要求 | NFR-02 | AC-07 |

## 复杂度预算

- 允许新增依赖：0
- 允许新增抽象：0；只新增三个角色说明和一个归档说明
- 允许修改的数据模型：无
- 允许修改的 API 契约：无
- 预计修改文件或目录范围：治理文档、任务模板、校验脚本和任务状态
- 复杂方案采用理由：N/A：采用原文件归档加固定路径替换

## 验收标准

- [ ] AC-01：归档目录包含说明文件并标注日期、来源和非活动性质。
- [ ] AC-02：旧 AGENTS、权威工作流、五个角色文件、任务模板、任务示例、校验器和旧 current-task 均可追溯。
- [ ] AC-03：活动 `agents/` 只保留三个新角色说明及 `.gitkeep`。
- [ ] AC-04：活动总规则和权威工作流定义三角色流程及独立性边界。
- [ ] AC-05：活动模板和示例不再要求旧角色作为活动角色。
- [ ] AC-06：工作流校验和 `git diff --check` 通过。
- [ ] AC-07：独立 Codex Reviewer 完成只读审核，真实缺陷全部关闭。
- [ ] AC-08：业务代码和无关未跟踪文件未被修改或提交。

## 构建命令

```powershell
# N/A：文档与工作流治理任务。
```

## 构建结果

- 命令：N/A
- 退出码：N/A
- 摘要/证据：N/A：不修改可构建业务代码

## 测试命令

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
```

## 测试结果

- 命令：待执行
- 退出码：待执行
- 摘要/证据：待执行

## 开发完成证据

- 修改文件：待填写
- 验收证据：待填写
- 模块锁状态：CLAIMED
- 已知限制：历史任务和架构基线中的旧角色署名保留为历史事实

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
| 2026-08-07 13:58:36 +08:00 | Codex Coordinator | IDLE | DRAFT | Codex Coordinator | 用户批准角色替换目标并要求归档旧版、生成新版 |
| 2026-08-07 13:58:36 +08:00 | Codex Coordinator | DRAFT | READY | Codex Coordinator | 范围、非目标、文件预算、Owner/Reviewer 和验收标准齐备 |
| 2026-08-07 13:58:36 +08:00 | Codex Coordinator | READY | IN_PROGRESS | Codex Coordinator | 精确目标文件无锁冲突，TASK-0051 锁登记为 CLAIMED |

## 审核结论

- Reviewer：Codex Reviewer（独立会话/主体）
- 结论：PASS
- 审核命令和证据：validator 22/22、git diff --check、独立 Reviewer 复审报告

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
| N/A | N/A | 待审核 | 待审核 | OPEN |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| N/A | N/A | 待审核 | 待审核 | 待提交 |

## 复审结果

- 最终 Reviewer：Codex Reviewer（独立会话/主体）
- 复审结论：PASS
- 关闭缺陷及证据：T0051-ARCHIVE-001 已关闭；归档 12 文件可追溯

## 防过度开发检查

- 是否存在验收标准以外的实现：待审核
- 是否提前实现未来需求：否
- 是否新增未批准依赖：否
- 是否存在无实际需求的抽象：否
- 是否存在无关重构：否
- 是否采用最简单可行方案：是
- Reviewer 结论：PASS；无过度开发阻断项

## Change Request

- Change Request ID：N/A：当前未发生范围变化
- 发现者：N/A
- 原任务：TASK-0051
- 变更原因：N/A
- 产品范围影响：N/A
- 技术影响：N/A
- 文件影响：N/A
- 测试影响：N/A
- 风险：N/A
- Codex Coordinator 裁决：N/A：本任务正在替换旧角色模型
- 用户裁决：N/A：本任务未改变产品目标、成本或重大范围
- 更新后的 Requirement Source：2026-08-07 用户书面要求
- 批准状态：N/A

## Git 提交与推送

- 提交说明：docs: realign agent governance workflow
- 提交哈希：766997d
- 推送结果：成功推送 origin/codex/agent-workflow-realignment
- 本地哈希：766997d
- 远端哈希：766997d

## 已知限制

- 历史任务、审核和架构基线中的角色名称不会改写，以保持审计事实。
- TASK-0021 遗留模块锁不属于本任务范围。

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 所有缺陷关闭
- [ ] 构建和测试通过或有批准的 N/A
- [ ] 工作流校验和 `git diff --check` 通过
- [ ] 模块锁已释放
- [ ] 已提交并推送
- [ ] 无关未跟踪文件保持不变
- [ ] 本地与远端哈希一致
- [ ] Reviewer 的防过度开发专项检查通过
- [ ] 状态由协调者依据 Reviewer PASS 记录为 `COMPLETED`

## 最终复核记录
- Reviewer：Codex Reviewer（独立会话/主体）— PASS；报告：reviews/tasks/TASK-0051-AGENT-GOVERNANCE-REVIEW.md
- validator 22/22；git diff --check PASS；src/tests tracked diff 为空。
- 提交：766997d；已推送 origin/codex/agent-workflow-realignment。
- 11 项 TASK-0051 模块锁已释放。
