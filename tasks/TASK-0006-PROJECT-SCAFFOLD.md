# TASK-0006：MVP 项目脚手架

## 基本信息

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：CLAIMED（TASK-0006 三项锁由 Claude 持有；实施时由 Cursor Developer 重新认领）

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是（Cursor Developer ≠ Codex Reviewer）
- 修复者与最终 Reviewer 不同：N/A：本任务为新建，非修复
- 例外原因：N/A
- hangyu 批准记录：N/A
- 补偿性复审方式：N/A

## 前置条件

- [x] 产品基线已批准：TASK-0004 COMPLETED，PASS
- [x] 架构基线已批准：TASK-0005 COMPLETED，PASS
- [x] Owner/Reviewer 独立性已检查：是
- [x] 模块父子路径冲突已检查：src/、tests/ 无活跃占用
- [x] 其他前置条件：CR-0002 已批准（工作流状态纠正 + Cursor Developer 角色）
- [x] 实施前规格审查：Codex Reviewer NEEDS_CHANGES（报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-SPEC-REVIEW.md，提交 6a1b4a9）；9 项 finding 已通过本次规格修正全部解决

## 允许修改

- src/frontend/（新建 Vue 3 + Vite + TypeScript 项目）
- src/backend/Datacenter.Api/（新建 ASP.NET Core 8 Web API 项目）
- tests/backend/Datacenter.Api.Tests/（新建 xUnit 测试项目）
- Datacenter.sln（新建解决方案文件，仓库根目录）
- scripts/verify-project.ps1（新增 1 个验证脚本）
- README.md（最小开发命令说明）
- .gitignore（最小同步，仅在现有规则缺失时）
- tasks/TASK-0006-PROJECT-SCAFFOLD.md（本文件）
- tasks/current-task.md（状态同步）
- tasks/MODULE-LOCKS.md（锁同步）

## 禁止修改

- docs/product/MVP-PRODUCT-BASELINE.md（产品基线）
- docs/architecture/MVP-ARCHITECTURE-BASELINE.md（架构基线）
- docs/architecture/AGENT-WORKFLOW.md（工作流规范）
- tasks/TASK-0004-PRODUCT-BASELINE.md
- tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md
- tasks/CR-0001-WSL-DEV-ENVIRONMENT.md
- tasks/CR-0002-TASK-0006-WORKFLOW-AND-DEVELOPER-ROLE.md
- AGENTS.md
- agents/
- reviews/（所有审核报告）
- scripts/validate-agent-workflow.ps1（已有工作流校验脚本，禁止覆盖）
- 任何数据库文件、SQL、Migration
- 任何业务实体、业务 Controller、业务页面

## 功能要求

1. 创建 Vue 3 + TypeScript + Vite 前端项目目录和最小配置。
2. 创建 ASP.NET Core 8 Web API 后端项目（Controllers，无 OpenAPI）。
3. 创建 xUnit 后端测试项目并引用 Web API 项目。
4. 创建解决方案文件（Datacenter.sln）关联所有 .NET 项目。
5. 前端 `npm install` 成功。
6. 前端 `npm run typecheck` 退出码 0。
7. 前端 `npm run test` 退出码 0，恰好 1 个测试通过。
8. 前端 `npm run build` 退出码 0。
9. 后端 `dotnet restore` 退出码 0。
10. 后端 `dotnet build` 退出码 0，0 errors，0 warnings。
11. 后端 `dotnet test` 退出码 0，恰好 1 个测试通过。
12. 统一验证脚本 `pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1` 退出码 0。
13. 工作流校验 20/20 PASS。
14. `git diff --check` PASS。

## 非功能要求

1. 不包含任何业务实体（Room、Cabinet、Server、ServerPosition、User、AuditRecord）。
2. 不包含任何业务 Controller 或 Minimal API 端点。
3. 不包含 SQLite、EF Core 或数据库迁移。
4. 不包含认证和授权实现（无 Cookie Auth、无 PasswordHasher、无 Antiforgery）。
5. 不包含任何正式业务页面（无 RoomListPage、CabinetViewPage 等）。
6. 不引入未在依赖预算中列出的包。
7. 所有依赖精确版本由 package-lock.json 锁定。
8. 删除脚手架工具生成的全部演示代码和示例资源。
9. 使用 npm，禁止 pnpm、yarn、bun。
10. 后端 `dotnet build` 必须 0 warnings；不得通过 NoWarn 或关闭警告隐藏问题。

## 范围与非目标

- 最小实现范围：
  - 1 个前端项目（src/frontend）
  - 1 个 Web API 项目（src/backend/Datacenter.Api）
  - 1 个 xUnit 测试项目（tests/backend/Datacenter.Api.Tests）
  - 1 个解决方案文件（Datacenter.sln，仓库根目录）
  - 1 个新增根目录脚本（scripts/verify-project.ps1）
  - 1 次 README.md 最小更新
  - 1 次 .gitignore 最小更新（仅在现有规则确实缺失时）
  - 前端直接依赖：恰好 7 个（见依赖预算）
  - 后端运行时依赖：0 个额外 NuGet 包（仅 ASP.NET Core 共享框架）
  - 后端测试依赖：恰好 3 个（xunit、Microsoft.NET.Test.Sdk、xunit.runner.visualstudio）
  - 前端占位测试：恰好 1 个
  - 后端占位测试：恰好 1 个

- 明确不实现范围：业务实体、业务 Controller、正式 Vue 页面、SQLite 配置、EF Core、认证授权、API 契约、UI 组件库、全局状态管理库、HTTP 客户端库、Vue Router、Pinia

- 推迟到未来的内容：路由结构（TASK-0008）、登录页面（TASK-0008）、导航布局（TASK-0008）、API 客户端封装（TASK-0008）、EF Core 和实体（TASK-0007）、认证实现（TASK-0007）、业务功能（TASK-0009+）

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| 前端项目骨架（Vue 3 + Vite + TypeScript） | hangyu 机房落位可视化需求 | NFR-006（浏览器兼容性） | AC-SC-01, AC-SC-02, AC-SC-03, AC-SC-04, AC-SC-05, AC-SC-06, AC-SC-07, AC-SC-08 |
| 后端项目骨架（ASP.NET Core 8 Web API） | hangyu 机房落位可视化需求 | 全部 FR（基础设施） | AC-SC-09, AC-SC-10, AC-SC-11, AC-SC-14, AC-SC-15 |
| 后端测试项目（xUnit） | hangyu 机房落位可视化需求 | NFR-001, NFR-005（测试基础） | AC-SC-12, AC-SC-13, AC-SC-16 |
| 解决方案和验证脚本 | hangyu 机房落位可视化需求 | NFR-002（开发效率） | AC-SC-09, AC-SC-17 |
| README 开发命令 | hangyu 机房落位可视化需求 | NFR-002（开发效率） | AC-SC-17, AC-SC-18 |

## 复杂度预算

- 允许新增项目：3 个（1 前端 + 1 后端 Web API + 1 后端测试）
- 允许新增解决方案文件：1 个（Datacenter.sln，仓库根目录）
- 允许新增脚本：1 个（scripts/verify-project.ps1）
- 允许新增抽象：0
- 允许新增直接依赖：见依赖预算
- 允许修改的数据模型：N/A（无数据模型）
- 允许修改的 API 契约：N/A（无 API 契约）
- 预计修改文件或目录范围：
  - src/frontend/（新建；最大 15 个文件）
  - src/backend/Datacenter.Api/（新建；最大 5 个文件）
  - tests/backend/Datacenter.Api.Tests/（新建；最大 3 个文件）
  - Datacenter.sln（新建，仓库根目录）
  - scripts/verify-project.ps1（新建）
  - .gitignore（最小同步，仅在现有规则缺失时）
  - README.md（最小更新）
- 复杂方案采用理由：N/A：本任务使用 Vite 默认模板 + dotnet new 默认模板创建最小骨架，无复杂方案

### 允许创建的文件类别

- .vue、.ts、.json、.html、.cs、.csproj、.sln、.ps1、.md、.gitignore、.svg（仅 favicon.svg）
- 配置文件：tsconfig.json、tsconfig.app.json、tsconfig.node.json、vite.config.ts、appsettings.json、appsettings.Development.json、launchSettings.json

### 禁止创建的文件类别

- 业务实体类（Room.cs、Cabinet.cs、Server.cs 等）
- 业务 Controller（除生成后被删除的 WeatherForecastController 外）
- 业务 Service 类
- DbContext、Migration 文件
- .db、.db-shm、.db-wal 文件
- Vue Router 文件（router.ts）
- Composable 文件（useAuth.ts、useApi.ts）
- 业务页面组件（*Page.vue）
- 业务 UI 组件（CabinetGrid.vue 等）
- Dockerfile、docker-compose.yml
- CI/CD 配置文件
- .env 文件（除模板生成的 .gitignore 外）
- .eslintrc.*、.prettierrc.*

## 验收标准

### AC-SC-01：环境版本基线已记录
- 命令：`node --version && npm --version && dotnet --version`
- 期望：命令正常执行，输出版号。Node ≥ 18，npm 随 Node.js，.NET SDK 8.0.x。
- 证据：实施完成后将实际版本号记录到本任务的构建结果字段。

### AC-SC-02：src/frontend 目录存在且包含 package.json
- 命令：`test -f src/frontend/package.json`
- 期望：退出码 0。
- 证据：文件存在。

### AC-SC-03：package.json 直接依赖与预算完全一致
- 命令：`cd src/frontend && node -e "const p = require('./package.json'); const deps = Object.keys(p.dependencies||{}).sort(); const devs = Object.keys(p.devDependencies||{}).sort(); console.log('deps:', deps); console.log('devs:', devs)"`
- 期望：dependencies 恰好为 `["vue"]`；devDependencies 恰好为 `["@types/node","@vitejs/plugin-vue","@vue/tsconfig","typescript","vite","vitest","vue-tsc"]`（按字母序）。
- 禁止：存在任何不在上述列表中的直接依赖。

### AC-SC-04：package-lock.json 已提交
- 命令：`git ls-files --error-unmatch src/frontend/package-lock.json`
- 期望：退出码 0（文件被 Git 跟踪）。
- 禁止：package-lock.json 在 .gitignore 中。

### AC-SC-05：npm install 成功
- 命令：`cd src/frontend && npm install`
- 期望：退出码 0，无 error 输出。

### AC-SC-06：npm run typecheck 退出码 0
- 命令：`cd src/frontend && npm run typecheck`
- 期望：退出码 0。
- package.json scripts 中 `typecheck` 字段必须为 `vue-tsc --noEmit`。

### AC-SC-07：npm run test 退出码 0，恰好 1 个测试通过
- 命令：`cd src/frontend && npm run test`
- 期望：退出码 0，输出显示 `1 passed`（或等效的 1 个测试通过指示）。
- package.json scripts 中 `test` 字段必须为 `vitest run`。
- 测试文件路径：`src/frontend/src/__tests__/environment.test.ts`。
- 测试内容：恰好 1 个测试，验证 Vitest 运行环境正常（如 `expect(1+1).toBe(2)`），不使用 DOM、不挂载 Vue 组件、不使用 jsdom/happy-dom。
- 禁止：存在任何其他测试文件。

### AC-SC-08：npm run build 退出码 0
- 命令：`cd src/frontend && npm run build`
- 期望：退出码 0，生成 dist/ 产物目录。
- package.json scripts 中 `build` 字段必须为 `vue-tsc --noEmit && vite build`。

### AC-SC-09：Datacenter.sln 存在且包含正确项目
- 命令：`test -f Datacenter.sln`
- 期望：退出码 0。sln 文件位于仓库根目录。
- 命令：`dotnet sln Datacenter.sln list`
- 期望：列出恰好两个项目：
  ```
  src/backend/Datacenter.Api/Datacenter.Api.csproj
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
  ```
- 禁止：sln 中包含前端项目路径。

### AC-SC-10：Datacenter.Api.csproj 属性正确
- 命令：`cat src/backend/Datacenter.Api/Datacenter.Api.csproj`
- 期望内容必须包含：
  - `<TargetFramework>net8.0</TargetFramework>`
  - `<Nullable>enable</Nullable>`
  - `<ImplicitUsings>enable</ImplicitUsings>`
- 禁止包含：
  - `<PackageReference Include="Microsoft.AspNetCore.OpenApi"...`
  - `<PackageReference Include="Swashbuckle.AspNetCore"...`
  - 任何 EF Core 相关 PackageReference
  - `<NoWarn>` 元素

### AC-SC-11：WeatherForecast 和模板演示代码不存在
- 命令：`find src/backend -name "WeatherForecast*" -o -name "WeatherForecastController*" 2>/dev/null`
- 期望：无输出（文件不存在）。
- 命令：`find src/frontend/src -name "HelloWorld*" -o -name "style.css" -o -name "counter*" 2>/dev/null`
- 期望：无输出（文件不存在）。
- 命令：`test -f src/frontend/public/icons.svg || test -f src/frontend/public/vite.svg || test -f src/frontend/src/assets/hero.png || test -f src/frontend/src/assets/vite.svg || test -f src/frontend/src/assets/vue.svg`
- 期望：退出码 1（所有模板演示资源文件不存在）。

### AC-SC-12：Datacenter.Api.Tests.csproj 存在并正确引用
- 命令：`cat tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`
- 期望内容必须包含：
  - `<TargetFramework>net8.0</TargetFramework>`
  - `<Nullable>enable</Nullable>`
  - `<ImplicitUsings>enable</ImplicitUsings>`
  - `<ProjectReference Include="..\..\..\src\backend\Datacenter.Api\Datacenter.Api.csproj" />`
    （或等效的相对路径，解析后指向 src/backend/Datacenter.Api/Datacenter.Api.csproj）
- 期望内容必须包含恰好三个 PackageReference：
  - `xunit`
  - `Microsoft.NET.Test.Sdk`
  - `xunit.runner.visualstudio`

### AC-SC-13：coverlet.collector 不存在
- 命令：`grep -r "coverlet" tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`
- 期望：退出码 1（grep 无匹配）。
- 命令：`grep -ri "coverlet" tests/`
- 期望：退出码 1（任何测试目录下均无 coverlet 引用）。

### AC-SC-14：dotnet restore 退出码 0
- 命令：`dotnet restore Datacenter.sln`
- 期望：退出码 0。

### AC-SC-15：dotnet build 退出码 0，0 errors，0 warnings
- 命令：`dotnet build Datacenter.sln --no-restore`
- 期望：退出码 0。
- 验证：输出中不含 `error`（不区分大小写），不含 `warning`（不区分大小写）。
- 禁止：通过 `<NoWarn>`、`#pragma warning disable` 或其他方式抑制警告。

### AC-SC-16：dotnet test 退出码 0，恰好 1 个测试通过
- 命令：`dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build`
- 期望：退出码 0，输出显示 `1 passed`（或等效的 1 个测试通过指示）。
- 测试文件路径：`tests/backend/Datacenter.Api.Tests/ScaffoldSmokeTest.cs`。
- 测试内容：恰好 1 个测试，验证测试项目可引用并加载 Datacenter.Api 程序集（如引用 `Program` 类并断言其非 null），不测试业务逻辑。
- 禁止：存在 `UnitTest1.cs` 或任何其他测试文件。
- 为允许测试项目访问 Program，Datacenter.Api 的 Program.cs 最后必须包含 `public partial class Program { }`。

### AC-SC-17：统一验证脚本退出码 0
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1`
- 期望：退出码 0。
- 脚本必须从仓库根目录执行，按顺序执行：
  1. `cd src/frontend && npm install`
  2. `cd src/frontend && npm run typecheck`
  3. `cd src/frontend && npm run test`
  4. `cd src/frontend && npm run build`
  5. `dotnet restore Datacenter.sln`
  6. `dotnet build Datacenter.sln --no-restore`
  7. `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build`
  8. `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 任一步骤失败（退出码非 0）时脚本必须立即退出并返回非 0 退出码。
- 脚本必须使用 WSL 中的 pwsh 执行。
- 脚本使用 `$PSScriptRoot` 或 `$PWD` 定位仓库根目录。

### AC-SC-18：无越界依赖
- 命令：`grep -ri "EntityFrameworkCore\|SQLite\|Swashbuckle\|Microsoft.AspNetCore.OpenApi\|vue-router\|pinia\|axios\|@vue/test-utils\|jsdom\|happy-dom\|playwright\|cypress\|eslint\|prettier\|coverlet\|FluentAssertions\|Moq\|NSubstitute\|Microsoft.AspNetCore.Mvc.Testing" src/ tests/ --include="*.csproj" --include="*.json" 2>/dev/null`
- 期望：退出码 1（grep 无匹配）。
- 手动检查：package.json 中无 Router、Pinia、Axios、ESLint、Prettier、Playwright、Cypress、Vue Test Utils、jsdom、happy-dom。
- 手动检查：所有 csproj 中无 EF Core、SQLite、OpenAPI、Swagger、coverlet、FluentAssertions、Moq、NSubstitute、Mvc.Testing。

### AC-SC-19：工作流校验 20/20 PASS，git diff --check PASS
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 期望：退出码 0，输出 `PASS=20, FAIL=0, TOTAL=20`。
- 命令：`git diff --check`
- 期望：退出码 0。

### AC-SC-20：提交后工作区干净，本地远端哈希一致
- 命令：`git status --porcelain`
- 期望：无输出（工作区干净）。
- 命令：`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/chore/task-0006-project-scaffold)"`
- 期望：退出码 0（本地与远端哈希一致）。
- 命令：`git ls-files --error-unmatch src/frontend/package-lock.json`
- 期望：退出码 0（package-lock.json 已提交）。
- 命令：`test -d src/frontend/node_modules`
- 期望：退出码 1（node_modules 不存在于工作区，即被 .gitignore 排除且未在工作区残留）。
- 命令：`test -d src/frontend/dist`
- 期望：退出码 1（dist 目录不存在于工作区，即未提交构建产物）。

---

## 实施命令

以下命令按顺序执行。Cursor Developer 必须使用这些精确命令，不得替换为"等效命令"。

### 步骤 1：环境检查

```powershell
node --version
npm --version
dotnet --version
```

记录输出到本任务的构建结果字段。

### 步骤 2：创建前端项目

```powershell
cd <repo-root>
npm create vite@9.1.1 src/frontend -- --template vue-ts
```

生成后 package.json 中 scripts 字段：

```json
{
  "dev": "vite",
  "build": "vue-tsc --noEmit && vite build",
  "preview": "vite preview",
  "typecheck": "vue-tsc --noEmit",
  "test": "vitest run"
}
```

注意：`typecheck` 和 `test` 需手动添加到 scripts；`preview` 由模板生成，保留但不用于验收。

### 步骤 3：添加 Vitest

```powershell
cd src/frontend
npm install -D vitest@4.1.10
```

### 步骤 4：安装前端依赖

```powershell
cd src/frontend
npm install
```

此步骤生成 package-lock.json。

### 步骤 5：删除前端模板演示内容

删除以下文件和目录：

```powershell
# 删除演示组件
rm src/frontend/src/components/HelloWorld.vue
rm src/frontend/src/components/ -rf 2>/dev/null  # 目录为空时删除

# 删除演示样式
rm src/frontend/src/style.css

# 删除演示资源
rm src/frontend/src/assets/hero.png
rm src/frontend/src/assets/vite.svg
rm src/frontend/src/assets/vue.svg
rm src/frontend/src/assets/ -rf 2>/dev/null     # 目录为空时删除

# 删除模板 SVG 图标（除 favicon.svg）
rm src/frontend/public/icons.svg

# 删除前端 README（模板自带，非仓库 README）
rm src/frontend/README.md
```

### 步骤 6：替换 App.vue 为最小占位壳

`src/frontend/src/App.vue` 内容：

```vue
<template>
  <div>Datacenter Layout</div>
</template>
```

禁止：实现任何正式页面布局、导航或业务 UI。

### 步骤 7：清理 main.ts

`src/frontend/src/main.ts` 内容：

```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

删除 `import './style.css'` 行。

### 步骤 8：创建前端占位测试

创建文件 `src/frontend/src/__tests__/environment.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'

describe('scaffold environment', () => {
  it('verifies the Vitest runner is operational', () => {
    expect(1 + 1).toBe(2)
  })
})
```

禁止：使用 DOM、挂载 Vue 组件、引入 Vue Test Utils、jsdom 或 happy-dom。

### 步骤 9：创建解决方案文件

```powershell
cd <repo-root>
dotnet new sln --name Datacenter
```

解决方案文件 Datacenter.sln 生成在仓库根目录。

### 步骤 10：创建后端 Web API 项目

```powershell
cd <repo-root>
dotnet new webapi \
  --name Datacenter.Api \
  --output src/backend/Datacenter.Api \
  --framework net8.0 \
  --use-controllers \
  --no-openapi \
  --no-https \
  --no-restore
```

必须验证 `--no-https` 参数在当前 SDK 中存在；若不存在则省略该参数并接受模板默认 HTTPS 配置，但禁止引入 OpenAPI 包。

### 步骤 11：删除后端模板演示内容

```powershell
rm src/backend/Datacenter.Api/WeatherForecast.cs
rm src/backend/Datacenter.Api/Controllers/WeatherForecastController.cs
rm src/backend/Datacenter.Api/Datacenter.Api.http
```

### 步骤 12：修改 Program.cs

Program.cs 最终内容（删除模板生成的注释）：

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.Run();

public partial class Program { }
```

- 删除 `app.UseHttpsRedirection()` 和 `app.UseAuthorization()`（脚手架不包含认证；TASK-0007 会按需恢复）。
- `public partial class Program { }` 用于测试项目访问 Program 类型，不含业务逻辑。

### 步骤 13：创建后端测试项目

```powershell
cd <repo-root>
dotnet new xunit \
  --name Datacenter.Api.Tests \
  --output tests/backend/Datacenter.Api.Tests \
  --framework net8.0 \
  --no-restore
```

### 步骤 14：从测试项目移除 coverlet.collector

编辑 `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`，删除以下 PackageReference 块：

```xml
<PackageReference Include="coverlet.collector" Version="6.0.0">
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
  <PrivateAssets>all</PrivateAssets>
</PackageReference>
```

执行命令验证：

```powershell
grep -r "coverlet" tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
# 期望：退出码 1（无匹配）
```

### 步骤 15：添加测试项目对 Web API 项目的引用

```powershell
cd <repo-root>
dotnet add tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj reference src/backend/Datacenter.Api/Datacenter.Api.csproj
```

### 步骤 16：将项目加入解决方案

```powershell
cd <repo-root>
dotnet sln Datacenter.sln add src/backend/Datacenter.Api/Datacenter.Api.csproj
dotnet sln Datacenter.sln add tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

验证：

```powershell
dotnet sln Datacenter.sln list
# 期望输出恰好两行：
# src/backend/Datacenter.Api/Datacenter.Api.csproj
# tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

### 步骤 17：替换后端占位测试

删除模板测试文件：

```powershell
rm tests/backend/Datacenter.Api.Tests/UnitTest1.cs
```

创建 `tests/backend/Datacenter.Api.Tests/ScaffoldSmokeTest.cs`：

```csharp
namespace Datacenter.Api.Tests;

public class ScaffoldSmokeTest
{
    [Fact]
    public void TestProjectReferencesAndLoadsBackendAssembly()
    {
        // 验证测试项目可引用 Datacenter.Api 程序集中的类型
        var programType = typeof(Datacenter.Api.Program);
        Assert.NotNull(programType);
    }
}
```

禁止：测试业务逻辑、使用 WebApplicationFactory、引入额外测试包。

### 步骤 18：还原和构建验证

```powershell
cd <repo-root>
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore
```

`dotnet build` 必须退出码 0，输出中不含 `error` 或 `warning`。

### 步骤 19：运行测试

```powershell
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build
```

退出码 0，恰好 1 个测试通过。

### 步骤 20：创建统一验证脚本

创建 `scripts/verify-project.ps1`：

```powershell
$ErrorActionPreference = "Stop"
$repoRoot = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { $PWD }

Push-Location $repoRoot

try {
    Write-Host "=== Frontend: npm install ==="
    Push-Location src/frontend
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    Write-Host "=== Frontend: npm run typecheck ==="
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

    Write-Host "=== Frontend: npm run test ==="
    npm run test
    if ($LASTEXITCODE -ne 0) { throw "frontend test failed" }

    Write-Host "=== Frontend: npm run build ==="
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
    Pop-Location

    Write-Host "=== Backend: dotnet restore ==="
    dotnet restore Datacenter.sln
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

    Write-Host "=== Backend: dotnet build ==="
    dotnet build Datacenter.sln --no-restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed" }

    Write-Host "=== Backend: dotnet test ==="
    dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build
    if ($LASTEXITCODE -ne 0) { throw "dotnet test failed" }

    Write-Host "=== Workflow validation ==="
    pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
    if ($LASTEXITCODE -ne 0) { throw "workflow validation failed" }

    Write-Host "=== ALL CHECKS PASSED ==="
} finally {
    Pop-Location
}
```

### 步骤 21：更新 .gitignore

检查现有 `.gitignore`。如果缺少以下规则则追加：

```
# Scaffold build output
src/frontend/dist/
```

其他脚手架产物（node_modules、bin、obj、*.db 等）已在现有 .gitignore 中覆盖。确认 `package-lock.json` 不在 .gitignore 中。

### 步骤 22：更新 README.md

在现有 README.md 末尾追加以下内容（不删除已有内容）：

```markdown
## Development

### Prerequisites

- Node.js >= 18 (NVM)
- npm (with Node.js)
- .NET SDK 8.0
- WSL 2 Ubuntu 24.04 or compatible Linux

### Frontend

```powershell
cd src/frontend
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run typecheck    # Run TypeScript type checking
npm run test         # Run Vitest tests
npm run build        # TypeScript check + production build
```

### Backend

```powershell
dotnet restore Datacenter.sln                    # Restore NuGet packages
dotnet build Datacenter.sln --no-restore          # Build all projects
dotnet test tests/backend/Datacenter.Api.Tests/   # Run backend tests
dotnet run --project src/backend/Datacenter.Api/  # Start the API server
```

### Verify All

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1
```
```

禁止：写入部署、Docker、数据库或业务功能说明。

---

## 构建命令

```powershell
# 前端
cd src/frontend
npm install
npm run typecheck
npm run test
npm run build

# 后端
cd <repo-root>
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build

# 统一验证
pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1

# 工作流校验
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
```

## 构建结果

- 命令：待实施
- 退出码：待实施
- 摘要/证据：待实施

## 测试命令

```powershell
# 前端
cd src/frontend && npm run test

# 后端
cd <repo-root> && dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build

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
| 2026-07-17 | Claude + DeepSeek Product Manager | DRAFT | READY | — | 任务规格完成；工作流 20/20 PASS |
| 2026-07-17 | Claude + DeepSeek Product Manager | READY | IN_PROGRESS | — | 模块冲突检查通过；三项锁 CLAIMED（Owner: Claude） |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_PROGRESS | READY_FOR_REVIEW | Codex Reviewer | 任务规格交审（提交 005755b）；三项锁 HANDED_OFF |
| 2026-07-17 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | — | 规格审核 NEEDS_CHANGES（提交 6a1b4a9）；SC-001 至 SC-009 |
| 2026-07-17 | Claude + DeepSeek Product Manager | CHANGES_REQUESTED | IN_FIX | — | 取回三项锁 CLAIMED；开始修复全部 9 项 finding |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_FIX | READY | — | CR-0002 批准一次性状态纠正；任务返回实施前准备状态；Owner 改为 Cursor Developer；锁保持 CLAIMED 等待 Cursor Developer 重新认领 |

## 审核结论

- Reviewer：Codex Reviewer（对规格的审核已完成，见下方）
- 实施前规格审查结论：NEEDS_CHANGES（报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-SPEC-REVIEW.md，提交 6a1b4a9）
- 规格审查发现：BLOCKER 2 / MAJOR 6 / MINOR 1 = 9 项，已通过本次规格修正全部解决（详见 CR-0002 和本次提交）
- 实施后代码审核：待 Cursor Developer 完成脚手架后由 Codex Reviewer 执行

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
| SC-001 | BLOCKER | 规格审核报告第 14 节 | 状态纠正到 READY；CR-0002 批准 | CLOSED（CR-0002 批准一次性状态纠正；任务状态已改回 READY） |
| SC-002 | BLOCKER | 规格审核报告第 14 节 | 新增 Cursor Developer 角色；CR-0002 批准 | CLOSED（AGENTS.md 已新增 Cursor Developer；TASK-0006 Owner 已改） |
| SC-003 | MAJOR | 规格审核报告第 14 节 | 固定前端生成命令、版本、scripts 和 lockfile | CLOSED（实施命令步骤 2-8 已固定；npm 版本已查询锁定） |
| SC-004 | MAJOR | 规格审核报告第 14 节 | 精确 dotnet new 命令含 --use-controllers --no-openapi | CLOSED（实施命令步骤 9-16 已固定全部命令和参数） |
| SC-005 | MAJOR | 规格审核报告第 14 节 | 显式列出所有需删除的模板文件 | CLOSED（步骤 5、11 显式列出所有删除文件；AC-SC-11 禁止残留） |
| SC-006 | MAJOR | 规格审核报告第 14 节 | 移除 coverlet.collector | CLOSED（步骤 14 显式删除；AC-SC-13 验证不存在；依赖预算已排除） |
| SC-007 | MAJOR | 规格审核报告第 14 节 | 所有路径、名称、脚本固定为唯一值 | CLOSED（solution 根目录；项目名固定；恰好 1 个脚本；无"可选"） |
| SC-008 | MAJOR | 规格审核报告第 14 节 | 20 条 AC 全部重写为可执行格式 | CLOSED（AC-SC-01 至 AC-SC-20 全部含精确命令和期望输出） |
| SC-009 | MINOR | 规格审核报告第 14 节 | 追踪矩阵映射到正确 AC | CLOSED（需求追踪矩阵已更正 AC 映射） |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| SC-001 至 SC-009 | Claude + DeepSeek Product Manager | 见上方缺陷清单各行的修复说明 | 工作流 20/20 PASS；git diff --check PASS | 见本轮提交 |

## 复审结果

- 最终 Reviewer：N/A：本次为规格修正，非实现复审。实施完成后由 Codex Reviewer 对脚手架代码执行正式审核。
- 复审结论：N/A
- 关闭缺陷及证据：N/A

## 防过度开发检查

- 是否存在验收标准以外的实现：待实施后检查（规格已精确约束范围）
- 是否提前实现未来需求：待实施后检查（禁止 EF Core、认证、业务页面）
- 是否新增未批准依赖：待实施后检查（依赖预算已精确约束）
- 是否存在无实际需求的抽象：待实施后检查（禁止通用抽象）
- 是否存在无关重构：N/A（新建项目，无既有代码）
- 是否采用最简单可行方案：是（Vite 默认模板 + dotnet new webapi + xUnit 模板）
- Reviewer 结论：待 Cursor Developer 实施后由 Codex Reviewer 独立检查

## Change Request

- Change Request ID：CR-0002
- 发现者：Codex Reviewer（SC-001、SC-002）
- 原任务：TASK-0006
- 变更原因：工作流状态纠正 + Cursor Developer 角色新增
- 产品范围影响：无
- 技术影响：AGENTS.md 新增 Cursor Developer 角色；TASK-0006 状态纠正
- 文件影响：见 CR-0002 完整记录
- 测试影响：无
- 风险：低
- Claude 裁决：批准
- Architect 裁决：批准
- 更新后的 Requirement Source：不适用
- 批准状态：APPROVED

## Git 提交与推送

- 提交说明：待定（实施时由 Cursor Developer 填写）
- 提交哈希：待提交
- 推送结果：待推送
- 本地哈希：待提交
- 远端哈希：待推送

## 已知限制

- 脚手架不含路由（TASK-0008）、认证（TASK-0007）、数据访问（TASK-0007）或业务功能（TASK-0009+）。
- 前端 Vitest 仅验证运行环境正常（1 个纯数学断言），不含组件或 composable 测试（TASK-0008 补充）。
- 后端 xUnit 仅验证测试项目可引用和加载 Datacenter.Api 程序集，不含业务逻辑测试（TASK-0007+ 补充）。
- `public partial class Program { }` 仅用于测试程序集引用入口，不含业务逻辑。

## 最终完成条件

- [ ] 独立 Reviewer（Codex Reviewer）验收或复审通过
- [ ] 验收标准全部通过（AC-SC-01 至 AC-SC-20）
- [ ] 所有缺陷关闭
- [ ] 构建和测试通过（前端 npm typecheck + npm test + npm build；后端 dotnet build 0 errors 0 warnings + dotnet test）
- [ ] 工作流校验和 `git diff --check` 通过
- [ ] 模块锁已释放
- [ ] 已提交并推送
- [ ] 工作区干净
- [ ] 本地与远端哈希一致
- [ ] Reviewer 的防过度开发专项检查通过
- [ ] 状态由 Reviewer 转为 `COMPLETED`

---

## 附录 A：依赖预算

### A.1 环境版本基线（记录自 WSL 实际环境）

| 工具 | 版本 | 验证命令 |
|------|------|----------|
| Node.js | v24.18.0 | `node --version` |
| npm | 11.16.0 | `npm --version` |
| .NET SDK | 8.0.129 | `dotnet --version` |
| pwsh | WSL 内可用 | `pwsh --version` |

### A.2 前端直接依赖

生成器：`npm create vite@9.1.1`（create-vite 精确版本，查询自 `npm view create-vite version`）。

npm 注册表最新版本（查询日期 2026-07-17）：

| 包 | 注册表最新版本 | 查询命令 |
|---|--------------|---------|
| create-vite | 9.1.1 | `npm view create-vite version` |
| vite | 8.1.5 | `npm view vite version` |
| vue | 3.5.40 | `npm view vue version` |
| @vitejs/plugin-vue | 6.0.8 | `npm view @vitejs/plugin-vue version` |
| typescript | 7.0.2 | `npm view typescript version` |
| vitest | 4.1.10 | `npm view vitest version` |
| vue-tsc | 3.3.7 | `npm view vue-tsc version` |

模板生成的 package.json 使用 semver 范围；`npm install` 在范围内解析最新版本，由 package-lock.json 锁定精确版本。

#### 运行时依赖

| 依赖 | 类别 | 用途 | 删除影响 | 删除成本 |
|------|------|------|----------|----------|
| `vue` | runtime | Vue 3 前端框架 | 前端项目无法运行 | 替换框架（高） |

#### 开发依赖

| 依赖 | 类别 | 用途 | 删除影响 | 删除成本 |
|------|------|------|----------|----------|
| `vite` | dev | 构建工具和开发服务器 | 前端无法构建和开发 | 替换构建工具（中） |
| `@vitejs/plugin-vue` | dev | Vite 的 Vue 3 官方 SFC 编译插件 | .vue 文件无法被 Vite 处理 | 随 Vite 替换 |
| `typescript` | dev | TypeScript 编译器 | 类型检查无法执行 | 降级为 JavaScript（高） |
| `vitest` | dev | 前端测试框架 | AC-SC-07 测试无法运行 | 替换测试框架（中） |
| `vue-tsc` | dev | Vue + TypeScript 类型检查 CLI | AC-SC-06 typecheck 无法执行 | 替换检查工具（低） |
| `@types/node` | dev | Node.js 类型定义 | tsconfig.node.json 中 `"types": ["node"]` 编译失败；vite.config.ts 类型检查失败 | 低（模板必需） |
| `@vue/tsconfig` | dev | Vue 3 TypeScript 推荐配置基类 | tsconfig.app.json 中 `"extends": "@vue/tsconfig/tsconfig.dom.json"` 解析失败 | 低（模板必需） |

#### 明确不引入的前端依赖

- `vue-router`（TASK-0008 引入）
- `pinia`（MVP 不使用状态管理库）
- `axios`（MVP 使用浏览器 fetch API）
- `@vue/test-utils`（当前不测试 Vue 组件）
- `jsdom` / `happy-dom`（当前不测试 DOM）
- `playwright` / `cypress`（无浏览器测试）
- `eslint` / `prettier`（不在脚手架中引入 lint 工具）
- Element Plus / Ant Design Vue / Vuetify（无 UI 组件库）

### A.3 后端直接依赖

#### 运行时依赖

无。仅使用 ASP.NET Core 8 共享框架。`dotnet new webapi --use-controllers --no-openapi` 生成的 csproj 不含任何 PackageReference。

#### 测试依赖

| 依赖 | 类别 | 用途 | 删除影响 | 删除成本 |
|------|------|------|----------|----------|
| `xunit` | test | 测试框架 | AC-SC-16 测试无法运行 | 替换测试框架（中） |
| `Microsoft.NET.Test.Sdk` | test | .NET 测试运行基础设施 | `dotnet test` 无法发现和执行测试 | 随 xUnit 替换 |
| `xunit.runner.visualstudio` | test | Visual Studio / `dotnet test` 测试发现和运行集成 | `dotnet test` 输出格式降级 | 低 |

#### 明确不引入的后端依赖

- `coverlet.collector`（无覆盖率命令、报告、阈值或验收标准；模板默认生成但必须删除）
- `Microsoft.EntityFrameworkCore.Sqlite`（TASK-0007 引入）
- `Microsoft.EntityFrameworkCore.Design`（TASK-0007 引入）
- `Microsoft.Extensions.Identity.Core`（TASK-0007 引入）
- `Microsoft.AspNetCore.Mvc.Testing`（TASK-0007 引入）
- `Microsoft.AspNetCore.OpenApi`（已通过 --no-openapi 禁用）
- `Swashbuckle.AspNetCore`（已通过 --no-openapi 禁用）
- `FluentAssertions`（无需求）
- `Moq` / `NSubstitute`（无需求）
- `AutoMapper` / `Mapster`（MVP 不使用对象映射框架）
- `MediatR`（MVP 不使用中介器模式）
- `FluentValidation`（MVP 使用内置模型验证）
- `Serilog` / `NLog`（MVP 使用内置 ILogger）

### A.4 间接依赖

间接依赖（传递依赖）由 package-lock.json 和 obj/project.assets.json 锁定，无需逐项列入本预算。实施后 package.json 中不得出现预算外直接依赖。如生成器引入预算外直接依赖，Cursor Developer 必须停止并提交问题，不得自行保留。

---

## 附录 B：最终目录结构

实施完成后的仓库目录结构（仅列出新增和修改的文件/目录）：

```
datacenter-layout/
├── Datacenter.sln                           # 解决方案（新建）
├── src/
│   ├── frontend/                            # Vue 3 + Vite + TypeScript（新建）
│   │   ├── .gitignore                       # Vite 生成（保留）
│   │   ├── index.html                       # Vite 生成（保留，最小）
│   │   ├── package.json                     # Vite 生成 + vitest 添加 + scripts 编辑
│   │   ├── package-lock.json                # npm install 生成（必须提交）
│   │   ├── tsconfig.json                    # Vite 生成（保留）
│   │   ├── tsconfig.app.json                # Vite 生成（保留）
│   │   ├── tsconfig.node.json               # Vite 生成（保留）
│   │   ├── vite.config.ts                   # Vite 生成（保留）
│   │   ├── public/
│   │   │   └── favicon.svg                  # Vite 生成（保留，index.html 引用）
│   │   └── src/
│   │       ├── main.ts                      # 最小入口（已清理）
│   │       ├── App.vue                      # 最小占位壳（已替换）
│   │       └── __tests__/
│   │           └── environment.test.ts      # Vitest 占位测试（新建）
│   └── backend/
│       └── Datacenter.Api/                  # ASP.NET Core 8 Web API（新建）
│           ├── Datacenter.Api.csproj
│           ├── Program.cs                   # 最小启动（已清理）
│           ├── appsettings.json
│           ├── appsettings.Development.json
│           └── Properties/
│               └── launchSettings.json      # 模板生成（保留）
├── tests/
│   └── backend/
│       └── Datacenter.Api.Tests/            # xUnit 测试项目（新建）
│           ├── Datacenter.Api.Tests.csproj  # 已移除 coverlet.collector；已添加 ProjectReference
│           ├── ScaffoldSmokeTest.cs         # 占位测试（新建，替换 UnitTest1.cs）
│           └── GlobalUsings.cs              # xUnit 生成（保留）
├── scripts/
│   ├── validate-agent-workflow.ps1          # 已有（禁止覆盖）
│   └── verify-project.ps1                   # 统一验证脚本（新建）
└── README.md                                # 已更新（追加开发命令节）
```

不创建：
- `src/Common/`、`src/SharedKernel/`、`src/Infrastructure/`、`src/BuildingBlocks/`
- `src/backend/Models/`、`src/backend/Services/`、`src/backend/Controllers/`
- `src/backend/Data/`、`src/backend/Migrations/`
- `src/frontend/src/pages/`、`src/frontend/src/composables/`、`src/frontend/src/components/`
- `tests/frontend/`
- `docs/contracts/`

业务目录由后续任务按需创建。
