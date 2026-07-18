# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY_FOR_RETEST
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：9 项实施路径锁全部 HANDED_OFF；READY_FOR_RETEST 保持 HANDED_OFF；等待 Codex Reviewer 第四次复审 RV-001/RV-002

## 第四次复审（RETEST-3）与修复记录

- 复审提交：b3a4ea4（retest-3）
- 复审报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-3.md
- 复审结论：NEEDS_CHANGES
- 发现：0 BLOCKER / 2 MAJOR / 0 MINOR

### 前三次复审缺陷状态

| Finding | 等级 | 问题 | 处置 |
|---------|------|------|------|
| IR-001 | MAJOR | AC-SC-18 lock metadata | **CLOSED**（确认） |
| IR-002 | MAJOR | AC-SC-20 directory check | **CLOSED**（确认） |
| IR-003/RT-001 | MAJOR | grep/Git error propagation | **CLOSED**（确认） |
| IR-004/RT-002 | MINOR | launchSettings BOM | **CLOSED**（确认） |
| RT-003 | MAJOR | AC-SC-13 recursive grep hits binary DLL strings | **SPEC_CLARIFIED**（AC-SC-13 改为 XML 检查；CR-0004 批准） |

### RETEST-3 缺陷与修复

| Finding | 等级 | 问题 | 处置 |
|---------|------|------|------|
| RV-001 | MAJOR | AC-SC-17 gate 9 仍保留已废除的 `grep -r "coverlet" tests/` | **CLOSED**（AC-SC-17 gate 9 改为引用 AC-SC-13 验证原则；使用 --exclude-dir=bin --exclude-dir=obj；明确退出码语义） |
| RV-002 | MAJOR | 缺少 CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST 状态迁移 | **CLOSED**（两次迁移已记录；状态/锁/交接记录一致） |

## 当前目标

RV-001 和 RV-002 已修复。AC-SC-13/AC-SC-17/verify-project.ps1 三者一致。Coverlet 验证 PASS。状态已迁移至 READY_FOR_RETEST。

等待 Codex Reviewer 执行第四次（终审）READY_FOR_RETEST 复审。

## 当前约束

- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
- 修复范围限于 RV-001（AC-SC-17 gate 9）+ RV-002（状态迁移与交接记录）
- 不修改代码、测试、依赖、产品或架构基线
- verify-project.ps1 无需修改
