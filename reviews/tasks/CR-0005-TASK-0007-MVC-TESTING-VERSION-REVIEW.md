# CR-0005 TASK-0007 Microsoft.AspNetCore.Mvc.Testing 版本定点审核报告

## 审核信息

- Change Request：CR-0005
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 审核范围：`909a59cb99aa1c9a8bb7abf293e73c970bb2ded0..a6c9b8268fa2db5d322a50a70db9e0d999eae6a4`
- 原始 BLOCKED 提交：`909a59cb99aa1c9a8bb7abf293e73c970bb2ded0`
- 待审核提交：`a6c9b8268fa2db5d322a50a70db9e0d999eae6a4`
- 分支：`feature/task-0007-backend-foundation`
- Reviewer：Codex Reviewer（新的独立 Reviewer 会话）
- 审核日期：2026-07-19
- 最终结论：**NEEDS_CHANGES**
- Findings：**BLOCKER 0 / MAJOR 0 / MINOR 1 / NOTE 0**

本轮 Reviewer 未修改 CR、TASK、current-task、模块锁、工作流、产品/架构基线、实现、测试、配置、依赖、Migration 或数据库；唯一新增内容为本报告。TASK-0007 和 current-task 继续保持 `BLOCKED`，本报告不执行 `BLOCKED -> IN_PROGRESS`。

## Findings

### CR5-RV-001 — MINOR — 当前阻塞章节保留未标记的 CR 前断言

- 文件与位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md` 第 24-43 行，尤其第 34、37 行；同类表述见 `tasks/current-task.md` 第 84-98 行，尤其第 89 行。
- 问题描述：TASK 的“当前阻塞”仍称依赖表与 AC-BF-34 未规定精确版本，并称 `8.0.29` “尚未通过正式 Change Request 写入规格”。current-task 的“当前阻塞记录”也仍以当前语态称依赖表与 AC-BF-34 未规定版本。上述表述没有标为“原始缺口/原始阻塞原因”，与当前 TASK 第 357、359、757 行及 CR-0005 第 25-54 行已经完成的 Architect 裁决和规格写入相矛盾。
- 风险：当前有效文档同时声称精确版本已经和尚未写入，导致后续有权恢复角色无法从当前态章节唯一判断 `BLOCKED_SPEC_DEPENDENCY_VERSION` 是否已由 CR 内容解决，削弱 BLOCKED 恢复审计的确定性。
- 最小修复方向：仅将上述内容明确标记为“原始规格缺口/原始阻塞原因”，并把 TASK 第 37 行同步为 CR-0005 已将唯一版本 `8.0.29` 写入规格、当前等待独立 Reviewer PASS。保持 TASK/current-task 为 `BLOCKED`，保持恢复目标 `IN_PROGRESS`，不得修改实现或锁。

## 两轴审核

### Standards

**PASS，0 findings。** CR-0005 包含权威工作流要求的 CR 字段；角色裁决、Reviewer 独立性、BLOCKED 状态、锁保留、临时锁释放和审计记录符合 `AGENTS.md`、`docs/architecture/AGENT-WORKFLOW.md` 及既有 CR 惯例。未发现越权、提前恢复或附带设计变更。

### Spec

**NEEDS_CHANGES，1 个 MINOR。** 精确版本修正本身准确且最小，但当前态阻塞章节存在 CR 前后断言冲突，详见 CR5-RV-001。

## Git 前置门禁与范围

- `git fetch origin --prune`：PASS，退出码 0。
- 当前分支：`feature/task-0007-backend-foundation`，PASS。
- 审核开始 HEAD：`a6c9b8268fa2db5d322a50a70db9e0d999eae6a4`。
- 审核开始远端：`a6c9b8268fa2db5d322a50a70db9e0d999eae6a4`。
- 本地与远端一致：PASS。
- 审核开始工作区：干净。
- 提交范围只修改：CR-0005、TASK-0007、current-task、MODULE-LOCKS 四份允许文档。
- `git diff --check 909a59c..a6c9b82`：PASS，退出码 0。
- 无 `src/`、`tests/`、`.config/`、`.gitignore`、csproj、Program.cs、appsettings、Migration、scripts 或数据库变化。

## 原始规格缺口核实

原始阻塞真实成立：架构/任务已批准使用 `Microsoft.AspNetCore.Mvc.Testing`；提交 `909a59c` 时测试 csproj 尚未引用该包，TASK 依赖表只含包名且无版本，AC-BF-34 也未给版本。Codex Backend 无权自行选择依赖版本，因此其在无实现变化时执行 `IN_PROGRESS -> BLOCKED` 合法且必要。`909a59c` 的提交说明为 `chore: block task-0007 for dependency spec gap`，仅修改 TASK、current-task 和 MODULE-LOCKS，原始阻塞记录有效。以 CR 固定一个既有批准依赖的精确版本是解除该规格缺口所需的最小技术变更。

## 精确版本、依赖表、AC 与预算

- 当前依赖表将 `Microsoft.AspNetCore.Mvc.Testing` 唯一固定为 `8.0.29`。
- 目标项目为 `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`。
- 类型为“测试项目直接依赖”。
- 精确声明为 `<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.29" />`。
- AC-BF-34 明确要求测试 csproj 仅直接新增 `Microsoft.AspNetCore.Mvc.Testing` `8.0.29`。
- 当前批准依赖预算仅含 `Microsoft.EntityFrameworkCore.Sqlite`、`Microsoft.EntityFrameworkCore.Design`、`Microsoft.AspNetCore.Mvc.Testing`、`dotnet-ef`，四项均为 `8.0.29`；其他新增依赖继续禁止。
- 当前有效规格不存在该包的其他版本、`latest`、`8.0.x`、通配符、浮动版本或无版本声明；CR 前记录和历史审核材料中的旧描述不作为当前依赖声明。

## 最小范围回归

两提交差异仅精确化依赖表和 AC-BF-34、补充 CR 审计、登记并释放三项 CR 文档临时锁。AC 仍为 35 条，四个认证 API、四个产品角色及 `DBA/应用运维人员` 组合角色均未改变。Cookie、Antiforgery、Bootstrap、OnValidatePrincipal、SQLite/WAL、测试隔离、EF Core Sqlite/Design 8.0.29、dotnet-ef 8.0.29、16 个新增文件上限、5 个修改文件上限、Migration 三文件预算、不实现范围、实施路径、Owner 和 Reviewer 均未改变。

## CR 审计内容检查

CR-0005 准确记录 CR 编号、TASK-0007、提出角色 Codex Architect、原始 Blocker、原始 BLOCKED 提交、变更前后规格、8.0.29、变更理由、影响、回退、Reviewer、验收条件和“等待独立审核”状态；没有预记 PASS、审核提交或 `BLOCKED -> IN_PROGRESS`。文件/AC/API/安全行为/实施锁影响均记录为无。CR 正文本身字段完整；CR5-RV-001 是 TASK/current-task 当前态同步准确性问题。

## 状态、锁与实现隔离

- TASK-0007 当前状态：`BLOCKED`。
- current-task 当前状态：`BLOCKED`。
- Blocker：`BLOCKED_SPEC_DEPENDENCY_VERSION`。
- 恢复目标：`IN_PROGRESS`。
- Owner：Codex Backend；Reviewer：Codex Reviewer。
- 19 项实施锁：全部继续 `CLAIMED by Codex Backend`；相对 `909a59c` 路径集合、数量、Owner、Reviewer 和状态均无变化，未 RELEASED、未 HANDED_OFF。
- TASK-0007 原三项规格锁：均为 `RELEASED`。
- CR-0005 三项文档临时锁：均为 `RELEASED`，无 Codex Architect 活跃占用。
- 实现隔离：PASS；无代码、测试项目、依赖安装、csproj、配置、Migration 或数据库变化，实现仍未开始。

## 强制验证

- `grep -nR "Microsoft.AspNetCore.Mvc.Testing" tasks reviews 2>/dev/null`：已执行并区分当前规格、CR、已完成任务与历史审核材料。
- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：退出码 0；`PASS=20 FAIL=0 TOTAL=20`。
- `git diff --check`（报告新增前）：PASS，退出码 0。
- AC 唯一编号计数：35。
- 认证 API 计数：4。
- TASK-0007 CLAIMED 实施锁计数：19；与原始阻塞提交路径集合差异：0。
- 本地/远端哈希一致且报告新增前工作区干净：PASS。

## 最终决定

CR-0005 的技术修正确实把唯一允许版本固定为 `8.0.29`，不需要额外技术设计、文件预算、依赖或工作流修改；但由于当前态阻塞章节仍保留未标记且相互矛盾的“尚未写入 CR”断言，本审核包尚不足以通过独立 CR 审核。关闭 CR5-RV-001 后应由新的独立 Reviewer 复审；在复审 PASS 前不得进入 BLOCKED 恢复步骤。

- 允许进入 `BLOCKED` 恢复步骤：**否**。
- 允许 Codex Backend 直接继续编码：**否**。
- 提交说明：`review: request changes for cr-0005 task-0007 dependency version`
- 提交哈希：见承载本报告的 Git 提交。
- 推送结果：见该提交的远端同步结果。
- 模块锁释放证据：实施锁因普通 BLOCKED 合法保留；三项 TASK 规格锁及三项 CR 文档临时锁均为 RELEASED。
- 已知限制：本轮为文档 CR 定点审核，不执行构建、测试、依赖恢复或实现验收；相关项 N/A。
- 最终完成条件：N/A：本报告不关闭 TASK-0007，仅给出 CR-0005 的 `NEEDS_CHANGES` 结论。
