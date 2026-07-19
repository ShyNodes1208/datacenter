# Change Request CR-0006

## 基本信息

- Change Request ID：CR-0006
- 标题：TASK-0007 验证门禁适用范围修正
- 状态：等待独立 Reviewer 审核
- 提出和裁决角色：Codex Architect
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 原始 Blocker：`BLOCKED_CHANGE_REQUEST_REQUIRED`
- 原始 BLOCKED 提交：`675dc43792953ec4d57536f2a7ded02381173c5a`
- 发现者：Codex Backend
- Reviewer：Codex Reviewer
- 批准状态：APPROVED（Architect 技术裁决；独立 Reviewer PASS 前不得恢复任务或提交实现）

## 变更原因与唯一范围

TASK-0007 提交前验证规则引用了不存在的 `scripts/build.ps1` 和 `scripts/test.ps1`。此前建议复用 `scripts/verify-project.ps1`，但完整检查证明该脚本是 TASK-0006 脚手架专用门禁，其依赖和测试数量断言与 TASK-0007 已批准范围直接冲突。本 CR 仅修正 TASK-0007 的验证门禁适用范围，不处理其他技术问题。

## 变更前验证规则与脚本证据

- `scripts/build.ps1`：原规则要求执行；当前不存在，`test -f` 退出码 1，Git 历史无记录。
- `scripts/test.ps1`：原规则要求执行；当前不存在，`test -f` 退出码 1，Git 历史无记录。
- `scripts/verify-project.ps1`：当前存在，`test -f` 退出码 0；曾被建议作为替代，但该建议不成立。

`scripts/verify-project.ps1` 与 TASK-0007 冲突的准确事实：

1. 第 143 行要求 API csproj 无任何 `PackageReference`，而 TASK-0007 已批准 EF Core Sqlite/Design 8.0.29。
2. 第 149-150 行要求测试项目仅含 TASK-0006 原 xUnit 三项依赖，而 TASK-0007 已批准 Mvc.Testing 8.0.29。
3. 第 154-156 行把 EntityFrameworkCore、SQLite、Mvc.Testing 作为禁止内容，直接否定 TASK-0007 已批准依赖。
4. 第 234 行要求后端恰好 1 个测试，TASK-0007 当前批准实现为单元 7、集成 12、全部 20 个测试。

因此该 TASK-0006 专用脚本对 TASK-0007 必然产生误报，不得通过修改脚本、删除合法依赖或减少测试来规避。

## Architect 正式裁决：变更后验证门禁

TASK-0007 提交实现前必须从仓库根目录依次完成以下门禁。

### 1. 依赖恢复、完整编译和完整测试

```powershell
dotnet restore
dotnet build
dotnet test
```

### 2. Agent 工作流与 Git 格式验证

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
```

### 3. 文件预算检查

```powershell
git status --short
git diff --stat
git diff --name-status
git ls-files --others --exclude-standard
```

必须确认新增实施文件不超过 16 个、修改现有实施文件不超过 5 个、Migration 恰好 3 个、无预算外路径、tasks/reviews 没有进入实施提交，且 bin/obj、数据库、日志和秘密文件未进入提交。

### 4. 安全运行时文件检查

```bash
find . -type f \( \
  -name "*.db" -o \
  -name "*.db-wal" -o \
  -name "*.db-shm" -o \
  -name "appsettings.Development.json" \
\) -not -path "./.git/*"
```

该命令必须退出码为 0，输出须逐项核对。被 `.gitignore` 排除的本地 `appsettings.Development.json` 可以存在，但不得修改、暂存或提交；不得有将被提交的数据库、WAL、SHM 或秘密配置。

## 正式替代与禁止规则

- `scripts/build.ps1`：不存在，TASK-0007 不要求执行，也不得新增。
- `scripts/test.ps1`：不存在，TASK-0007 不要求执行，也不得新增。
- `scripts/verify-project.ps1`：TASK-0006 脚手架专用，TASK-0007 不要求执行，也不得修改适配。
- 所有必跑命令退出码必须为 0，所有测试必须通过。
- 不得使用 `|| true`，不得跳过、删除或放宽测试。
- 不得使用 `--no-restore` 隐藏问题，不得修改验证脚本降低门禁。
- 不得提交运行时数据库、日志、凭据、Token、真实开发配置或其他秘密文件。

这是验证命令与任务适用范围纠正，不是降低验证标准。直接 restore/build/test、工作流、Git 格式、精确预算和安全运行时文件检查共同覆盖原验证目标。

## 权威 Change Request 字段与影响分析

- 变更原因：原门禁引用两个不存在脚本，建议替代脚本又与批准实现冲突。
- 产品范围影响：无。
- 技术影响：仅修正 TASK-0007 提交前验证命令和脚本适用范围。
- 文件影响：本 CR、TASK-0007、current-task、MODULE-LOCKS 审计说明；无实施文件变化。
- 测试影响：不改变测试行为、覆盖或断言，仍要求完整测试全部通过。
- 风险：低；仅改变门禁描述，并以直接命令和显式检查保持强度。
- Claude 裁决：N/A：无产品范围变化。
- Architect 裁决：APPROVED；采用本 CR 门禁并排除三个不适用脚本。
- 更新后的 Requirement Source：不变。
- 批准状态：APPROVED（等待独立 Reviewer 审核）。
- 文件预算影响：无；仍为新增 16、修改 5、Migration 3 个。
- 依赖预算影响：无；批准依赖及版本不变。
- AC 数量影响：无；仍为 35 条。
- API 影响：无；仍为 4 个认证 API。
- 安全规则影响：无。
- 实施代码影响：无；当前完整实现原样保留且未提交。
- scripts 影响：无；不新增或修改 scripts。
- 实施锁影响：无；19 项继续 `CLAIMED by Codex Backend`，三项规格锁继续 `RELEASED`。

## 回退方式

若独立 Reviewer 不批准本 CR，TASK-0007 继续 `BLOCKED`，当前实现继续未提交，由 Architect 仅按 Reviewer finding 修正规则。不得恢复不适用脚本，不得由 Backend 扩大 scripts 或文件预算。

## 验收条件

1. TASK 明确废止 build.ps1/test.ps1，并明确 verify-project.ps1 不适用。
2. TASK 完整写入本 CR 门禁与禁止规则，其他验证和安全要求保留。
3. 预算 16/5、Migration 3、AC 35、API 4 及依赖/安全规则不变。
4. TASK/current-task 保持 `BLOCKED`，恢复目标保持 `IN_PROGRESS`。
5. 19 项实施锁保持 `CLAIMED by Codex Backend`；三项规格锁保持 `RELEASED`。
6. 当前 5 个修改和 16 个新增实施文件内容不变，不进入本 CR 缓存区或提交。
7. scripts、reviews、既有 CR、产品和架构基线无变化。
8. 工作流校验 `PASS=20 FAIL=0 TOTAL=20`，`git diff --check` 退出码 0。
9. 独立 Codex Reviewer 给出定点审核结论；不得预先记录 PASS 或 Reviewer 提交。

## BLOCKED 恢复条件

1. 独立 Codex Reviewer 审核 CR-0006 并 PASS。
2. 有权责任角色合法执行 `BLOCKED → IN_PROGRESS`。
3. Codex Backend 重新执行本 CR 全部门禁，所有必跑命令退出码为 0、所有检查通过。
4. 上述条件满足前不得提交当前完整实现。

## 当前结论

当前完整实现仍未提交；TASK-0007 与 current-task 继续 `BLOCKED`。当前等待独立 Codex Reviewer 审核，不预写审核结论或提交。

## 裁决日期

2026-07-19
