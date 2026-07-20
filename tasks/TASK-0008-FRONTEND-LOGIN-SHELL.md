# TASK-0008：前端基础与登录壳

## 基本信息

- Task ID：TASK-0008
- Task Name：前端基础与登录壳
- Status：DRAFT
- Owner：Codex Architect（当前仅负责规格）
- Implementation Owner：Cursor Frontend（仅在规格审核通过并进入 READY 后认领）
- Reviewer：Codex Reviewer
- Branch：feature/task-0008-frontend-login-shell
- Requirement Source：`docs/product/MVP-PRODUCT-BASELINE.md` NFR-007、AC-037；`docs/architecture/MVP-ARCHITECTURE-BASELINE.md` TASK-0008
- Architecture Reference：`docs/architecture/MVP-ARCHITECTURE-BASELINE.md`
- Dependency：TASK-0007（COMPLETED；认证 API 4/4 已实现；实施锁全部 RELEASED）

## 任务目标与用户价值

建立 Vue Router、登录页、内存登录态、最小 HTTP 封装、认证路由守卫和最小受保护首页壳，使用户能够使用 TASK-0007 的 Cookie Authentication 与 Antiforgery 契约登录、恢复身份及登出，并使匿名用户无法进入受保护页面。

用户由此获得明确的登录入口、刷新后可恢复的会话体验、认证失败反馈，以及受保护页面的最小访问边界；本任务不交付任何机房业务能力。

## 当前前后端基线

- 前端：Vue `^3.5.39`、TypeScript `~6.0.2`、Vite `^8.1.1`、Vitest `^4.1.10`；当前只有 `App.vue`、`main.ts` 和 Node 环境测试，无 Vue Router、Pinia、Axios、DOM 仿真或组件挂载库。
- 后端：TASK-0007 已 COMPLETED，后端回归基线为 28/28 PASS，提供以下四个端点：
  - `GET /api/auth/csrf`：匿名/已认证可调用；响应 Header `X-XSRF-TOKEN` 返回请求令牌并由 ASP.NET Core 设置 Antiforgery Cookie。
  - `POST /api/auth/login`：JSON `{"username":"...","password":"..."}`；要求 `X-XSRF-TOKEN`；200 返回 `{id, username, role}`，失败为统一 JSON 错误。
  - `POST /api/auth/logout`：要求认证及与当前身份关联的 `X-XSRF-TOKEN`；成功 204。
  - `GET /api/auth/me`：要求认证；200 返回 `{id, username, role}`，匿名为 401。
- 认证 Cookie 名称为 `Datacenter.Auth`，HttpOnly、SameSite=Lax、非持久、固定 8 小时且无滑动续期；Cookie 和 Antiforgery Cookie 均由浏览器管理，前端不得读取或保存。
- 统一错误响应为 `{"error":"人类可读的失败原因"}`；认证失败响应为 401。

## 开发环境同源联调路径

- 前端 API 路径始终使用相对 `/api`，不得硬编码后端或生产服务器地址。开发联调仅在现有 `src/frontend/vite.config.ts` 中配置 `/api` proxy，将请求转发到本地 .NET 后端；浏览器始终访问 Vite 前端地址并以同源 `/api/auth/*` 发起请求。
- proxy 默认目标采用当前后端 `src/backend/Datacenter.Api/Properties/launchSettings.json` 的 HTTP profile：`http://localhost:5142`。允许在现有配置中使用 Vite 内置 `loadEnv` 读取仅用于开发代理的 `VITE_API_PROXY_TARGET` 覆盖该目标；未配置时使用上述默认值。不得为此增加环境配置框架、依赖或新的配置文件。
- proxy 仅属于开发联调，不定义或改变生产部署方式，不修改后端代码，也不增加 CORS。该路径不改变 TASK-0007 的 Cookie Authentication 与 Antiforgery 契约：Cookie 和 Antiforgery Cookie 仍由浏览器管理，前端不读取、保存或复制 Cookie。
- 所有 fetch 请求使用 `credentials: "include"`；认证信息、Cookie 和 CSRF Token 不得写入 `localStorage` 或 `sessionStorage`。不得以跨域 URL、新增 CORS、Axios、后端静态托管或测试专用生产端点绕过同源路径。

实现完成后的联调顺序（仅 U15-A、U15-B 执行，本轮不得启动）：

1. 在仓库根目录启动本地 .NET 后端：`dotnet run --project src/backend/Datacenter.Api/Datacenter.Api.csproj --launch-profile http`。
2. 在 `src/frontend/` 启动 Vite 开发服务：`npm run dev`。
3. 浏览器访问 Vite 输出的前端地址（默认 `http://localhost:5173`）。
4. 前端只通过相对 `/api/auth/*` 经 Vite proxy 调用后端。
5. 按 U15-A、U15-B 验证 csrf、login、me、logout 的最小完整流程并记录结果。

## 严格实施范围

1. Vue Router 基础配置并接入应用入口。
2. `/login` 登录页。
3. `/` 最小受保护页面壳。
4. 最小 `useApi` 和内存态 `useAuth`。
5. 匿名/已登录路由守卫和刷新时身份恢复。
6. 对接 TASK-0007 四个认证 API，复用 Cookie Authentication 与 Antiforgery。
7. 仅覆盖本规格行为所必需的前端测试。

## 明确不实现范围

不实现 Room/机房、Cabinet/机柜、Server/服务器、服务器落位、业务数据模型、业务 API、用户或角色管理页、注册、找回/修改密码、MFA、JWT、Refresh Token、Pinia、Axios、UI/CSS/表单/验证框架、国际化、主题、权限矩阵、动态菜单、通用状态管理、Repository、SDK、缓存、自动重试框架、全局消息总线及 TASK-0009 内容；不为未来业务预留抽象层，不修改后端、数据库、Migration 或 TASK-0007。

## 页面和路由范围

| 路径 | 页面 | 最小内容 | 访问规则 |
|---|---|---|---|
| `/login` | `LoginView.vue` | 用户名、密码、登录按钮、错误信息区域 | 匿名可访问；已登录跳转 `/` |
| `/` | `HomeView.vue` | 当前登录用户名、角色、登出按钮 | 仅已登录可访问；匿名跳转 `/login` |

不得增加其他页面或业务路由。`App.vue` 只承载 `RouterView`。不持久化密码或登录状态；Cookie 由浏览器管理。守卫必须等待一次共享初始化完成再判断，避免重复 `/me`、无限重定向或登录页与首页互跳。

## `useApi` 最小职责

- 仅接收相对 `/api` 路径，拒绝或不支持任意外部 URL。
- 使用原生 `fetch`，默认 `credentials: "include"`；浏览器经 Vite proxy 仍以同源方式管理 Cookie。
- 处理 JSON 请求/响应和 204 空响应。
- 从非成功 JSON 响应提取统一 `{"error":"..."}`；无有效统一错误时提供不泄露敏感信息的通用错误。
- 对需要 Antiforgery 的认证 POST 添加真实 Header 名 `X-XSRF-TOKEN`。
- 对 401 通过显式返回/回调通知 `useAuth`；不得在 `useApi` 内进行路由跳转。
- 不自动无限重试、不缓存、不定义业务 DTO、不形成通用 SDK，不记录密码、Cookie 或 Token。

## `useAuth` 最小职责

- 以模块内 Vue `ref` 保存当前用户 `{id, username, role} | null` 和初始化加载状态；不引入状态管理框架。
- `restore()`：仅调用 `/api/auth/me` 恢复身份；401 清空内存状态；并以共享初始化 Promise 保证同一初始化周期只执行一次。
- `login(username, password)`：先取匿名 CSRF，调用登录，成功后再次获取已认证 CSRF，再调用 `/me` 设置当前用户；不得保存密码。
- `logout()`：登出前重新调用 `/csrf` 获取当前身份令牌，再调用 `/logout`；成功后清空内存用户。
- 接收 `useApi` 的 401 通知并清除内存认证状态。
- CSRF 请求令牌仅允许保存在模块内内存，身份切换时替换/清除；不得写入持久存储。
- 不保存密码、密码哈希、Cookie；不实现权限矩阵、动态角色或 Token 刷新。

## 认证流程

### 登录

1. 用户提交用户名和密码；页面进入提交中状态，避免重复提交。
2. `GET /api/auth/csrf` 获取匿名令牌，读取响应 Header `X-XSRF-TOKEN`。
3. 携带该 Header 调用 `POST /api/auth/login`。
4. 200 后立即再次 `GET /api/auth/csrf`，用已认证身份替换匿名令牌。
5. 调用 `GET /api/auth/me` 建立唯一可信的前端当前用户状态，然后导航 `/`。
6. 任一步失败均停止流程；展示安全、可读错误，密码只保留在表单完成当前交互所需的短暂内存中，不进入日志或持久存储。

### 登出

1. 已认证用户点击登出。
2. 重新 `GET /api/auth/csrf` 获取当前身份对应令牌。
3. 携带 `X-XSRF-TOKEN` 调用 `POST /api/auth/logout`。
4. 收到 204 后清空用户与 CSRF 内存态并导航 `/login`；401 同样清空内存认证状态并回到 `/login`；其他错误显示且不伪造成功。

### 登录态恢复

应用或首次守卫判断时调用一次共享 `restore()`。`/me` 200 设置用户，401 视为正常匿名状态并清空用户，其他错误不伪装为已登录且提供可观察错误。前端不读取认证 Cookie，也不使用 localStorage/sessionStorage。

## 路由守卫规则

- 标记 `/` 为受保护路由；初始化未完成时先等待 `restore()`。
- 匿名访问 `/`：单向跳转 `/login`。
- 已登录访问 `/login`：单向跳转 `/`。
- 目标已符合当前认证态时直接放行；守卫不得触发自跳转或无限循环。
- 任意 API 401 清除内存用户；后续受保护导航由守卫导向 `/login`。
- 本任务只判断“已登录/匿名”，不实现角色路由矩阵。

## Antiforgery 生命周期

唯一顺序为：匿名 `/csrf` → 使用匿名令牌 `/login` → 登录成功后重新 `/csrf` → 使用认证后新令牌执行 `/logout`。GET/HEAD 不添加令牌；登录前旧令牌不得用于登录后的状态变更。Header 固定为 `X-XSRF-TOKEN`；前端不猜测、不读取 Antiforgery Cookie 名称，Cookie 由浏览器自动管理。令牌不写入 localStorage、sessionStorage、日志或错误消息。

## 错误展示要求

- 登录页固定提供可访问的错误信息区域，展示后端统一 `error` 或安全通用消息。
- 登录失败不区分用户不存在、密码错误或账号禁用；直接展示后端统一消息。
- 网络错误、无效 JSON、缺失 CSRF Header 和非预期状态必须成为可观察失败，不得静默成功或显示敏感响应内容。
- 提交中禁用登录/登出按钮；新请求开始时清理旧错误。
- 不展示或记录密码、Cookie、CSRF Token、响应 Header 全量或堆栈。

## 精确文件预算

预算总计 13 个文件：新增 8，修改 5。仅以下完整路径可由实施单元修改；任何增加或替换均需 Change Request。

| 操作 | 完整路径 | 对应 AC |
|---|---|---|
| 新增 | `src/frontend/src/router.ts` | AC-01、AC-08 |
| 新增 | `src/frontend/src/views/LoginView.vue` | AC-02、AC-06 |
| 新增 | `src/frontend/src/views/HomeView.vue` | AC-03、AC-07 |
| 新增 | `src/frontend/src/composables/useApi.ts` | AC-04、AC-10 |
| 新增 | `src/frontend/src/composables/useAuth.ts` | AC-05、AC-06、AC-07、AC-09、AC-10 |
| 新增 | `src/frontend/src/__tests__/useApi.test.ts` | AC-04、AC-10 |
| 新增 | `src/frontend/src/__tests__/useAuth.test.ts` | AC-05、AC-06、AC-07、AC-09、AC-10 |
| 新增 | `src/frontend/src/__tests__/router-and-views.test.ts` | AC-01、AC-02、AC-03、AC-08 |
| 修改 | `src/frontend/src/main.ts` | AC-01 |
| 修改 | `src/frontend/src/App.vue` | AC-01 |
| 修改 | `src/frontend/vite.config.ts` | AC-04、AC-11 |
| 修改 | `src/frontend/package.json` | AC-11 |
| 修改 | `src/frontend/package-lock.json` | AC-11 |

`src/frontend/vite.config.ts` 的唯一修改职责是使用 Vite 内置配置能力提供开发期 `/api` proxy；不得加入生产部署、通用代理或其他环境系统。原 12 个预算文件均仍为必要文件，因此不删除任何路径；新增这一项后总量由 12（新增 8、修改 4）变为 13（新增 8、修改 5）。禁止目录级预算、未来占位文件、后端文件、部署文件、TASK-0007、Room 文件、数据库或 Migration 修改。

依赖兼容性证据不增加实施文件：`src/frontend/package.json` 与 `src/frontend/package-lock.json` 已准确列为修改，`src/frontend/vite.config.ts` 也已包含在上述 13 文件预算中；列表与新增 8、修改 5 的统计一致。

## 精确依赖预算

- 当前工程版本证据（U03-B 只读取得）：Node.js `v24.18.0`、npm `11.16.0`；`package.json` 声明 Vue `^3.5.39`、Vite `^8.1.1`、TypeScript `~6.0.2`、`@vitejs/plugin-vue` `^6.0.7`、Vitest `^4.1.10`，当前实际安装分别为 Vue `3.5.40`、Vite `8.1.5`、TypeScript `6.0.3`、`@vitejs/plugin-vue` `6.0.8`、Vitest `4.1.10`。项目未声明 `engines` 或 `packageManager`，未安装 `@vue/test-utils`、jsdom 或 `vue-router`；lockfileVersion 为 3。
- 官方包元数据证据：执行 `npm view vue-router@4.6.3 version peerDependencies engines --json` 返回版本 `4.6.3`、peerDependencies 为 `{ "vue": "^3.5.0" }`，且未声明 `engines`；补充执行 `npm view vue-router@4.6.3 dependencies --json` 返回传递依赖 `{ "@vue/devtools-api": "^6.6.4" }`。当前 Vue 声明范围和实际版本均满足 peer 要求；Router 无额外 Node engine 要求，当前 Node 可用；元数据未声明与 Vite或 TypeScript 的直接 peer/engine 约束，现有 Vite、TypeScript 和 Vue 插件无需变更。
- 兼容性裁决：保留 `vue-router` 精确版本 `4.6.3`。新增直接生产依赖仅此 1 项，必须位于 `package.json` 的 `dependencies`，准确字符串为 `"vue-router": "4.6.3"`；禁止使用 `^4.6.3`、`~4.6.3`、`latest` 或 `4.x`。`@vue/devtools-api` 仅由 npm 作为传递依赖解析，不得另列为直接依赖。
- `package-lock.json` 必须与 `package.json` 在同一次精确安装中由 npm 正常同步更新，锁定 `vue-router` 及其传递依赖；禁止手工编辑 lock 文件。不得升级现有依赖、增加其他直接依赖或运行 `npm audit fix`。
- 新增开发依赖：0。
- 继续使用现有 Vue、Vitest、TypeScript、Vite 和 Vue 自带服务端渲染能力；不新增组件挂载或 DOM 仿真工具。
- 当前 Vitest 与 `createMemoryHistory` 足以测试 Router；不修改 Vite 插件或 TypeScript 配置，不新增 `@vue/test-utils`、jsdom 或其他测试框架/依赖。
- 禁止 Pinia、Axios、UI/表单/验证/CSS 框架及其他生产依赖；禁止新增测试框架。

## 测试要求

使用现有 Vitest 与 Node 环境。页面基本渲染通过 Vue 自带服务端渲染能力验证；路由测试使用 `createMemoryHistory`，不新增 DOM 工具。测试必须覆盖：

- 单元测试只使用 fetch mock 验证请求与认证流程，不启动真实服务。
- U15 使用真实本地 .NET 后端与 Vite 开发服务器，经实际 `/api` proxy 联调；不依赖外部服务、不连接远程数据库，SQLite 使用 TASK-0007 已有开发配置。
- 联调失败立即停止并记录，不修改代码、不现场修复，也不得增加或调用测试专用生产端点绕过失败。

1. 登录页用户名、密码、按钮和错误区域基本渲染。
2. 登录成功后进入 `/`。
3. 登录失败展示统一错误。
4. 匿名访问 `/` 跳转 `/login`。
5. 已登录访问 `/login` 跳转 `/`。
6. 刷新初始化调用 `/api/auth/me` 恢复状态，且并发守卫共享一次初始化。
7. API 401 清理内存认证状态。
8. 登出成功或 401 后返回 `/login`。
9. Antiforgery 顺序严格符合 TASK-0007，旧匿名令牌不复用。
10. 测试监视 localStorage/sessionStorage 与日志，证明密码、Cookie、CSRF Token 未写入持久存储或日志。
11. `npm run build` 为 0 errors、0 warnings；`npm test` 全部通过。
12. TASK-0007 后端 `dotnet test` 保持 28/28 PASS。

## 验收标准（12 条）

| ID | 单一可测试标准 | 证据 |
|---|---|---|
| AC-01 | 应用安装 Vue Router，且仅定义 `/login` 与 `/` 两条页面路由。 | 代码审查、构建、路由测试 |
| AC-02 | `/login` 渲染用户名、密码、登录按钮和错误信息区域。 | 页面渲染测试 |
| AC-03 | `/` 仅渲染当前用户名、角色和登出按钮。 | 页面渲染测试 |
| AC-04 | `useApi` 使用相对 `/api`、原生 fetch、同源 Cookie、JSON/204、统一错误提取和 401 通知，且无缓存或重试。 | 单元测试、代码审查 |
| AC-05 | `useAuth` 仅以内存管理用户和初始化态，通过 `/me` 恢复身份，并在 401 时清空用户。 | 单元测试 |
| AC-06 | 登录严格执行匿名 CSRF、login、认证后 CSRF、me，并在成功后进入 `/`，失败时展示统一错误。 | 单元/页面测试 |
| AC-07 | 登出严格执行认证态 CSRF、logout，204 或 401 后清空认证态并进入 `/login`。 | 单元/页面测试 |
| AC-08 | 守卫使匿名访问 `/` 转至 `/login`、已登录访问 `/login` 转至 `/`，初始化只执行一次且无无限重定向。 | 路由测试 |
| AC-09 | `X-XSRF-TOKEN` 生命周期与 TASK-0007 一致，匿名旧令牌不用于登录后状态变更。 | 请求顺序测试 |
| AC-10 | 密码、Cookie、CSRF Token 不写入持久存储或日志，前端不读取 Cookie。 | 单元测试、代码审查 |
| AC-11 | 实际变更不超出 13 文件预算，依赖仅新增 `vue-router` 4.6.3，前端构建/测试 0 errors、0 warnings。 | Git、npm 命令 |
| AC-12 | 无明确不实现内容、TASK-0009 内容、后端/数据库修改或未来抽象，后端 28/28 测试不回归。 | 范围审查、dotnet test |

## 5～10 分钟执行单元

每个会话只执行一个 Uxx，不得自动进入下一单元；开始前验证 HEAD、任务状态和相关模块锁，结束后报告耗时、文件和验证结果。预计超过 10 分钟必须停止并进一步拆分，不得合并多个开发单元为一次大修改。

| 单元 | 预计 | 唯一范围 |
|---|---:|---|
| U01 | 5～10 分钟 | 创建 DRAFT；仅任务文档、current-task 和本轮规格锁 |
| U02 | 5～10 分钟 | 独立 Reviewer 规格审核；仅新增审核报告 |
| U03 | 5～10 分钟/轮 | 每轮仅修复一个或一组紧密相关 Finding；只改任务文档及必要状态记录 |
| U04 | 5～10 分钟 | 独立规格复审；PASS 后由有权 Architect 单独执行 DRAFT → READY，不实施代码 |
| U04-A | 5～10 分钟 | 仅在任务已合法进入 READY 且实施锁已认领后，于 `src/frontend/` 执行 `npm install --save-exact vue-router@4.6.3`，核对 `package.json` 和 `package-lock.json` 的实际依赖差异并报告；不得顺带实现 Router、升级其他包或运行 `npm audit fix`，失败立即停止 |
| U05 | 5～10 分钟 | 仅新增 Router 并接入 `main.ts`/`App.vue`，不写页面逻辑 |
| U06 | 5～10 分钟 | 仅实现静态登录表单，不接 API |
| U07 | 5～10 分钟 | 仅实现最小 fetch 与错误契约，不实现认证状态 |
| U08 | 5～10 分钟 | 仅实现 `/me` 和内存身份恢复 |
| U09 | 5～10 分钟 | 仅实现 CSRF + login，不实现 logout |
| U10 | 5～10 分钟 | 仅实现 CSRF + logout |
| U11 | 5～10 分钟 | 仅实现匿名和已登录重定向守卫 |
| U12 | 5～10 分钟 | 仅实现用户名、角色和登出按钮的受保护首页壳 |
| U13 | 5～10 分钟 | 仅补 `useApi`/`useAuth` 测试 |
| U14 | 5～10 分钟 | 仅补页面、跳转、守卫与错误展示测试 |
| U15-A | 5～10 分钟 | 不改代码；启动或确认本地后端与 Vite，仅经 `/api` proxy 验证匿名 csrf → login → 认证后 csrf → me 并记录结果；任一步失败立即停止报告，不修复 |
| U15-B | 5～10 分钟 | 不改代码；确认 U15-A 的真实本地进程和登录态，仅经 `/api` proxy 验证认证后 csrf → logout → me 返回 401/登录态清除并记录结果；任一步失败立即停止报告，不修复 |
| U16 | 5～10 分钟 | 不改实现且不得顺手修复；只运行完整前端构建/测试和后端 28/28 回归 |
| U17 | 5～10 分钟 | 不改实现；仅显式暂存批准文件、提交、推送、登记证据并执行合法交审迁移 |

## 构建与验证命令

在仓库根目录运行：

```powershell
pwsh -NoLogo -NoProfile -Command "Set-Location src/frontend; npm test"
pwsh -NoLogo -NoProfile -Command "Set-Location src/frontend; npm run build"
dotnet test Datacenter.sln --no-restore
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
git diff --name-status
git status --short --branch
git diff --cached --name-status
```

U16 预期：前端测试全通过，构建 0 errors/0 warnings，后端 28/28 PASS，工作流 PASS=20/FAIL=0/TOTAL=20。若失败，U16 只报告并停止，修复必须进入新的受控单元。

## 防过度开发门禁

- 每项实现必须同时映射 Requirement Source、本规格范围和 AC；无法映射即停止。
- 采用最简单方案：模块内 `ref` + 原生 `fetch` + 两条静态路由；不引入通用状态层、HTTP 客户端或未来业务抽象。
- 发现新增页面、依赖、后端/API 契约变化、预算外文件、无关重构或 TASK-0009 内容，立即停止并按权威工作流发起 Change Request。
- 实施结束逐项搜索 JWT、Refresh Token、Pinia、Axios、Room/Cabinet/Server 业务内容及持久化认证数据；存在任一项即不允许交审。

## 状态迁移、锁与审核要求

- 当前为 `DRAFT`；DRAFT 内只允许澄清、设计、补全文档，禁止业务代码和实施锁。
- U01 仅认领 `tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md` 三项规格文档锁；不得提前锁定 `src/frontend/`、`src/backend/`、`tests/`、package/lock 文件或 TASK-0009。
- U01 提交推送后保持 DRAFT 和规格锁 CLAIMED，等待独立 Codex Reviewer 执行 U02；Reviewer 只读，不修改本规格。
- U02 若有 Finding，Architect 在独立 U03 修正；Reviewer 独立复审。只有 Reviewer PASS 且 READY 条件完整后，才由有权 Architect 在独立步骤合法执行 `DRAFT → READY` 并释放规格锁。
- 进入实施前，Cursor Frontend 必须重新检查冲突、按精确文件逐项认领实施锁，再执行 `READY → IN_PROGRESS`。不得使用目录级 `src/frontend/` 锁替代精确预算。
- 实现交审必须遵守 `IN_PROGRESS → READY_FOR_REVIEW`，锁转 HANDED_OFF；最终 Reviewer 必须独立。只有 Reviewer 验收、提交推送、哈希一致、工作区/暂存区干净并释放锁后才可转 COMPLETED。

## U01 交接

- 当前执行单元：U01
- 当前阶段：规格编写完成
- Blocker：无
- Next Action：Codex Reviewer 执行 U02 规格审核
- 允许进入 U02：是
- 允许开始实现：否

---

> 本文件当前仅为 DRAFT。未经独立规格审核 PASS、Architect 合法迁移到 READY 和实施 Owner 认领精确模块锁，不得实施。
