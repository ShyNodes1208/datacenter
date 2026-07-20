# TASK-0007 一次性合并授权

## 授权信息

- 关联任务：`TASK-0007-BACKEND-FOUNDATION`
- 授权性质：仓库负责人一次性授权
- 适用范围：仅适用于 `TASK-0007-BACKEND-FOUNDATION`，不自动适用于其他任务
- 授权原因：全局权威工作流未定义合并方式、合并执行角色、main 操作、合并后验证与报告、feature 分支删除及后续任务启动政策
- 原合并门禁报告：`reviews/tasks/TASK-0007-BACKEND-FOUNDATION-MERGE-GATE.md`
- 原门禁提交：`7e3e0b0365c27fc4eb8d47e49e46cae048e563eb`
- 原门禁结论：`MERGE_GATE_BLOCKED`
- 原阻塞类型：`MERGE_GATE_BLOCKED_POLICY_AMBIGUOUS`
- 原 Findings：BLOCKER 1 / MAJOR 0 / MINOR 0 / NOTE 0
- 授权时 main HEAD：`d3bfc520477952a2315d8000eacfbdff28687a4c`
- 授权时 feature HEAD：`7e3e0b0365c27fc4eb8d47e49e46cae048e563eb`
- 授权时 merge-base：`d3bfc520477952a2315d8000eacfbdff28687a4c`
- 当前状态：等待独立 Codex Reviewer 审核

本授权只解决原门禁唯一 BLOCKER 所指的合并政策歧义，不修改 TASK-0007 技术规格，不重新打开任务，不改变 `COMPLETED` 状态或任何锁状态，不替代实现审核，也不表示实际合并已经完成。

## 唯一允许的合并方式

只允许 **fast-forward only**。实际合并必须使用等价于以下命令的方式：

```text
git merge --ff-only origin/feature/task-0007-backend-foundation
```

明确禁止 `--no-ff`、普通 merge commit、squash merge、cherry-pick、rebase、amend、强制 push、reset main 或覆盖远端 main。如 fast-forward 不再可行，必须停止并重新执行合并门禁，不得改用其他合并方式。

## 合并执行角色与独立性

- 实际合并执行角色：Codex Architect。
- Codex Backend 与 Codex Reviewer 均不得执行实际合并。
- 实际合并必须在新的独立 Codex Architect 会话中执行。
- 本授权必须先由独立 Codex Reviewer 审核；Reviewer PASS 前不得实际合并。

## 实际合并前置条件

实际合并前必须同时满足：

1. TASK-0007 与 current-task 均为 `COMPLETED`。
2. 实现审核为 PASS，Findings 为 0/0/0/0，35/35 AC PASS。
3. 19 项实施锁、三项规格锁及全部 CR 临时锁均为 `RELEASED`。
4. 本一次性合并授权已通过独立 Codex Reviewer 审核。
5. 合并门禁已基于最新远端状态重新审核并 PASS。
6. feature 本地与远端一致，main 本地与远端一致。
7. `origin/main` 无新增漂移，merge-base 仍等于当前 `origin/main`。
8. merge-tree 无冲突。
9. Build、Tests、Workflow 与 diff check 全部通过。
10. 工作区干净且暂存区为空。

任一条件不满足均不得合并。

## main 同步与实际合并规则

实际合并会话必须依次：

1. 执行 `git fetch origin --prune`。
2. 切换到 main。
3. 执行 `git pull --ff-only origin main`。
4. 确认本地 main 等于 `origin/main`。
5. 执行 `git merge --ff-only origin/feature/task-0007-backend-foundation`。

不得使用 reset、rebase 或覆盖 main，不得解决冲突后继续合并；main 有漂移时必须停止并重跑门禁。合并后、push 前必须确认 HEAD 为授权的 feature HEAD、没有 merge commit、没有额外提交、工作区干净且暂存区为空，之后才允许执行 `git push origin main`。

## 合并后验证

push main 后必须在同一合并会话内执行：

```text
git fetch origin --prune
dotnet tool restore
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build --filter "FullyQualifiedName~UnitTests"
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build --filter "FullyQualifiedName~IntegrationTests"
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
git status --short --branch
git diff --cached --name-status
```

还必须核对本地 main 与 `origin/main` 一致。要求 Build 0 errors / 0 warnings；UnitTests 7/7；IntegrationTests 20/20；总测试 28/28；failed 0；skipped 0；Workflow `PASS=20 FAIL=0 TOTAL=20`；`git diff --check` PASS；工作区干净；暂存区为空。不得运行 CR-0006 已拒绝的额外门禁。

## 合并后报告

合并和验证全部通过后，Codex Architect 必须在 main 新增 `reviews/tasks/TASK-0007-BACKEND-FOUNDATION-POST-MERGE-VALIDATION.md`，并作为单独提交推送到 main，不得 amend 已有提交。

报告必须记录 TASK-0007、合并前 main HEAD、feature 最终 HEAD、fast-forward 合并结果、合并后 main HEAD、push 结果、构建结果、测试结果、工作流结果、Git 清洁结果、本地与远端 main 一致性、feature 分支状态及最终结论。

## feature 分支保留规则

本授权不允许自动删除本地或远端 `feature/task-0007-backend-foundation`。该分支至少保留到 main 合并成功、合并后验证通过、合并后验证报告提交并推送且本地与远端 main 一致。后续删除需要仓库负责人另行明确授权。

## TASK-0008 启动条件

TASK-0008 仅在以下条件全部满足后允许开始：

1. TASK-0007 已 fast-forward 合并到 main。
2. main 已成功推送。
3. 合并后 Build、Tests、Workflow 全部通过。
4. 合并后验证报告已提交并推送。
5. 本地与远端 main 一致。
6. 工作区干净且暂存区为空。

feature 分支是否删除不作为 TASK-0008 的强制前置条件。

## 治理边界与后续动作

本记录不构成通用合并政策，不修改或补充 `docs/architecture/AGENT-WORKFLOW.md`。全局合并政策仍需后续独立治理任务正式补充。本记录当前仅具备提交给独立 Codex Reviewer 审核的条件；不得预先记录 Reviewer PASS，不得预先记录实际合并完成。
