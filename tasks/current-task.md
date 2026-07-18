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
- Module Lock：9 项实施路径锁全部 HANDED_OFF；READY_FOR_RETEST 保持 HANDED_OFF；等待 Codex Reviewer 第五次复审 R4-001

## 第五次复审（RETEST-4）与修复记录

- 复审提交：497df48（retest-4）
- 复审报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-4.md
- 复审结论：NEEDS_CHANGES
- 发现：0 BLOCKER / 1 MAJOR / 0 MINOR

### 历史缺陷状态

| Finding | 等级 | 问题 | 处置 |
|---------|------|------|------|
| IR-001/IR-002/IR-003/RT-001/IR-004/RT-002 | — | 早期实现和复审缺陷 | **CLOSED**（多次复审确认） |
| RT-003 | MAJOR | AC-SC-13 recursive grep hits binary DLL strings | **SPEC_CLARIFIED**（AC-SC-13 改为 XML 检查；CR-0004 批准） |
| RV-001 | MAJOR | AC-SC-17 gate 9 --exclude-dir 仍递归扫描 | **SUPERSEDED**（由 R4-001 取代；--exclude-dir 修复不充分） |
| RV-002 | MAJOR | 缺少状态迁移 | **CLOSED**（第四次复审确认） |

### RETEST-4 缺陷与修复

| Finding | 等级 | 问题 | 处置 |
|---------|------|------|------|
| R4-001 | MAJOR | AC-SC-17 gate 9 + verify-project.ps1 gate 9 仍递归扫描 tests/ | **CLOSED**（改为 AC-SC-13 结构化 XML；Python ElementTree 解析 Include+Update；递归 tests/ grep 已完全废除；无害文本/负向夹具验证通过） |

## 当前目标

R4-001 已修复。AC-SC-13/AC-SC-17 gate 9/verify-project.ps1 gate 9 三者统一为结构化 XML PackageReference 检查。递归 tests/ grep 已完全移除。状态已迁移至 READY_FOR_RETEST。

等待 Codex Reviewer 执行第五次（终审）READY_FOR_RETEST 复审。

## 当前约束

- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
- 修复范围限于 R4-001（AC-SC-17 gate 9 + verify-project.ps1 gate 9 + AC-SC-13 Update 属性扩展）
- 不修改代码、测试、依赖、产品或架构基线
- 仅 verify-project.ps1 gate 9 实现方式变更（递归 grep → 结构化 XML），其他门禁不变
