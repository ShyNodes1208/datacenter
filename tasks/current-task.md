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
- Module Lock：9 项实施路径锁全部 HANDED_OFF（未释放）；等待 Codex Reviewer 对 RT-001 / RT-002 复审

## 第二轮返修摘要

- 修复起点：43cdebbb05c81e2677d177d3a183ff1dd563152d
- RT-001：`Assert-GrepNoMatch` 三态处理（0=命中 FAIL，1=无匹配 PASS，≥2=执行错误 FAIL）；`git ls-files` 独立校验后再过滤
- RT-002：`launchSettings.json` 去除 UTF-8 BOM；`python3 -m json.tool` 退出码 0
- 负向证据：缺失目标 grep exit 2 → 门禁 FAIL（不再误判为 PASS）
- `verify-project.ps1` 退出码 0，ALL CHECKS PASSED
- 工作流 PASS=20 FAIL=0 TOTAL=20

## 当前目标

等待 Codex Reviewer 第三次复审。不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main。

## 当前约束

- Owner 不得继续修改；等待同一独立 Reviewer 复审
- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
