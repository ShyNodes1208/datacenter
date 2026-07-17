# TASK-0006：MVP 项目脚手架

## 基本信息

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：DRAFT
- Owner：Claude + DeepSeek Product Manager（任务规划）；Cursor Frontend（实施）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：待认领（本轮任务规格编写期间 CLAIMED；实施时由 Cursor Frontend 重新认领）

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是（Cursor Frontend ≠ Codex Reviewer）
- 修复者与最终 Reviewer 不同：N/A：本任务为新建，非修复
- 例外原因：N/A
- hangyu 批准记录：N/A
- 补偿性复审方式：N/A

## 前置条件

- [x] 产品基线已批准：TASK-0004 COMPLETED，PASS
- [x] 架构基线已批准：TASK-0005 COMPLETED，PASS
- [x] Owner/Reviewer 独立性已检查：是
- [x] 模块父子路径冲突已检查：src/、tests/ 无活跃占用
- [x] 其他前置条件：无

## 允许修改

- src/frontend/（新建 Vue 3 + Vite 项目）
- src/backend/（新建 ASP.NET Core Web API 项目）
- tests/backend/（新建 xUnit 测试项目）
- scripts/（新增根目录构建/验证脚本）
- .gitignore（最小同步，确保脚手架产物正确排除）
- README.md（最小开发命令说明）
- tasks/TASK-0006-PROJECT-SCAFFOLD.md（本文件）
- tasks/current-task.md（状态同步）
- tasks/MODULE-LOCKS.md（锁同步）

## 禁止修改

- docs/product/MVP-PRODUCT-BASELINE.md（产品基线）
- docs/architecture/MVP-ARCHITECTURE-BASELINE.md（架构基线）
- tasks/TASK-0004-PRODUCT-BASELINE.md
- tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md
- tasks/CR-0001-WSL-DEV-ENVIRONMENT.md
- AGENTS.md
- agents/
- docs/architecture/AGENT-WORKFLOW.md
- reviews/（所有审核报告）
- 任何数据库文件、SQL、Migration

## 功能要求

1. 创建 Vue 3 + TypeScript + Vite 前端项目目录和最小配置。
2. 创建 ASP.NET Core 8 Web API 后端项目。
3. 创建 xUnit 后端测试项目并引用 Web API 项目。
4. 创建解决方案文件（.sln）关联所有 .NET 项目。
5. 前端 `npm install` 成功。
6. 前端 `npm run build`（TypeScript 检查 + Vite 生产构建）成功，0 errors。
7. 前端 `npx vitest run` 最小测试通过。
8. 后端 `dotnet restore` 成功。
9. 后端 `dotnet build` 成功，0 errors。
10. 后端 `dotnet test`（xUnit 最小测试）通过。
11. 工作流校验 20/20 PASS。
12. `git diff --check` PASS。

## 非功能要求

1. 不包含任何业务实体（Room、Cabinet、Server、ServerPosition、User、AuditRecord）。
2. 不包含任何业务 Controller 或 Minimal API 端点。
3. 不包含 SQLite、EF Core 或数据库迁移。
4. 不包含认证和授权实现（无 Cookie Auth、无 PasswordHasher、无 Antiforgery）。
5. 不包含任何正式业务页面（无 RoomListPage、CabinetViewPage 等）。
6. 不引入未在依赖预算中列出的包。
7. 所有依赖精确锁定版本，与 Node 24、npm 和 .NET 8 兼容。
8. 删除脚手架工具生成的演示代码和示例页面。

## 范围与非目标

- 最小实现范围：1 个前端项目 + 1 个后端 Web API 项目 + 1 个后端测试项目 + 1 个解决方案文件 + 最小根目录脚本 + 最小 README 更新
- 明确不实现范围：业务实体、业务 Controller、正式 Vue 页面、SQLite 配置、EF Core、认证授权、API 契约、UI 组件库、全局状态管理库、HTTP 客户端库
- 推迟到未来的内容：路由结构（TASK-0008）、登录页面（TASK-0008）、导航布局（TASK-0008）、API 客户端封装（TASK-0008）、EF Core 和实体（TASK-0007）、认证实现（TASK-0007）、业务功能（TASK-0009+）

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| 前端项目骨架（Vue 3 + Vite + TypeScript） | hangyu 机房落位可视化需求 | NFR-006（浏览器兼容性） | AC-SC-01, AC-SC-02, AC-SC-03, AC-SC-04 |
| 后端项目骨架（ASP.NET Core 8 Web API） | hangyu 机房落位可视化需求 | 全部 FR（基础设施） | AC-SC-05, AC-SC-06, AC-SC-07 |
| 后端测试项目（xUnit） | hangyu 机房落位可视化需求 | NFR-001, NFR-005（测试基础） | AC-SC-08 |
| 解决方案和构建脚本 | hangyu 机房落位可视化需求 | NFR-002（开发效率） | AC-SC-09, AC-SC-12 |
| README 开发命令 | hangyu 机房落位可视化需求 | NFR-002（开发效率） | AC-SC-09 |

## 复杂度预算

- 允许新增项目：3 个（1 前端 + 1 后端 Web API + 1 后端测试）
- 允许新增解决方案文件：1 个（.sln）
- 允许新增脚本：最多少量根目录构建/验证脚本
- 允许新增依赖：见依赖预算
- 允许新增抽象：0
- 允许修改的数据模型：N/A（无数据模型）
- 允许修改的 API 契约：N/A（无 API 契约）
- 预计修改文件或目录范围：
  - src/frontend/（新建）
  - src/backend/（新建）
  - tests/backend/（新建）
  - scripts/（可能新增构建脚本）
  - .gitignore（最小同步）
  - README.md（最小更新）
- 复杂方案采用理由：N/A：本任务使用 Vite 和 dotnet 默认模板创建最小骨架

## 验收标准

- [ ] AC-SC-01：`cd src/frontend && npm install` 成功，无错误。
- [ ] AC-SC-02：`cd src/frontend && npx vue-tsc --noEmit`（或等效 TypeScript 检查命令）通过，0 errors。
- [ ] AC-SC-03：`cd src/frontend && npm run build` 成功，生成 dist/ 产物。
- [ ] AC-SC-04：`cd src/frontend && npx vitest run` 通过，至少包含 1 个占位测试（如验证 Vitest 环境正常）。
- [ ] AC-SC-05：`cd src/backend && dotnet restore` 成功。
- [ ] AC-SC-06：`cd src/backend && dotnet build` 成功，0 errors。
- [ ] AC-SC-07：`cd tests/backend && dotnet test` 通过，至少包含 1 个占位测试（如验证 xUnit 环境正常）。
- [ ] AC-SC-08：解决方案文件 `dotnet build` 在仓库根目录或 src/ 下成功。
- [ ] AC-SC-09：仓库根目录或 scripts/ 下的构建/验证脚本可在 WSL 中通过 pwsh 或 bash 执行。
- [ ] AC-SC-10：项目中没有 Room、Cabinet、Server、ServerPosition、User、AuditRecord 实体类。
- [ ] AC-SC-11：项目中没有业务 Controller（除脚手架默认生成的占位外；占位不含业务逻辑）。
- [ ] AC-SC-12：项目中没有 SQLite、EF Core NuGet 包引用或 Migration 文件。
- [ ] AC-SC-13：项目中没有 Cookie Authentication、PasswordHasher、Antiforgery 或授权实现。
- [ ] AC-SC-14：项目中没有正式业务页面（除 Vite 默认 App.vue 占位外）。
- [ ] AC-SC-15：所有依赖均在本任务依赖预算内，无 Axios、Pinia、AutoMapper、MediatR、FluentValidation、Serilog、UI 组件库或 Docker。
- [ ] AC-SC-16：工作流校验 `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` 20/20 PASS。
- [ ] AC-SC-17：`git diff --check` PASS。
- [ ] AC-SC-18：提交后工作区干净。
- [ ] AC-SC-19：本地与远端任务分支一致。
- [ ] AC-SC-20：可以独立交给 Codex Reviewer 审核。

## 构建命令

实施时应运行（本轮不执行）：

```powershell
# 前端
cd src/frontend
npm install
npx vue-tsc --noEmit
npm run build
npx vitest run

# 后端
cd src/backend
dotnet restore
dotnet build
cd ../../tests/backend
dotnet test

# 根目录（如适用）
dotnet build
```

## 构建结果

- 命令：待实施
- 退出码：待实施
- 摘要/证据：待实施

## 测试命令

```powershell
# 前端
cd src/frontend && npx vitest run

# 后端
cd tests/backend && dotnet test

# 工作流校验
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
```

## 测试结果

- 命令：待实施
- 退出码：待实施
- 摘要/证据：待实施

## 开发完成证据

- 修改文件：待实施
- 验收证据：待实施
- 模块锁状态：待实施
- 已知限制：待实施

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
| 2026-07-17 | Claude + DeepSeek Product Manager | IDLE | DRAFT | — | TASK-0005 COMPLETED；创建 TASK-0006 任务规格 |
|  |  |  |  |  |  |

## 审核结论

- Reviewer：Codex Reviewer（待审核）
- 结论：待审核
- 审核命令和证据：待提交

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
|  |  |  |  |  |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
|  |  |  |  |  |

## 复审结果

- 最终 Reviewer：待定
- 复审结论：待定
- 关闭缺陷及证据：待定

## 防过度开发检查

- 是否存在验收标准以外的实现：待实施后检查（规格未要求业务功能）
- 是否提前实现未来需求：待实施后检查（禁止 EF Core、认证、业务页面）
- 是否新增未批准依赖：待实施后检查（依赖预算已约束）
- 是否存在无实际需求的抽象：待实施后检查（禁止通用抽象）
- 是否存在无关重构：N/A（新建项目，无既有代码）
- 是否采用最简单可行方案：是（Vite 默认模板 + dotnet new webapi + xUnit 模板）
- Reviewer 结论：待独立审核

## Change Request

- Change Request ID：N/A
- 发现者：N/A
- 原任务：N/A
- 变更原因：N/A
- 产品范围影响：N/A
- 技术影响：N/A
- 文件影响：N/A
- 测试影响：N/A
- 风险：N/A
- Claude 裁决：N/A
- Architect 裁决：N/A
- 更新后的 Requirement Source：N/A
- 批准状态：N/A

## Git 提交与推送

- 提交说明：待定（实施时由 Cursor Frontend 填写）
- 提交哈希：待提交
- 推送结果：待推送
- 本地哈希：待提交
- 远端哈希：待推送

## 已知限制

- 脚手架不含路由（TASK-0008）、认证（TASK-0007）、数据访问（TASK-0007）或业务功能（TASK-0009+）。
- 前端 Vitest 仅验证环境正常，不含组件或 composable 测试（TASK-0008 补充）。
- 后端 xUnit 仅验证测试项目可运行，不含业务逻辑测试（TASK-0007+ 补充）。

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 验收标准全部通过（AC-SC-01 至 AC-SC-20）
- [ ] 所有缺陷关闭
- [ ] 构建和测试通过（前端 npm build + vitest；后端 dotnet build + dotnet test）
- [ ] 工作流校验和 `git diff --check` 通过
- [ ] 模块锁已释放
- [ ] 已提交并推送
- [ ] 工作区干净
- [ ] 本地与远端哈希一致
- [ ] Reviewer 的防过度开发专项检查通过
- [ ] 状态由 Reviewer 转为 `COMPLETED`

---

## 附录 A：依赖预算

### 前端运行时依赖

| 依赖 | 用途 | 当前任务需要理由 | 删除成本 |
|------|------|-----------------|----------|
| `vue` | Vue 3 框架 | 前端项目存在的前提 | 替换框架（高） |

### 前端开发依赖

| 依赖 | 用途 | 当前任务需要理由 | 删除成本 |
|------|------|-----------------|----------|
| `vite` | 构建工具和开发服务器 | 前端构建和开发必须 | 替换构建工具（中） |
| `@vitejs/plugin-vue` | Vite 的 Vue 3 官方插件 | Vite 处理 .vue 文件必须 | 随 Vite 替换 |
| `typescript` | TypeScript 编译器 | 类型检查必须 | 降级为 JavaScript（高） |
| `vitest` | 前端测试框架 | AC-SC-04 最小测试通过必须 | 替换测试框架（中） |
| `vue-tsc` | Vue + TypeScript 类型检查 | AC-SC-02 TypeScript 检查必须 | 替换检查工具（低） |

### 后端运行时依赖

无（仅使用 ASP.NET Core 共享框架，无额外 NuGet 包）。ASP.NET Core Web API 模板默认引用由 `dotnet new webapi` 自动包含。

### 后端设计时依赖

无。不引入 `Microsoft.EntityFrameworkCore.Design`，本任务不涉及 EF Core。

### 后端测试依赖

| 依赖 | 用途 | 当前任务需要理由 | 删除成本 |
|------|------|-----------------|----------|
| `xunit` | 测试框架 | AC-SC-07 后端测试通过必须 | 替换测试框架（中） |
| `Microsoft.NET.Test.Sdk` | .NET 测试运行基础设施 | xUnit 运行必须 | 随 xUnit 替换 |
| `xunit.runner.visualstudio` | `dotnet test` 集成 | Visual Studio / CLI 测试运行必须 | 低 |
| `coverlet.collector` | 代码覆盖率收集（可选） | `dotnet new xunit` 默认包含 | 低 |

### 明确不引入的依赖（本任务）

- `vue-router`（TASK-0008 引入）
- `@vue/test-utils`（当前不测试组件）
- `jsdom` / `happy-dom`（当前不测试 DOM）
- `Microsoft.EntityFrameworkCore.Sqlite`（TASK-0007 引入）
- `Microsoft.EntityFrameworkCore.Design`（TASK-0007 引入）
- `Microsoft.Extensions.Identity.Core`（TASK-0007 引入）
- `Microsoft.AspNetCore.Mvc.Testing`（TASK-0007 引入）
- Axios、Pinia、AutoMapper、MediatR、FluentValidation、Serilog
- Element Plus、Ant Design Vue、Vuetify
- Playwright、Cypress
- Docker 相关

---

## 附录 B：推荐目录结构

实施时应创建的最小目录结构：

```
datacenter-layout/
├── src/
│   ├── frontend/                      # Vue 3 + Vite + TypeScript
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       └── App.vue               # 最小占位（非正式页面）
│   └── backend/                       # ASP.NET Core 8 Web API
│       ├── Program.cs                 # 最小启动（无认证、无 EF Core）
│       ├── appsettings.json
│       └── datacenter-layout-backend.csproj
├── tests/
│   └── backend/                       # xUnit 测试项目
│       ├── UnitTest1.cs               # 占位测试（验证环境）
│       └── backend-tests.csproj
├── datacenter-layout.sln              # 解决方案文件
├── scripts/                           # 构建/验证脚本
│   └── build.ps1                      # 全仓库构建脚本（可选）
├── README.md                          # 更新开发命令
└── .gitignore                         # 已有；实施时确认覆盖脚手架产物
```

不创建：
- `src/Common/`、`src/SharedKernel/`
- `src/Infrastructure/`、`src/BuildingBlocks/`
- `src/backend/Models/`、`src/backend/Services/`、`src/backend/Controllers/`
- `src/backend/Data/`、`src/backend/Migrations/`
- `src/frontend/src/pages/`、`src/frontend/src/composables/`
- `tests/frontend/`
- `docs/contracts/`

业务目录由后续任务按需创建。
