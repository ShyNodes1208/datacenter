# CR-0006 TASK-0007 验证门禁适用范围定点审核报告

## 审核信息

- Change Request：CR-0006
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 审核范围：`675dc43792953ec4d57536f2a7ded02381173c5a..f516d2fc34826eb6d2509930a9a4c2988c67fbac`
- 原始 BLOCKED 提交：`675dc43792953ec4d57536f2a7ded02381173c5a`
- 待审核提交：`f516d2fc34826eb6d2509930a9a4c2988c67fbac`
- 分支：`feature/task-0007-backend-foundation`
- Reviewer：Codex Reviewer（新的独立 Reviewer 会话）
- 审核日期：2026-07-19
- 最终结论：**NEEDS_CHANGES**
- Findings：**BLOCKER 0 / MAJOR 1 / MINOR 0 / NOTE 0**

本轮只审核 CR-0006 的验证门禁裁决、审计依据和必要回归面，不审核当前实现代码质量。Reviewer 未修改 CR、TASK、current-task、模块锁、脚本或实施文件；唯一新增内容为本报告。本报告不执行 `BLOCKED -> IN_PROGRESS`，不暂存或提交当前实现。

## Findings

### CR6-RV-001 — MAJOR — “原验证规则要求两个脚本”的核心前提没有 Git 证据

- 文件与位置：`tasks/CR-0006-TASK-0007-VALIDATION-GATE-SCOPE.md` 第 18、22-23 行；`tasks/TASK-0007-BACKEND-FOUNDATION.md` 第 82、829、935 行；`tasks/current-task.md` 第 95、103 行。
- 问题描述：CR 声称 TASK-0007 原提交前验证规则要求执行 `scripts/build.ps1` 和 `scripts/test.ps1`，并以此作为 `BLOCKED_CHANGE_REQUEST_REQUIRED` 的原始规则缺口。但对原始 BLOCKED 提交父提交 `675dc437^` 执行 `git grep`，TASK-0007 和 current-task 均没有这两个路径；全历史 `git log -S` 显示它们首次进入 TASK-0007/current-task 正是阻塞提交 `675dc437`。两个脚本确实从未存在，但“此前已批准规则要求执行它们”并未成立。当前 CR、TASK、current-task 和交接记录把阻塞提交首次写入的断言描述成既有规则，形成循环审计依据。
- 风险：CR 的变更原因、原始 Blocker 合法性和“变更前规则”不可由批准规格历史复现。Reviewer 无法确认本 CR 是修正真实既有门禁，还是在没有来源的前提下先创建缺口再裁决缺口；因此不满足 PASS 条件中的“原验证缺口真实”和 CR 审计准确性要求。
- 最小修复方向：由有权角色提供并引用在 `675dc437` 之前已经生效、明确要求 TASK-0007 执行这两个脚本的权威文件及提交证据；若不存在该证据，则删除“原规则要求执行/废止既有要求”的错误断言，将 CR 准确重述为对 TASK-0007 提交前验证门禁的首次明确化，并同步纠正 TASK、current-task、MODULE-LOCKS 和交接历史中 `BLOCKED_CHANGE_REQUEST_REQUIRED` 的原因及合法依据。保持任务 `BLOCKED`、19 项实施锁和未提交实现不变，重新提交独立审核。

## 已通过的定点检查

### Git 与运行时文件门禁

- 审核开始分支：`feature/task-0007-backend-foundation`。
- 审核开始本地与远端：均为 `f516d2fc34826eb6d2509930a9a4c2988c67fbac`。
- 缓存区为空。
- tracked 实施修改恰好 5 个，untracked 实施新增恰好 16 个；无 tasks、reviews 或 scripts 未提交变化，无预算外文件。
- 源码和配置范围数据库/WAL/SHM 扫描无输出；Git 跟踪和缓存区数据库/WAL/SHM 检查均无输出。
- `git diff --check`：PASS。

### 脚本存在性与 verify-project.ps1 适用性

- `scripts/build.ps1`：不存在，`test -f` 退出码 1；Git 历史无该文件。
- `scripts/test.ps1`：不存在，`test -f` 退出码 1；Git 历史无该文件。
- `scripts/verify-project.ps1` 的提交历史和内容确认其为 TASK-0006 脚手架验证脚本。
- 该脚本第 143 行要求 API 无 PackageReference，第 149-150 行只允许 TASK-0006 原测试依赖，第 154-156 行拒绝 EF Core、SQLite 和 Mvc.Testing，第 234 行要求后端恰好 1 个测试。
- TASK-0007 已批准 EF Core Sqlite/Design、Mvc.Testing、dotnet-ef `8.0.29` 及 20 个测试；因此该脚本不适用于 TASK-0007。不执行该脚本不是规避当前任务的有效失败，CR 不修改 scripts 是正确的最小处理。

### 正式验证门禁与质量强度

CR-0006 写入的正式门禁包含 `dotnet restore`、`dotnet build`、`dotnet test`、工作流校验、`git diff --check`、文件范围/预算检查以及数据库、Development 配置和秘密文件检查；同时要求所有必跑命令退出码为 0、全部测试通过，并禁止 `|| true`、跳过或放宽测试、用 `--no-restore` 隐藏问题以及修改脚本降低门禁。

该门禁本身覆盖依赖恢复、完整编译、单元和集成测试、工作流一致性、Git 格式、16/5 文件预算、3 个 Migration、范围外文件、运行时数据库、Development 配置、秘密文件和失败不可掩盖要求。排除不存在的脚本和 TASK-0006 专用脚本本身不会降低质量标准。本轮 NEEDS_CHANGES 仅源于变更前规则与 Blocker 的审计依据不成立。

### 最小范围、状态与回归

- CR 提交只新增 CR-0006 并修改 TASK、current-task、MODULE-LOCKS 四份管理文档；无 scripts 或实施代码提交变化。
- AC 数量仍为 35，认证 API 数量仍为 4；16/5 文件预算、3 个 Migration、四项 `8.0.29` 依赖及既有安全规则未改变。
- TASK-0007 与 current-task 均保持 `BLOCKED`；Owner 为 Codex Backend，Reviewer 为 Codex Reviewer，恢复目标为 `IN_PROGRESS`。
- 19 项实施锁全部保持 `CLAIMED by Codex Backend`，相对原始 BLOCKED 提交路径集合差异为 0；文档临时锁为 `RELEASED`。
- tracked 实施 diff SHA256：`b72bffec21459fcd239c724f0cc8999c4b1df407f937ac7ae89b5fe10b3d7d0e`。
- tracked patch 备份 SHA256：`b72bffec21459fcd239c724f0cc8999c4b1df407f937ac7ae89b5fe10b3d7d0e`。
- untracked archive 备份 SHA256：`6578d5a48bc984736d0e71d19afdacc3385da4a64b47f5cf5701a5c9e0b4867b`。

## 强制验证

- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：退出码 0；`PASS=20 FAIL=0 TOTAL=20`。
- `git diff --check`（新增本报告前）：PASS，退出码 0。
- 未运行 `dotnet test`、应用程序或 Migration 更新命令。

## 最终决定

CR-0006 的新验证门禁内容准确、可执行且没有降低质量强度，`verify-project.ps1` 的不适用判断也成立；但 CR 对变更前规则和原始 Blocker 的核心审计事实没有历史证据，CR6-RV-001 必须修正后才能 PASS。

- CR 是否足以解除 `BLOCKED_CHANGE_REQUEST_REQUIRED`：**否**。
- 允许进入 `BLOCKED` 恢复步骤：**否**。
- 允许提交当前实现：**否**。
- 提交说明：`review: request changes for cr-0006 validation gate scope`
- 提交哈希：见承载本报告的 Git 提交。
- 推送结果：见该提交的远端同步结果。
