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
- Module Lock：9 项实施路径锁全部 HANDED_OFF（未释放）；等待 Codex Reviewer 复审 IR-001 至 IR-004

## 实现返修摘要

- 修复起点：e8e2c3011d4695508ab3ce3939071d014edf1ad2
- IR-001/IR-003：重构 `scripts/verify-project.ps1`（`npm ci` + AC-SC-18 A/B/C + 白名单 + 模板残留 + Git 跟踪 + `git diff --check` + 工作流 20/20）
- IR-002：AC-SC-20 按 `git ls-files` 检查构建产物是否被跟踪（允许本地存在）
- IR-004：删除 `launchSettings.json` 两处 `launchUrl: weatherforecast`
- `verify-project.ps1` 退出码 0，输出 ALL CHECKS PASSED
- 工作流 PASS=20 FAIL=0 TOTAL=20
- `git diff --check` PASS
- weatherforecast 零命中

## 当前目标

等待 Codex Reviewer 对 IR-001 至 IR-004 执行 READY_FOR_RETEST 复审。不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main。

## 当前约束

- Owner 不得继续修改；等待同一独立 Reviewer 复审
- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
