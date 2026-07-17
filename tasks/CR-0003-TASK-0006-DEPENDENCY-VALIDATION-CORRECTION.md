# Change Request CR-0003

## 基本信息

- Change Request ID：CR-0003
- 发现者：Codex Reviewer（TASK-0006 实现审核报告 IR-001、IR-002、IR-003）
- 原任务：TASK-0006（MVP 项目脚手架）
- 变更原因：
  1. AC-SC-18 的原 grep 命令扫描 `src/` 和 `tests/` 下所有 `*.json` 文件（含 `package-lock.json`），要求 forbidden package 字符串零命中（退出码 1）。但 Vitest 的 `package-lock.json` 条目中 `peerDependenciesMeta` 必然包含 `jsdom`、`happy-dom` 和 `@vue/test-utils` 的 optional peer metadata。这些字符串出现在 lockfile 中是因为上游包声明了可选的 peer dependency 元数据，不代表本项目声明、安装或引用了这些包。原命令在 exit 0 下命中这些字符串，AC-SC-18 无法按原文判 PASS。
  2. AC-SC-20 要求 `node_modules` 和 `dist` 目录在工作区中不存在（`test -d ...` 期望退出码 1），但 verify-project.ps1 的执行会创建这些目录，导致 Reviewer 无法在运行验证脚本后使 AC-SC-20 通过。
  3. verify-project.ps1 未覆盖依赖白名单校验、模板残留检查、被跟踪构建产物检查和 `git diff --check` 门禁，却报告 ALL CHECKS PASSED，可能隐藏 AC-SC-18/AC-SC-20 失败。
- 产品范围影响：无。不修改任何产品功能、用户角色、业务规则或验收标准。
- 技术影响：
  - AC-SC-18 验证方法从单一 grep 改为三层验证（直接依赖、顶层安装目录、项目代码引用）
  - AC-SC-20 验证方法改为检查 Git 跟踪而非文件系统不存在
  - verify-project.ps1 需补齐缺失门禁（不修改脚本本身，由 Cursor Developer 实施）
  - 依赖预算不变
  - 技术栈不变
- 文件影响：
  - tasks/TASK-0006-PROJECT-SCAFFOLD.md（AC-SC-18、AC-SC-20、verify-project.ps1 门禁要求的修改）
  - tasks/CR-0003-TASK-0006-DEPENDENCY-VALIDATION-CORRECTION.md（本文件，新建）
- 测试影响：AC-SC-18 和 AC-SC-20 的验证命令变更；验收标准语义不变。
- 风险：低。
  - AC-SC-18 的业务约束（禁止 jsdom、happy-dom、@vue/test-utils 作为直接依赖/实际安装/项目引用）全部保留，仅修正验证命令使其不与 lockfile 正常元数据冲突。
  - package-lock.json 继续提交，不通过篡改或删除 lockfile 规避命中。
  - AC-SC-20 改为检查 Git 未跟踪而非目录不存在，消除 Reviewer 运行验证脚本后的不确定状态。
- Claude 裁决：批准。
  - 原验收目的不变：禁止将 jsdom、happy-dom、@vue/test-utils 作为本项目直接依赖、实际安装或主动引用。
  - 仅修正验证方法的技术措辞。package-lock.json 中上游 optional peer metadata 是正常且不可避免的，不应导致验收失败。
  - 产品范围未变化。
- Architect 裁决：批准。
  - 不改变项目结构、技术栈、依赖预算或架构基线。
  - 验证方法修正是对门禁命令的技术澄清，不构成范围变更。
- 更新后的 Requirement Source：不适用（产品需求不变）。
- 批准状态：APPROVED

## AC-SC-18 验证方法修正

### 原问题

原 AC-SC-18 命令：
```bash
grep -ri "EntityFrameworkCore\|SQLite\|...\|jsdom\|happy-dom\|@vue/test-utils\|..." \
  src/ tests/ --include="*.csproj" --include="*.json"
```

此命令扫描 `src/frontend/package-lock.json`，其中 Vitest 的 `peerDependenciesMeta` 包含：
- `"happy-dom"`（optional peer）
- `"jsdom"`（optional peer）
- `"@vue/test-utils"`（optional peer）
- `"@vitest/browser-playwright"`（optional peer）

这些是上游包声明的可选 peer dependency 元数据，不代表本项目声明、安装或引用了这些包。原 grep 要求 `*.json` 零命中，与正常 lockfile 内容冲突。

### 修正方案

AC-SC-18 改为三层独立验证：

**A 层 — package.json 直接依赖检查。** 使用确定性 Node 脚本检查 `dependencies` 和 `devDependencies` 中不包含 `jsdom`、`happy-dom`、`@vue/test-utils`。失败（找到任一禁止包）时退出码非 0。

**B 层 — 顶层 node_modules 安装目录检查。** 在 `npm ci`（或等效确定性安装）完成后检查 `src/frontend/node_modules/jsdom`、`src/frontend/node_modules/happy-dom`、`src/frontend/node_modules/@vue/test-utils` 不存在。失败（任一目录存在）时退出码非 0。

**C 层 — 项目代码和配置引用检查。** 搜索本项目主动维护的文件（`src/frontend/src`、`src/frontend/package.json`、`src/frontend/vite.config.ts`、`src/frontend/tsconfig*.json`），确认无 `import`、`require` 或配置引用这些包。失败时退出码非 0。

**明确排除 package-lock.json：** package-lock.json 中由上游 optional peer metadata 产生的字符串匹配不构成失败条件。package-lock.json 不得作为 C 层的搜索目标。

### 不变约束

- `jsdom`、`happy-dom`、`@vue/test-utils` 不得出现在 package.json 的 `dependencies` 或 `devDependencies` 中。
- 这些包不得实际安装在 `node_modules` 顶层。
- 项目源代码、测试代码和配置文件不得主动引用这些包。
- package-lock.json 必须继续提交，不得通过删除 lockfile 规避命中。
- 不得手工篡改 package-lock.json 去除正常元数据。
- 不改变技术栈、依赖预算、项目结构或产品范围。

## AC-SC-20 验证方法修正

### 原问题

AC-SC-20 的 `test -d src/frontend/node_modules` 和 `test -d src/frontend/dist` 期望退出码 1（目录不存在），但 Reviewer 必须运行 verify-project.ps1（含 `npm install` 和 `npm run build`）来验证其他 AC，这些命令必然创建上述目录。无法在完整验证后通过该检查。

### 修正方案

AC-SC-20 改为检查 Git 未跟踪这些目录（而非文件系统不存在）：

- `git ls-files --error-unmatch src/frontend/node_modules/any-file` 期望退出码非 0（node_modules 内容未被 Git 跟踪）
- `git ls-files --error-unmatch src/frontend/dist/any-file` 期望退出码非 0（dist 内容未被 Git 跟踪）
- 等效检查：`git ls-files src/frontend/node_modules/ src/frontend/dist/` 期望无输出
- 保留原有检查：工作区干净、本地远端哈希一致、package-lock.json 已提交

## verify-project.ps1 门禁补齐

verify-project.ps1 当前只执行构建/测试/工作流校验。必须补齐以下门禁（由 Cursor Developer 在 IN_FIX 中实施；Claude 本轮不修改脚本）：

1. Node、npm、dotnet、pwsh 环境检查。
2. package-lock.json 存在。
3. 使用 `npm ci`（而非 `npm install`）进行确定性安装。
4. package.json 直接依赖与批准白名单完全一致。
5. AC-SC-18 三层验证（A/B/C）。
6. `npm run typecheck`。
7. `npm run test`（恰好 1 个测试通过）。
8. `npm run build`。
9. `dotnet restore`。
10. `dotnet build`（0 errors、0 warnings）。
11. `dotnet test`（恰好 1 个测试通过）。
12. 后端项目无未批准 PackageReference。
13. 测试项目 PackageReference 与批准预算一致。
14. coverlet.collector 不存在。
15. WeatherForecast、HelloWorld、Counter 和批准清单中的模板演示内容不存在。
16. launchSettings.json 不含 weatherforecast。
17. Git 未跟踪 node_modules、dist、bin、obj、TestResults。
18. `git diff --check`。
19. 调用 validate-agent-workflow.ps1 并要求 20/20 PASS。
20. 任一子命令或门禁失败时，脚本必须立即或最终以非零退出码结束，不得仍输出 ALL CHECKS PASSED。

## launchSettings.json 模板残留修复

在 TASK-0006 修复说明中要求 Cursor Developer：

- 删除 `src/backend/Datacenter.Api/Properties/launchSettings.json` 中 `"profiles"` → `"http"` → `"launchUrl": "weatherforecast"`（第 16 行）
- 删除 `"profiles"` → `"IIS Express"` → `"launchUrl": "weatherforecast"`（第 25 行）
- 不创建替代业务 endpoint
- 不增加 Swagger、OpenAPI 或健康检查 URL
- 保留 applicationUrl 和 environmentVariables
- 修复后使用大小写不敏感搜索确认零命中

## 裁决日期

2026-07-17
