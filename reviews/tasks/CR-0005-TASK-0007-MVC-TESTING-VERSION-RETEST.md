# CR-0005 TASK-0007 Microsoft.AspNetCore.Mvc.Testing 版本定点复审报告

## 复审信息

- Change Request：CR-0005
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 复审范围：`c7c21e6ea1f8287c840798a1a53df19e61168b04..4e5efee44c3f983ecb97f264ab7a9b7d32234cb4`
- 首次审核报告：`reviews/tasks/CR-0005-TASK-0007-MVC-TESTING-VERSION-REVIEW.md`
- 首次审核提交：`c7c21e6ea1f8287c840798a1a53df19e61168b04`
- 修正提交：`4e5efee44c3f983ecb97f264ab7a9b7d32234cb4`
- 分支：`feature/task-0007-backend-foundation`
- Reviewer：Codex Reviewer（新的独立 Reviewer 会话）
- 复审日期：2026-07-19
- 最终结论：**PASS**
- Findings：**BLOCKER 0 / MAJOR 0 / MINOR 0 / NOTE 0**

本轮只复审 CR5-RV-001 及其必要回归面，不重新设计或全面复审 TASK-0007。Reviewer 未修改 CR、TASK、current-task、模块锁、工作流、实现、测试、配置、依赖、Migration 或数据库；唯一新增内容为本报告。本报告不执行 `BLOCKED -> IN_PROGRESS`。

## CR5-RV-001 复审

### 结论

**CLOSED。** 修正提交已在 TASK、current-task 和 MODULE-LOCKS 中清楚区分原始规格缺口、CR-0005 已完成内容及当前真正阻塞，消除了当前有效描述中的前后矛盾。

### 三个时间层次

1. 原始规格缺口：TASK 第 34 行及 current-task 第 89 行明确标为提交 `909a59cb99aa1c9a8bb7abf293e73c970bb2ded0` 时的历史事实；当时依赖表与 AC-BF-34 没有精确版本，测试项目也无该 PackageReference，因此触发 `BLOCKED_SPEC_DEPENDENCY_VERSION`。TASK 交接记录中的“尚未通过正式 CR”位于原始 `IN_PROGRESS -> BLOCKED` 历史行，不是当前断言。
2. CR-0005 已完成内容：TASK 第 37 行及 current-task 第 96 行明确记录提交 `a6c9b8268fa2db5d322a50a70db9e0d999eae6a4` 已将唯一版本 `8.0.29`、精确 PackageReference、目标测试项目、AC-BF-34 和依赖预算写入仓库。
3. 当前真正阻塞：TASK 第 38-43 行、current-task 第 97-99 行及 MODULE-LOCKS 的 BLOCKED 锁保留记录明确记载首次审核 `NEEDS_CHANGES`、审核报告、审核提交 `c7c21e6`、唯一 Finding `CR5-RV-001`、等待本次独立复审，并要求 Reviewer PASS 前继续保持 `BLOCKED`。

未发现 CR 已经 PASS、任务已解除阻塞、Backend 已恢复实现或代码已经开始的虚假描述。

## Git 前置门禁与修正范围

- `git fetch origin --prune`：PASS，退出码 0。
- 当前分支：`feature/task-0007-backend-foundation`，PASS。
- 复审开始 HEAD：`4e5efee44c3f983ecb97f264ab7a9b7d32234cb4`。
- 复审开始远端：`4e5efee44c3f983ecb97f264ab7a9b7d32234cb4`。
- 本地与远端一致：PASS。
- 复审开始工作区：干净。
- 修正区间只修改 `tasks/TASK-0007-BACKEND-FOUNDATION.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`。
- `git diff --check c7c21e6..4e5efee`：PASS，退出码 0。
- 无 CR 技术裁决、`src/`、`tests/`、csproj、配置、依赖安装、Migration、数据库或实施锁路径变化。

## 残留矛盾搜索

已按指定模式搜索 TASK、current-task、CR-0005 和 MODULE-LOCKS。搜索结果表明：

- “尚未写入 CR/尚未通过正式 CR”只存在于明确标注的修正说明或原始阻塞交接历史中。
- 当前有效描述一致声明 CR-0005 已写入 `8.0.29`，但尚未取得独立 Reviewer PASS。
- CR5-RV-001 修正记录、首次审核报告与提交引用准确。
- TASK、current-task、MODULE-LOCKS 对 `BLOCKED`、Owner、Reviewer、Blocker、恢复目标、实施暂停和锁保留的描述一致。

## 技术 CR 回归确认

- `Microsoft.AspNetCore.Mvc.Testing` 当前唯一允许版本为 `8.0.29`。
- 目标项目为 `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`，类型为测试项目直接依赖。
- AC-BF-34 明确该测试 csproj 仅直接新增 `Microsoft.AspNetCore.Mvc.Testing` `8.0.29`。
- 批准依赖只有 `Microsoft.EntityFrameworkCore.Sqlite`、`Microsoft.EntityFrameworkCore.Design`、`Microsoft.AspNetCore.Mvc.Testing` 和 `dotnet-ef` 四项，均为 `8.0.29`；其他新增依赖禁止。
- AC 数量仍为 35；认证 API 数量仍为 4。
- 实施新增文件预算仍为 16，修改现有文件预算仍为 5，Migration 仍为三个自动生成文件。
- 本轮没有技术设计、API、安全规则或范围变化。

## 状态、锁与实现隔离

- TASK-0007：`BLOCKED`。
- current-task：`BLOCKED`。
- Owner：Codex Backend；Reviewer：Codex Reviewer。
- Blocker：`BLOCKED_SPEC_DEPENDENCY_VERSION`；恢复目标：`IN_PROGRESS`。
- 实现状态：暂停，尚未开始代码实现。
- 19 项实施锁：全部 `CLAIMED by Codex Backend`；相对原始 BLOCKED 提交路径集合差异为 0，路径、Owner、Reviewer 和状态未变化；无 RELEASED、无 HANDED_OFF。
- TASK-0007 三项规格锁、CR-0005 三项临时文档锁及 CR5-RV-001 三项临时文档锁：全部 `RELEASED`。
- 自原始 BLOCKED 提交以来只有 CR、审核报告及三份任务管理文档变化；无实现文件、依赖安装、Migration 或数据库变化。
- 未执行 `BLOCKED -> IN_PROGRESS`，未恢复实现。

## 强制验证

- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：退出码 0；`PASS=20 FAIL=0 TOTAL=20`。
- `git diff --check`（新增本报告前）：PASS，退出码 0。
- AC 唯一编号计数：35。
- 认证 API 契约计数：4。
- TASK-0007 CLAIMED 实施锁计数：19；与提交 `909a59c` 的路径集合差异：0。
- 新增报告前本地与远端哈希一致、工作区干净：PASS。

## 是否足以解除技术阻塞

**是。** 精确版本缺口已完整解决，Backend 可唯一使用 `Microsoft.AspNetCore.Mvc.Testing 8.0.29`；没有其他当前有效规格位置缺少该版本，不需要增加依赖、扩大文件预算或修改 API、AC 数量和安全规则。CR-0005 可以 PASS，并允许进入下一独立步骤：由有权责任角色按权威工作流执行合法的 `BLOCKED -> IN_PROGRESS`。

- 允许进入 `BLOCKED` 恢复步骤：**是**。
- 允许 Codex Backend 直接继续编码：**否**；必须先执行合法的 `BLOCKED -> IN_PROGRESS`。
- 本报告不亲自执行状态恢复，也不授权绕过状态迁移直接实现。

## 最终决定

CR5-RV-001 已完整关闭，且未发现新的 BLOCKER、MAJOR、MINOR 或 NOTE。CR-0005 定点复审结论为 **PASS**。

- 提交说明：`review: approve cr-0005 dependency version retest`
- 提交哈希：见承载本报告的 Git 提交。
- 推送结果：见该提交的远端同步结果。
- 已知限制：本轮仅审核文档 CR，不运行实现构建、业务测试、依赖恢复或数据库命令；这些项目不属于本次定点复审范围。
