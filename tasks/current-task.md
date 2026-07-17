# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：CHANGES_REQUESTED
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：9 项实施路径锁全部 HANDED_OFF；CHANGES_REQUESTED 保持 HANDED_OFF；修复时由 Cursor Developer 重新认领为 CLAIMED 后进入 IN_FIX

## 第二次实现复审结果

- 复审提交：1124339（retest）
- 复审报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST.md
- 复审结论：NEEDS_CHANGES
- AC 结果：19 PASS / 1 FAIL（AC-SC-17 FAIL）
- 已关闭：IR-001 CLOSED、IR-002 CLOSED
- 仍开放：IR-003/RT-001 OPEN、IR-004/RT-002 OPEN

### 复审缺陷摘要

| Finding | 等级 | 问题 | 修复方向 |
|---------|------|------|---------|
| RT-001 (IR-003) | MAJOR | verify-project.ps1 中 grep exit 2 被当成"无匹配"接受；Git 管道可掩盖 git ls-files 失败 | grep 要求恰好 exit 1；git ls-files 独立检查成功后再 pip 到 grep |
| RT-002 (IR-004) | MINOR | launchSettings.json 含 UTF-8 BOM，`python3 -m json.tool` 退出码 1 | 保存为 UTF-8 without BOM，保持 JSON 内容不变 |

## 当前目标

Cursor Developer 按修复矩阵修复 RT-001 和 RT-002：

1. 修复 `scripts/verify-project.ps1` grep 门禁：将 `$LASTEXITCODE -ne 0` 改为 `$LASTEXITCODE -eq 1`（仅接受"无匹配"为成功）；git ls-files 独立检查退出码后再 pip 到 grep
2. 修复 `launchSettings.json`：保存为 UTF-8 without BOM（内容不变）
3. 重新运行 `verify-project.ps1` 确保 20 项全部 PASS
4. 修复完成后重新进入 READY_FOR_RETEST，由 Codex Reviewer 执行第三次复审

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 最终状态：COMPLETED
- 审核结论：PASS

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
- 修复范围限于 RT-001 和 RT-002；不得修改其他验收标准或依赖预算
- 不新建 CR（验收目标不变；规格无冲突；仅实现未完全符合现有规格）
