# Change Request CR-0005

## 基本信息

- Change Request ID：CR-0005
- 标题：TASK-0007 Microsoft.AspNetCore.Mvc.Testing 精确版本补充
- 状态：等待独立 Codex Reviewer 定点审核
- 提出角色：Codex Architect
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 原始 Blocker：`BLOCKED_SPEC_DEPENDENCY_VERSION`
- 原始 BLOCKED 提交：`909a59cb99aa1c9a8bb7abf293e73c970bb2ded0`
- 发现者：Codex Backend
- Reviewer：Codex Reviewer
- 批准状态：APPROVED（Architect 技术裁决；Reviewer PASS 前不得恢复实施）

## 变更原因

TASK-0007 已批准测试项目直接依赖 `Microsoft.AspNetCore.Mvc.Testing`，但依赖表和 AC-BF-34 只记录包名，未规定精确版本。Codex Backend 无权自行选择依赖版本，因此在尚未产生实现代码时停止并将任务从 `IN_PROGRESS` 合法转为 `BLOCKED`。

## 变更前规格

- 依赖表：`Microsoft.AspNetCore.Mvc.Testing`，无版本。
- AC-BF-34：要求测试项目新增该 PackageReference，但无精确版本。

## Architect 裁决与变更后规格

- 包名：`Microsoft.AspNetCore.Mvc.Testing`
- 版本：`8.0.29`
- 目标项目：`tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`
- 类型：测试项目直接依赖
- 精确声明：`<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.29" />`
- 禁止 `latest`、`8.0.x`、`*`、浮动版本和无版本 PackageReference。

批准依赖清单保持唯一：

- `Microsoft.EntityFrameworkCore.Sqlite`：`8.0.29`
- `Microsoft.EntityFrameworkCore.Design`：`8.0.29`
- `Microsoft.AspNetCore.Mvc.Testing`：`8.0.29`
- `dotnet-ef`：`8.0.29`

除上述已批准依赖及 TASK-0006 既有测试依赖外，其他新增依赖仍禁止。

## 权威 Change Request 字段

- 变更原因：Backend 依赖版本门禁因原规格缺少精确版本而阻塞。
- 产品范围影响：无。
- 技术影响：仅固定一个已批准测试依赖的精确版本。
- 文件影响：TASK-0007 依赖表和 AC-BF-34、current-task、MODULE-LOCKS 审计及本 CR 文件；无实施文件变化。
- 测试影响：依赖恢复和集成测试宿主版本变得可复现；测试行为不变。
- 风险：低；版本与已批准 .NET 8 EF Core 和 dotnet-ef 补丁版本一致。
- Claude 裁决：N/A：不改变产品范围、产品角色或业务规则，无产品范围变更需要裁决。
- Architect 裁决：APPROVED；精确版本为 `8.0.29`。
- 更新后的 Requirement Source：不变。
- 批准状态：APPROVED（独立 Reviewer 定点复审前不得恢复任务）。

## 影响分析

- API 变化：无；仍仅有四个认证 API。
- 产品角色变化：无；四个角色及 `DBA/应用运维人员` 组合角色不变。
- 认证与安全行为变化：无；Cookie、Antiforgery、Bootstrap、OnValidatePrincipal、SQLite/WAL 及测试隔离规则不变。
- 文件预算影响：无；实施新增文件上限仍为 16，修改现有文件上限仍为 5，Migration 仍为三个自动生成文件。
- AC 数量影响：无；仍为 AC-BF-01 至 AC-BF-35 共 35 条，仅补充 AC-BF-34 的版本值。
- 实现范围影响：无。
- 实施锁影响：无；19 项实施锁继续 `CLAIMED by Codex Backend`，路径、Owner、状态和范围均不变。

## 回退方式

若独立 Reviewer 不批准本 CR，保持 TASK-0007 为 `BLOCKED`，撤销本次尚未实施的版本裁决并按 Reviewer finding 修正规格；不得由 Backend 自行选择替代版本。

## 验收条件

1. TASK-0007 依赖表明确 `Microsoft.AspNetCore.Mvc.Testing` 版本 `8.0.29`、目标项目和直接依赖类型。
2. AC-BF-34 明确测试项目直接引用 `Microsoft.AspNetCore.Mvc.Testing 8.0.29`。
3. 依赖预算只包含已批准依赖，其他新增依赖仍禁止。
4. 文件预算 16/5、AC 数量 35、API 数量 4 均不变。
5. TASK/current-task 保持 `BLOCKED`，恢复目标保持 `IN_PROGRESS`。
6. 19 项 Backend 实施锁保持 `CLAIMED` 且无任何变化。
7. 无代码、测试项目、csproj、配置、Migration、数据库或依赖安装变化。
8. 工作流校验 20/20 PASS，`git diff --check` PASS。
9. 新的独立 Codex Reviewer 给出定点复审结论；不得预先记录 PASS 或审核提交。

## 当前结论

当前等待独立 Codex Reviewer 定点审核。Reviewer PASS 前 TASK-0007 必须保持 `BLOCKED`，Codex Backend 不得恢复编码。

## 裁决日期

2026-07-19
