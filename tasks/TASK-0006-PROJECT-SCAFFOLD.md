# TASK-0006：MVP 项目脚手架

## 基本信息

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY_FOR_RETEST
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：HANDED_OFF（9 项实施锁全部 HANDED_OFF；READY_FOR_RETEST 保持 HANDED_OFF；等待 Codex Reviewer 第五次复审 R4-001）

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

AC-SC-13 只检查测试项目的依赖声明文件（csproj），不扫描 bin、obj、DLL 或其他构建产物。

**A. 结构化 XML 检查（权威验收证据）：**

```bash
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET

path = Path(
    "tests/backend/Datacenter.Api.Tests/"
    "Datacenter.Api.Tests.csproj"
)

root = ET.parse(path).getroot()
ns = ""  # 无命名空间的 csproj

references = []
for element in root.iter():
    if element.tag.endswith("PackageReference"):
        for attr in ("Include", "Update"):
            val = element.attrib.get(attr, "")
            if val:
                references.append(val)

forbidden = [
    ref for ref in references
    if ref.lower() == "coverlet.collector"
]

print("PackageReferences:", ", ".join(references) if references else "(none)")

if forbidden:
    raise SystemExit(
        "Forbidden PackageReference found: coverlet.collector"
    )

print("coverlet.collector PackageReference: absent")
PY
```

期望：退出码 0，输出 `coverlet.collector PackageReference: absent`。

**B. 精确文件 grep（补充检查）：**

```bash
grep -ni "coverlet.collector" \
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

期望：无输出，退出码 1。

**废除的命令（不再使用）：**
- `grep -ri "coverlet" tests/`（扫描 bin/obj/DLL 导致二进制字符串误命中；退出码 0 不代表项目存在 coverlet.collector 引用）

**禁止：**
- 通过删除 bin/obj 目录规避验收
- 新增 coverlet.collector PackageReference

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
- 测试内容：恰好 1 个测试，验证测试项目可引用并加载 Datacenter.Api 程序集（使用 `typeof(global::Program)` 引用全局 Program 类型并断言其非 null），不测试业务逻辑。
- 禁止：存在 `UnitTest1.cs` 或任何其他测试文件。
- 为允许测试项目访问 Program，Datacenter.Api 的 Program.cs 最后必须包含 `public partial class Program { }`。

### AC-SC-17：统一验证脚本退出码 0

- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1`
- 期望：退出码 0。

verify-project.ps1 必须实现以下全部门禁，且任一失败时脚本必须以非零退出码结束，不得输出 ALL CHECKS PASSED：

1. **环境检查**：`node --version`、`npm --version`、`dotnet --version`、`pwsh --version` 全部执行成功。
2. **package-lock.json 存在**：`test -f src/frontend/package-lock.json` 退出码 0。
3. **确定性安装**：`cd src/frontend && npm ci` 退出码 0。
4. **直接依赖白名单**：Node 脚本检查 package.json 的 dependencies 和 devDependencies 与批准白名单完全一致（见 AC-SC-03）。
5. **AC-SC-18 A 层**：直接依赖检查（`jsdom`、`happy-dom`、`@vue/test-utils` 不在 package.json 直接依赖中）。
6. **AC-SC-18 B 层**：顶层 node_modules 目录检查（`jsdom`、`happy-dom`、`@vue/test-utils` 目录不存在）。
7. **AC-SC-18 C 层**：项目代码和配置引用检查（grep 无匹配）。
8. **后端 NuGet 依赖检查**：Web API 项目无未批准 PackageReference；测试项目 PackageReference 与批准预算一致（xunit、Microsoft.NET.Test.Sdk、xunit.runner.visualstudio）。
9. **coverlet.collector PackageReference 不存在**：执行 AC-SC-13 Part A 的结构化 XML 检查，解析 TASK-0006 批准的唯一测试项目 csproj（`tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`）中的 PackageReference 元素，检查 Include 和 Update 属性值（忽略大小写）。未发现 `coverlet.collector` 时 PASS（退出码 0）；发现时 FAIL（非零退出码）；csproj 缺失或 XML 解析失败时 FAIL。禁止递归扫描 tests/ 目录；不检查 bin/obj/DLL/PDB/TestResults/Markdown/日志/快照或任何非 csproj 文件。
10. **类型检查**：`cd src/frontend && npm run typecheck` 退出码 0。
11. **前端测试**：`cd src/frontend && npm run test` 退出码 0（恰好 1 个测试通过）。
12. **前端构建**：`cd src/frontend && npm run build` 退出码 0。
13. **后端还原**：`dotnet restore Datacenter.sln` 退出码 0。
14. **后端构建**：`dotnet build Datacenter.sln --no-restore` 退出码 0（0 errors、0 warnings）。
15. **后端测试**：`dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build` 退出码 0（恰好 1 个测试通过）。
16. **模板残留检查**：WeatherForecast 源文件不存在；HelloWorld、Counter、style.css、模板演示资源（hero.png、vite.svg、vue.svg、icons.svg）不存在。
17. **launchSettings.json 检查**：大小写不敏感搜索 `weatherforecast` 退出码 1。
18. **Git 跟踪检查**：`git ls-files src/frontend/node_modules/ src/frontend/dist/ src/backend/bin/ src/backend/obj/ tests/backend/bin/ tests/backend/obj/ TestResults/` 无输出。
19. **git diff --check**：退出码 0。
20. **工作流校验**：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` 退出码 0，`PASS=20, FAIL=0, TOTAL=20`。

- 脚本必须使用 WSL 中的 pwsh 执行。
- 脚本使用 `$PSScriptRoot` 定位仓库根目录。
- 命令使用 `npm ci`（确定性安装），不使用 `npm install`。

### AC-SC-18：无越界依赖

AC-SC-18 分三层独立验证。全部三层通过才判定 AC-SC-18 PASS。

**A 层 — package.json 直接依赖白名单检查**

命令：
```bash
cd src/frontend && node - <<'NODE'
const pkg = require('./package.json');
const direct = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const forbidden = ['jsdom', 'happy-dom', '@vue/test-utils'];
const found = forbidden.filter(name => Object.prototype.hasOwnProperty.call(direct, name));
if (found.length > 0) {
  console.error('Forbidden direct dependencies:', found.join(', '));
  process.exit(1);
}
console.log('Forbidden direct dependencies: none');
NODE
```

期望：退出码 0，输出 `Forbidden direct dependencies: none`。

**B 层 — 顶层 node_modules 安装目录检查**

前提：已完成确定性安装（`npm ci`）。

命令：
```bash
test ! -d src/frontend/node_modules/jsdom && \
test ! -d src/frontend/node_modules/happy-dom && \
test ! -d src/frontend/node_modules/@vue/test-utils
```

期望：退出码 0（三个目录均不存在）。

**C 层 — 项目代码和配置文件引用检查**

搜索范围仅限本项目主动维护的文件（不含 package-lock.json）：
```bash
grep -ri "jsdom\|happy-dom\|@vue/test-utils" \
  src/frontend/src/ \
  src/frontend/package.json \
  src/frontend/vite.config.ts \
  src/frontend/tsconfig*.json \
  2>/dev/null
```

期望：退出码 1（grep 无匹配，即项目代码和配置中无引用）。

**后端依赖检查**

命令：
```bash
grep -ri "EntityFrameworkCore\|SQLite\|Swashbuckle\|Microsoft.AspNetCore.OpenApi\|coverlet\|FluentAssertions\|Moq\|NSubstitute\|Microsoft.AspNetCore.Mvc.Testing" \
  src/backend/ tests/backend/ --include="*.csproj" 2>/dev/null
```

期望：退出码 1（grep 无匹配）。

**明确排除规则**

- package-lock.json 中由上游包 optional `peerDependenciesMeta` 产生的字符串匹配（如 Vitest 的 `jsdom`、`happy-dom`、`@vue/test-utils` optional peer metadata）**不构成失败条件**。
- package-lock.json 不得作为 A/B/C 任何一层的搜索目标。
- 禁止通过删除或篡改 package-lock.json 规避命中。
- 如 package.json 的 `dependencies` 或 `devDependencies` 中出现禁止包、顶层 `node_modules` 中实际安装、或项目代码/配置主动引用，任一出现都必须 FAIL。

**其他禁止依赖手动检查**

- package.json 中无 `vue-router`、`pinia`、`axios`、`eslint`、`prettier`、`playwright`、`cypress`。
- 所有 csproj 中无 EF Core、SQLite、OpenAPI、Swagger、coverlet、FluentAssertions、Moq、NSubstitute、Mvc.Testing。

### AC-SC-19：工作流校验 20/20 PASS，git diff --check PASS
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 期望：退出码 0，输出 `PASS=20, FAIL=0, TOTAL=20`。
- 命令：`git diff --check`
- 期望：退出码 0。

### AC-SC-20：提交后工作区干净，本地远端哈希一致，构建产物未被 Git 跟踪

- 命令：`git status --porcelain`
- 期望：无输出（工作区干净）。

- 命令：`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/chore/task-0006-project-scaffold)"`
- 期望：退出码 0（本地与远端哈希一致）。

- 命令：`git ls-files --error-unmatch src/frontend/package-lock.json`
- 期望：退出码 0（package-lock.json 已提交）。

- 命令：`git ls-files src/frontend/node_modules/ src/frontend/dist/ src/backend/bin/ src/backend/obj/ tests/backend/bin/ tests/backend/obj/`
- 期望：无输出（node_modules、dist、bin、obj 目录内容未被 Git 跟踪）。

- 说明：`node_modules` 和 `dist` 目录在 `npm ci`/`npm run build` 后会在文件系统中存在（正常构建产物），但不得被 Git 跟踪。AC-SC-20 检查的是 Git 跟踪状态而非文件系统存在性。`node_modules` 和 `dist` 的 .gitignore 排除由 AC-SC-18 验证序列中的检查覆盖。

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

### 步骤 11b：清理 launchSettings.json 模板残留

编辑 `src/backend/Datacenter.Api/Properties/launchSettings.json`：

1. 删除 `"profiles"` → `"http"` → `"launchUrl": "weatherforecast"`（第 16 行附近）。
2. 删除 `"profiles"` → `"IIS Express"` → `"launchUrl": "weatherforecast"`（第 25 行附近）。

修复后验证：

```powershell
grep -ri "weatherforecast" src/backend/Datacenter.Api/Properties/launchSettings.json
# 期望：退出码 1（无匹配）
```

禁止：
- 创建替代业务 endpoint。
- 增加 Swagger、OpenAPI 或健康检查 URL。
- 修改 `applicationUrl` 或 `environmentVariables`（保留模板默认值）。

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
        var programType = typeof(global::Program);
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

- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1`；`dotnet restore/build/test Datacenter.sln`
- 退出码：0
- 摘要/证据：环境 Node v24.18.0 / npm 11.16.0 / .NET 8.0.129 / pwsh 7.6.3。前端 typecheck/test(1 passed)/build 退出码 0。后端 restore 0；build 0 errors 0 warnings；test Passed 1。工作流 PASS=20 FAIL=0 TOTAL=20。`typeof(global::Program)` 修复后 CS0234 消除。

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

- 命令：前端 `npm run test`；后端 `dotnet test ... --no-build`；`verify-project.ps1`
- 退出码：全部 0
- 摘要/证据：前端 `Tests 1 passed (1)`；后端 `Passed: 1, Total: 1`；verify-project ALL CHECKS PASSED

## 开发完成证据

- 修改文件：Datacenter.sln；src/frontend/**；src/backend/Datacenter.Api/**；tests/backend/Datacenter.Api.Tests/**；scripts/verify-project.ps1；README.md；tasks/TASK-0006-PROJECT-SCAFFOLD.md；tasks/current-task.md；tasks/MODULE-LOCKS.md。.gitignore 未改。
- 验收证据：verify-project 0 / ALL CHECKS PASSED；AC-SC-17 按 RT-001 修复后重新验证；RT-001/RT-002 CLOSED（待 Reviewer 确认）
- 模块锁状态：HANDED_OFF（9 项，READY_FOR_RETEST）
- 已知限制：
  - RT-001 已修复：grep 三态；git ls-files 独立校验
  - RT-002 已修复：launchSettings.json 无 BOM；json.tool 0

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
| 2026-07-17 22:56:03 +08:00 | Cursor Developer | READY | IN_PROGRESS | — | 实现路径无活跃锁冲突；认领实施路径锁；开始按批准规格实施脚手架 |
| 2026-07-17 23:00:01 +08:00 | Cursor Developer | IN_PROGRESS | BLOCKED | Codex Architect / Claude | 规格内部冲突：步骤 12 与步骤 17 `typeof(Datacenter.Api.Program)`；CS0234；停止等待裁决 |
| 2026-07-17 | Claude + DeepSeek Product Manager | BLOCKED | IN_PROGRESS | Cursor Developer | 技术澄清：`typeof(global::Program)`；规格已更新；9 项锁保持 CLAIMED |
| 2026-07-17 | Cursor Developer | IN_PROGRESS | READY_FOR_REVIEW | Codex Reviewer | 脚手架实施完成；`global::Program` 修复验证通过；verify-project 0；前后端构建测试通过；工作流 20/20；git diff --check PASS；9 项锁 CLAIMED→HANDED_OFF；待独立审核实际脚手架 |
| 2026-07-17 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | — | 实现审核 NEEDS_CHANGES（提交 d6d8455）；IR-001（AC-SC-18 grep 命中 lockfile optional peer metadata）、IR-002（AC-SC-20 与验证序列冲突）、IR-003（verify-project.ps1 缺失门禁）、IR-004（launchSettings.json weatherforecast 残留）。MAJOR 3 / MINOR 1。修复后由同一 Reviewer 复审。 |
| 2026-07-18 00:11:24 +08:00 | Cursor Developer | CHANGES_REQUESTED | IN_FIX | — | CR-0003 已批准；重新认领 scripts/verify-project.ps1、src/backend/Datacenter.Api、tasks/TASK-0006-PROJECT-SCAFFOLD.md、tasks/current-task.md、tasks/MODULE-LOCKS.md 为 CLAIMED；其余锁保持 HANDED_OFF；开始修复 IR-001 至 IR-004 |
| 2026-07-18 00:13:00 +08:00 | Cursor Developer | IN_FIX | READY_FOR_RETEST | Codex Reviewer | IR-001..004 已修复并 CLOSED；verify-project 0 / ALL CHECKS PASSED；工作流 20/20；git diff --check PASS；weatherforecast 零命中；Git 未跟踪构建产物；5 项 CLAIMED 锁改回 HANDED_OFF；待同一 Reviewer 复审 |
| 2026-07-18 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | — | 复审 NEEDS_CHANGES（提交 1124339；报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST.md）。AC-SC-17 FAIL（RT-001：grep/Git 管道错误处理不严格；grep exit 2 被当成"无匹配"；Git 失败可被掩盖）。RT-002：launchSettings.json UTF-8 BOM 导致 python3 json.tool 失败。IR-001 CLOSED、IR-002 CLOSED、IR-003/RT-001 OPEN、IR-004/RT-002 OPEN。19 AC PASS / 1 FAIL。修复后由同一 Reviewer 复审。 |
| 2026-07-18 00:39:48 +08:00 | Cursor Developer | CHANGES_REQUESTED | IN_FIX | — | 重新认领 scripts/verify-project.ps1、src/backend/Datacenter.Api、tasks/TASK-0006-PROJECT-SCAFFOLD.md、tasks/current-task.md、tasks/MODULE-LOCKS.md 为 CLAIMED；开始修复 RT-001/RT-002 |
| 2026-07-18 00:41:30 +08:00 | Cursor Developer | IN_FIX | READY_FOR_RETEST | Codex Reviewer | RT-001/RT-002 已 CLOSED；Assert-GrepNoMatch 三态；git ls-files 独立校验；launchSettings 无 BOM；json.tool 0；verify 0；工作流 20/20；5 项锁改回 HANDED_OFF；待同一 Reviewer 复审 |
| 2026-07-18 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | — | 第三次复审 NEEDS_CHANGES（提交 2edbc2e；报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-2.md）。AC-SC-13 FAIL（RT-003：递归 grep 扫描 bin/obj/DLL 命中二进制 coverlet 字符串）。IR-001/IR-002/IR-003/RT-001/IR-004/RT-002 全部 CLOSED。verify-project.ps1 实现已正确（--exclude-dir=bin --exclude-dir=obj）。仅规格 AC 命令需修正。修复后由同一 Reviewer 复审。 |
| 2026-07-18 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | — | 第四次复审 NEEDS_CHANGES（提交 b3a4ea4；报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-3.md）。RV-001（AC-SC-17 第 9 项仍保留已废除的递归 grep）+ RV-002（缺少 CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST 状态迁移）。0 BLOCKER / 2 MAJOR / 0 MINOR。修复后由同一 Reviewer 复审。 |
| 2026-07-18 | Cursor Developer | CHANGES_REQUESTED | IN_FIX | — | 重新认领 tasks/TASK-0006-PROJECT-SCAFFOLD.md、tasks/current-task.md、tasks/MODULE-LOCKS.md 为 CLAIMED；仅修复 RV-001（AC-SC-17 第 9 项）+ RV-002（状态迁移与交接记录）；不修改代码/测试/依赖/基线 |
| 2026-07-18 | Cursor Developer | IN_FIX | READY_FOR_RETEST | Codex Reviewer | RV-001 已修复（AC-SC-17 gate 9 引用 AC-SC-13 方法，明确 --exclude-dir=bin --exclude-dir=obj）；RV-002 已修复（CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST 迁移已记录）；Coverlet 验证 PASS；工作流 20/20；3 项锁改回 HANDED_OFF；待同一 Reviewer 第四次复审 |
| 2026-07-18 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | — | 第四次复审（终审）NEEDS_CHANGES（提交 497df48；报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-4.md）。R4-001/MAJOR（AC-SC-17 gate 9 仍递归扫描 tests/，与 AC-SC-13 的 PackageReference-only 目标不一致）。RV-002 CLOSED。0 BLOCKER / 1 MAJOR / 0 MINOR。修复后由同一 Reviewer 复审。 |
| 2026-07-18 | Cursor Developer | CHANGES_REQUESTED | IN_FIX | — | 重新认领 tasks/TASK-0006-PROJECT-SCAFFOLD.md、tasks/current-task.md、tasks/MODULE-LOCKS.md、scripts/verify-project.ps1 为 CLAIMED；仅修复 R4-001（AC-SC-17 gate 9 + verify-project.ps1 gate 9 改为 AC-SC-13 结构化 XML）；不修改代码/测试/依赖/基线 |
| 2026-07-18 | Cursor Developer | IN_FIX | READY_FOR_RETEST | Codex Reviewer | R4-001 已修复：AC-SC-17 gate 9 和 verify-project.ps1 gate 9 均改为 AC-SC-13 结构化 XML（Python ElementTree 解析唯一 csproj 的 Include/Update）；AC-SC-13 Part A 同步扩展 Update 属性检查；递归 tests/ grep 已完全废除；无害文本/负向夹具验证通过；工作流 20/20；4 项锁改回 HANDED_OFF；待同一 Reviewer 第五次复审 |

## 审核结论

- 实施前规格审查结论：NEEDS_CHANGES（报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-SPEC-REVIEW.md，提交 6a1b4a9；SC-001 至 SC-009，全部 CLOSED）
- 第一次实现审核结论：NEEDS_CHANGES（报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-REVIEW.md，提交 d6d8455；IR-001 至 IR-004）
- 第二次复审结论：NEEDS_CHANGES（报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST.md，提交 1124339；RT-001/RT-002）
- 第三次复审结论：NEEDS_CHANGES（报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-2.md，提交 2edbc2e；RT-003）
- 第四次复审结论：NEEDS_CHANGES（报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-3.md，提交 b3a4ea4；RV-001/RV-002）
- 第五次复审结论：NEEDS_CHANGES（报告：TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-4.md，提交 497df48；R4-001）
- 第五次复审结果：0 BLOCKER / 1 MAJOR / 0 MINOR（R4-001）
- 已确认关闭：IR-001/IR-002/IR-003/RT-001/IR-004/RT-002 CLOSED、RT-003 SPEC_CLARIFIED、RV-002 CLOSED
- 本次修复：R4-001（AC-SC-17 gate 9 + verify-project.ps1 gate 9 改为 AC-SC-13 结构化 XML；Include+Update 属性检查；递归 tests/ grep 已完全废除）
- 当前任务状态：READY_FOR_RETEST，待 Codex Reviewer 执行第五次（终审）复审

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
| IR-001 | MAJOR | 实现审核报告 §6、§14；`package-lock.json:1537-1579` | AC-SC-18 改为三层验证；CR-0003 批准 | CLOSED（复审确认：A/B/C 三层全部 PASS；不扫描 package-lock.json） |
| IR-002 | MAJOR | 实现审核报告 §12、§14；`TASK-0006` AC-SC-20 | AC-SC-20 改为 Git 跟踪检查；CR-0003 批准 | CLOSED（复审确认：git ls-files 无输出；允许本地存在 node_modules/dist） |
| IR-003 | MAJOR | 实现审核报告 §10、§14；复审报告 RT-001；`scripts/verify-project.ps1` | 补齐 20 项门禁；grep 必须区分退出码 1（无匹配）与 2+（执行错误）；Git 管道必须独立验证 git ls-files 成功 | CLOSED（Assert-GrepNoMatch 三态；git ls-files 独立校验；verify 0；负向缺失目标 exit 2 → FAIL） |
| IR-004 | MINOR | 实现审核报告 §4、§14；复审报告 RT-002；`launchSettings.json:1` | 删除两处 weatherforecast；保存为 UTF-8 without BOM | CLOSED（无 weatherforecast；无 BOM；`python3 -m json.tool` 退出码 0） |
| RT-001 | MAJOR | 复审报告 §7、§14；`scripts/verify-project.ps1` | 同 IR-003 | CLOSED（第三次复审确认。Assert-GrepNoMatch 三态；git ls-files 独立校验；verify 0） |
| RT-002 | MINOR | 复审报告 §8、§14；`launchSettings.json:1` | 同 IR-004 | CLOSED（第三次复审确认。无 weatherforecast；无 BOM；json.tool 0） |
| RT-003 | MAJOR | 第三次复审报告 §11；`TASK-0006` AC-SC-13；`tests/.../bin/.../*.dll` | AC-SC-13 改为结构化 XML 检查 + 精确 csproj grep；CR-0004 批准 | SPEC_CLARIFIED（AC-SC-13 已重写为 XML PackageReference 检查；verify-project.ps1 已正确使用 --exclude-dir；实现无需修改） |
| RV-001 | MAJOR | 第四次复审报告 §7；`TASK-0006` AC-SC-17 gate 9 | AC-SC-17 gate 9 改为引用 AC-SC-13 验证原则，使用 --exclude-dir=bin --exclude-dir=obj，明确退出码语义 | CLOSED（第五次复审确认：--exclude-dir 修复不充分；范围仍过宽；由 R4-001 取代） |
| RV-002 | MAJOR | 第四次复审报告 §7；`tasks/current-task.md`、`tasks/TASK-0006-PROJECT-SCAFFOLD.md` | 记录 CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST 状态迁移与锁交接 | CLOSED（第五次复审确认） |
| R4-001 | MAJOR | 第五次复审报告 §6；`TASK-0006` AC-SC-17 gate 9 + `scripts/verify-project.ps1:158-162` | AC-SC-17 gate 9 和 verify-project.ps1 gate 9 改为 AC-SC-13 结构化 XML 检查（Python ElementTree 解析 csproj Include/Update）；完全废除 tests/ 递归 grep | CLOSED（AC-SC-13/AC-SC-17/verify-project.ps1 三者统一为结构化 XML；递归扫描已完全移除；无害文本/负向夹具验证通过） |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| SC-001 至 SC-009 | Claude + DeepSeek Product Manager | 见上方缺陷清单各行的修复说明 | 工作流 20/20 PASS；git diff --check PASS | 见规格修正提交 |
| IR-001 | Cursor Developer | verify-project.ps1 实现 AC-SC-18 A/B/C 三层验证 | 复审确认 CLOSED。A/B/C 全部 PASS | 提交 1bfcc54 |
| IR-002 | Cursor Developer | verify-project.ps1 按 git ls-files 检查构建产物跟踪状态 | 复审确认 CLOSED。git ls-files 无输出 | 提交 1bfcc54 |
| IR-003/RT-001 | Cursor Developer | Assert-GrepNoMatch：exit 0 FAIL / 1 PASS / ≥2 FAIL；git ls-files 独立校验后再过滤 | 第三次复审确认 CLOSED | 提交 74ba6de |
| IR-004/RT-002 | Cursor Developer | launchSettings.json 去除 UTF-8 BOM | 第三次复审确认 CLOSED | 提交 74ba6de |
| RT-003 | Claude + DeepSeek（规格修正） | AC-SC-13 改为结构化 XML + 精确 grep；CR-0004 批准 | XML 检查 exit 0；verify-project.ps1 已正确使用 --exclude-dir | 提交 33bb53a |
| RV-001 | Cursor Developer | AC-SC-17 gate 9 引用 AC-SC-13 验证原则；使用 --exclude-dir=bin --exclude-dir=obj；废除旧递归 grep | 第五次复审确认修复不充分（仍递归扫描）；由 R4-001 取代 | 提交 bde16ca |
| RV-002 | Cursor Developer | 记录 CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST；同步状态/锁/交接记录 | 第五次复审确认 CLOSED | 提交 bde16ca |
| R4-001 | Cursor Developer | AC-SC-17 gate 9 + verify-project.ps1 gate 9 改为 AC-SC-13 结构化 XML（Python ElementTree 解析 Include+Update）；AC-SC-13 Part A 同步扩展 Update 检查；完全废除递归 tests/ grep | XML exit 0（真实 csproj PASS）；无害文本 fixture exit 0（无误报）；负向 csproj fixture exit 1（正确检测）；工作流 20/20 | 待本轮提交 |

## 实现审核（IR-001 至 IR-004）及复审（RT-001、RT-002）修复矩阵

| Finding | 等级 | 规格修正位置 | Cursor 实现修复位置 | 复验命令 | 闭环条件 |
|---------|------|-------------|-------------------|---------|---------|
| IR-001 | MAJOR | AC-SC-18（A/B/C 三层验证）；CR-0003 | `verify-project.ps1` A/B/C 层 | A/B/C 全部 PASS | **CLOSED**（复审确认） |
| IR-002 | MAJOR | AC-SC-20（`git ls-files` 替换 `test -d`）；CR-0003 | verify-project.ps1 Git 跟踪检查 | git ls-files 无输出 | **CLOSED**（复审确认） |
| IR-003/RT-001 | MAJOR | AC-SC-17（20 项门禁清单 + 严格错误处理） | `scripts/verify-project.ps1` grep gate：`$LASTEXITCODE -eq 1` 而非 `-ne 0`；git ls-files 独立检查后再 grep | grep 对不存在的目标返回 exit 2 时脚本非零退出；git 管道在 git 失败时非零退出 | AC-SC-17 PASS（verify-project.ps1 0 且所有内置负测试通过） |
| IR-004/RT-002 | MINOR | 步骤 11b（launchSettings.json 清理 + BOM 去除） | `launchSettings.json` 保存为 UTF-8 without BOM | `python3 -m json.tool launchSettings.json >/dev/null` 退出码 0 | JSON 语法校验通过 |

## 复审结果

- 最终 Reviewer：Codex Reviewer（待第五次复审）
- 第五次复审结论（RETEST-4）：NEEDS_CHANGES（R4-001/MAJOR；RV-002 CLOSED）
- RT-003（MAJOR）：SPEC_CLARIFIED — AC-SC-13 改为结构化 XML + 精确 grep
- RV-002（MAJOR）：CLOSED（第五次复审确认）— 状态迁移记录完整
- R4-001（MAJOR）：已修复 — AC-SC-17 gate 9 + verify-project.ps1 gate 9 改为 AC-SC-13 结构化 XML（Python ElementTree 解析 Include+Update）；递归 tests/ grep 已完全废除；无害文本/负向夹具验证通过
- 下一步：Codex Reviewer 执行第五次（终审）READY_FOR_RETEST 复审

## 防过度开发检查

- 是否存在验收标准以外的实现：否（仅修复验证门禁与 launchSettings 残留）
- 是否提前实现未来需求：否
- 是否新增未批准依赖：否
- 是否存在无实际需求的抽象：否
- 是否存在无关重构：否（仅重构批准的 verify-project.ps1）
- 是否采用最简单可行方案：是
- Reviewer 结论：待 Codex Reviewer 复审确认

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

- 提交说明：fix: address task-0006 implementation review findings
- 提交哈希：待本轮提交后由 push 结果确认
- 推送结果：待推送
- 本地哈希：待提交
- 远端哈希：待推送

## 已知限制

- 脚手架不含路由（TASK-0008）、认证（TASK-0007）、数据访问（TASK-0007）或业务功能（TASK-0009+）。
- 前端 Vitest 仅验证运行环境正常（1 个纯数学断言），不含组件或 composable 测试（TASK-0008 补充）。
- 后端 xUnit 仅验证测试项目可引用和加载 Datacenter.Api 程序集（`typeof(global::Program)`），不含业务逻辑测试（TASK-0007+ 补充）。
- `public partial class Program { }` 仅用于测试程序集引用入口，不含业务逻辑。
- AC-SC-18 全量 `*.json` grep 会命中 `package-lock.json` 中 vitest 的 optional peerDependencies 元数据（jsdom/happy-dom/@vitest/browser-playwright）；这些包未安装，也不在 package.json 直接依赖或任何 csproj 中。手动检查（package.json / csproj）通过。

## 最终完成条件

- [ ] 独立 Reviewer（Codex Reviewer）验收或复审通过
- [x] 验收标准全部通过（AC-SC-01 至 AC-SC-20；AC-SC-20 在提交推送后由 Reviewer 复核本地/远端一致）
- [x] 所有缺陷关闭（规格缺陷 SC-001..009 已 CLOSED；实现无开放缺陷）
- [x] 构建和测试通过（前端 npm typecheck + npm test + npm build；后端 dotnet build 0 errors 0 warnings + dotnet test）
- [x] 工作流校验和 `git diff --check` 通过
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
