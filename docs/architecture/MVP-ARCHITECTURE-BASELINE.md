# 机房服务器落位可视化系统 MVP 技术架构基线

## 1. 文档信息

| 属性 | 值 |
|---|---|
| 文档名称 | 机房服务器落位可视化系统 MVP 技术架构基线 |
| 文档版本 | 1.0 |
| 创建日期 | 2026-07-17 |
| 关联任务 | TASK-0005 |
| Requirement Source | hangyu 提出的企业机房服务器落位可视化需求 |
| 产品基线 | docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS） |
| 作者 | Claude + DeepSeek Product Manager |
| 状态 | READY_FOR_REVIEW |
| 对应分支 | docs/task-0005-architecture-baseline |

## 2. 架构目标

基于已批准的产品基线（12 FR、7 NFR、37 AC、30 BR、9 PAGE、4 角色），定义支撑 MVP 开发的最小技术架构。本基线只做技术裁决和边界划分，不编写业务代码、不创建项目脚手架、不设计完整 API 清单或数据库 DDL。

核心目标：

1. 为每条产品 BR 提供可执行的技术落脚点。
2. 明确前后端职责边界，防止校验遗漏或双重实现。
3. 确定数据持久化方向，满足 MVP 数据一致性和操作可追踪性要求。
4. 给出最小项目目录结构，防止提前引入不必要的抽象层。
5. 定义本地开发、构建和测试命令。
6. 将后续开发拆分为可独立审核的小型任务。

## 3. 产品基线引用

本架构基线完整接受 TASK-0004 产出的产品基线，包括：

- 12 项功能要求（FR-001 至 FR-012）
- 7 项非功能要求（NFR-001 至 NFR-007）
- 37 项验收标准（AC-001 至 AC-037）
- 30 条业务规则（BR-001 至 BR-030）
- 9 个页面（PAGE-001 至 PAGE-009）
- 4 个用户角色（机房管理员、运维人员、DBA/应用运维人员、只读查看人员）
- 8 项产品假设（AS-01 至 AS-08）

产品基线中的任何 BR、FR、NFR、AC 均不在本架构基线中重新定义或修改。本基线仅补充技术实现层面的裁决。

## 4. MVP 系统边界

### 4.1 系统形态

单体应用，两层部署：

```
Browser (Chrome/Edge/Firefox)
    │  HTTP (localhost dev)
    ▼
ASP.NET Core Web API (.NET 8)     ← 同时托管前端静态资源（生产构建时）
    │  EF Core 8
    ▼
SQLite (单文件数据库，WAL 模式)
```

- 前端 Vue 3 SPA：Vite 构建为静态文件。开发时 Vite dev server 代理 API 请求到后端。
- 后端 ASP.NET Core 单一项目：承载所有 API、业务逻辑、数据访问和认证。
- 数据存储：SQLite 单文件，存储于服务器本地磁盘。
- 无反向代理、无独立静态资源服务、无容器编排、无消息队列、无分布式缓存。

### 4.2 MVP 包含

- Web 前端（Vue 3 + TypeScript + Vite）
- 后端 API 服务（.NET 8 + ASP.NET Core Web API）
- 数据持久化（SQLite + EF Core 8）
- 身份认证和角色校验（Cookie 认证）
- 全部 9 个页面和 12 项 FR
- 全部 30 条 BR 在后端强制校验
- 操作记录不可变写入
- 机柜二维 U 位视图（HTML/CSS 实现）

### 4.3 MVP 明确不包含

- 三维机房漫游或三维服务器模型
- 服务器运行状态实时监控和自动采集
- CMDB 自动同步和自动发现
- 批量导入导出
- 报表中心、仪表盘、大屏首页
- 工单系统和审批流
- 完整的 RBAC 权限平台
- LDAP、AD 或单点登录
- 告警和通知平台
- 容量趋势预测和 AI 分析
- 移动端 App
- 多租户支持
- 插件系统
- 微服务架构
- 消息队列（RabbitMQ、Kafka 等）
- Kubernetes 或容器编排
- Redis 或其他分布式缓存
- Elasticsearch 或其他搜索引擎
- 未经批准的云服务
- 多数据库兼容层
- 数据库集群、高可用、分库分表

## 5. 已确认技术栈

| 层 | 选型 | 版本要求 | 选择理由 |
|---|---|---|---|
| 前端框架 | Vue 3 | ≥ 3.4 | AGENTS.md 已指定 |
| 前端语言 | TypeScript | ≥ 5.0 | 类型安全，与 Vue 3 生态一致 |
| 构建工具 | Vite | ≥ 5.0 | Vue 3 生态默认，开发体验优于 webpack |
| 路由 | Vue Router 4 | ≥ 4.0 | SPA 页面路由标准方案 |
| 状态管理 | Vue 3 `reactive()` + composables | — | 9 个页面无跨组件复杂共享状态，不需要 Pinia/Vuex |
| HTTP 客户端 | 浏览器 `fetch` API | — | 内置，零依赖；MVP API 调用模式简单 |
| 2D 机柜视图 | HTML + CSS（div 布局） | — | 实现 U 位网格的最简方案；不需要 Canvas/SVG 坐标系统 |
| 后端框架 | ASP.NET Core 8 Web API | .NET 8.0 LTS | AGENTS.md 已指定 |
| 数据访问 | EF Core 8 | ≥ 8.0 | .NET 生态标准 ORM，SQLite 完整支持 |
| 数据库 | SQLite | ≥ 3.35 | 零安装、单文件、WAL 模式、EF Core 完整支持 |
| 认证 | ASP.NET Core Cookie Authentication | — | 满足"所有访问需登录"，不需要 Identity Server 或 JWT |
| 参数校验 | ASP.NET Core 内置模型验证 + 业务层显式校验 | — | 内置能力即可覆盖 MVP 校验需求 |
| 对象映射 | 手动（无映射框架） | — | MVP 实体数量少（6 个），手动映射可控且透明 |
| 日志 | ASP.NET Core 内置 `ILogger<T>` | — | 开发环境输出到控制台，满足 MVP 最小日志需求 |
| 测试（后端） | xUnit + EF Core InMemory / SQLite | — | .NET 生态标准测试框架 |
| 测试（前端） | Vitest | — | 与 Vite 原生集成 |

### 5.1 明确排除的依赖

以下依赖不得引入 MVP：

| 包/框架 | 排除理由 |
|---|---|
| AutoMapper / Mapster | 实体数量少，手动映射足够 |
| MediatR | 无 CQRS 需求，直接调用服务方法即可 |
| FluentValidation | ASP.NET Core 内置模型验证已够用 |
| Swashbuckle / NSwag | 使用 Minimal API 内置 OpenAPI 或 Controller 默认支持 |
| Serilog / NLog | ASP.NET Core 内置 ILogger 满足开发日志需求 |
| Pinia / Vuex | 9 个页面无复杂共享状态 |
| Axios | 浏览器 fetch API 满足 MVP API 调用 |
| Element Plus / Ant Design Vue | MVP 不需要完整 UI 组件库 |
| GraphQL / gRPC | REST/JSON 满足 MVP 全部需求 |
| Docker / Podman | 本地开发直接用 dotnet run + npm run dev |

## 6. 系统上下文

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Chrome / Edge / Firefox)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Vue 3 SPA                                       │   │
│  │  - 9 pages (Vue Router)                          │   │
│  │  - 2D cabinet view (HTML/CSS div grid)            │   │
│  │  - Form validation (UX only, not authoritative)   │   │
│  │  - Role-based UI visibility (v-if)               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
        │ HTTP (Cookie Auth)
        ▼
┌─────────────────────────────────────────────────────────┐
│  ASP.NET Core 8 Web API                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth Middleware (Cookie)                         │   │
│  │  - Authenticate all non-login requests            │   │
│  │  - Reject anonymous on all pages (AC-037)         │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Endpoints (by resource)                          │   │
│  │  Auth, Rooms, Cabinets, Servers,                   │   │
│  │  Placements, AuditRecords, ServerStatus            │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services (business logic per FR)                 │   │
│  │  - RoomService, CabinetService, ServerService     │   │
│  │  - PlacementService (install/move/uninstall)      │   │
│  │  - AuditService (immutable append)                │   │
│  │  - ALL 30 BRs enforced HERE, never client-side    │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  EF Core 8 DbContext                              │   │
│  │  - 6 entity sets                                 │   │
│  │  - Migrations (code-first)                        │   │
│  └──────────────────────────────────────────────────┘   │
│        │                                                   │
│        ▼                                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  SQLite (WAL mode, single file, local disk)       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 7. 前端职责

### 7.1 页面与路由

Vue Router 4 管理 9 个页面路由。所有路由（除 `/login`）需要已认证状态；未认证访问重定向到 `/login`。

| 路由 | 页面 | 对应 PAGE 编号 |
|------|------|---------------|
| `/rooms` | 机房列表 | PAGE-001 |
| `/rooms/:id` | 机房详情 | PAGE-002 |
| `/cabinets` | 机柜列表 | PAGE-003 |
| `/cabinets/:id/view` | 二维机柜 U 位视图 | PAGE-004 |
| `/servers` | 服务器列表 | PAGE-005 |
| `/servers/:id` | 服务器详情 | PAGE-006 |
| `/servers/new`, `/servers/:id/edit` | 服务器新增/编辑 | PAGE-007 |
| `/cabinets/:id/place` | 位置操作界面 | PAGE-008 |
| `/servers/:id/audit` | 操作记录 | PAGE-009 |
| `/login` | 登录 | — |

### 7.2 状态管理

不使用 Pinia 或 Vuex。使用 Vue 3 Composition API `reactive()` + composables：

- `useAuth()` — 当前用户、角色、登录/登出
- `useApi()` — fetch 封装、错误处理

### 7.3 表单校验

前端执行即时输入校验（如必填非空、数值范围），提供用户体验反馈。但所有 BR 的最终判定以后端响应为准。前端校验通过不等于操作一定成功。

### 7.4 二维机柜视图

**渲染边界：**
- 机柜列表（PAGE-003）只展示每个机柜的摘要信息（编号、U 位总数、已用数、空闲数、使用率），不展开全部 U 位。
- 二维 U 位网格（PAGE-004）只渲染当前选中的单个机柜，最多按其配置 U 数渲染格子（如 60U）。不一次性渲染 200 个机柜的全部 12000 个 U 位。

**实现方式：** HTML + CSS（div 元素）：
- 每个 U 位为一个 div，按 U1（顶部）到 UN（底部）垂直排列
- U1 位于顶部，编号自上向下递增
- 空闲 U 位与已占用 U 位使用不同 CSS 类区分（颜色 + 边框 + 文本标注）
- 跨 U 服务器使用连续占用 div 合并视觉呈现
- 点击已占用区域弹出概要信息
- 色觉障碍友好：颜色之外增加图标或文本标注

**明确排除：** MVP 不引入 Canvas、SVG、虚拟列表、`will-change` 优化或 Grid Plan。只有 AC-018 实测失败并经 Change Request 获批后，才允许调整渲染方案。

### 7.5 角色 UI 控制

- 修改操作入口（新增、编辑、上架、移动、下架按钮）仅对机房管理员和运维人员可见
- DBA/应用运维人员和只读查看人员看到只读界面
- 前端 `v-if` 基于 `useAuth().role` 控制可见性
- 后端独立校验权限，前端隐显不构成安全担保

## 8. 后端职责

### 8.1 API 资源分组

后端按资源组织 API，架构层只定义资源边界和职责，不固定具体路径、HTTP 方法、查询参数或请求/响应体。完整 API 契约由 TASK-0007（Architect 管理）定义并追踪到 FR/AC。最小资源分组：

| 资源组 | 产品已批准操作 | 关联 FR | 备注 |
|--------|--------------|---------|------|
| 认证 | 登录、登出、当前用户信息 | NFR-007 | — |
| 机房 | 创建、查看列表、查看详情、编辑 | FR-001 | 不删除有机柜的机房 (BR-018) |
| 机柜 | 创建、查看列表、查看详情、编辑（含 U 位总数） | FR-002, FR-009 | 不删除有在架服务器的机柜 (BR-017)；容量统计 |
| 服务器 | 创建（录入）、查看列表、查看详情、编辑、查询筛选 | FR-003, FR-007 | **不实现服务器删除**；产品基线明确 MVP 不实现删除功能 |
| 位置操作 | 上架、移动、下架 | FR-004, FR-005, FR-006 | 所有操作短事务；操作记录不可变写入 |
| 操作记录 | 按服务器查看（只读） | FR-010 | 不修改、不删除 |
| 运行状态 | 人工更新 | FR-011 | 页面标注"人工维护" |

API 风格裁决：**ASP.NET Core Controllers**。理由：资源边界、授权过滤器、模型绑定和后续独立测试更直观；不引入额外框架。TASK-0007 在 Controllers 基础上定义具体路由和方法签名。

### 8.2 业务规则执行

全部 30 条 BR 在后端 Services 层执行：

- 所有 BR 的校验逻辑集中在对应的 Service 方法内
- API 端点只负责：接收请求 → 调用 Service → 返回结果或错误
- 前端不得绕过：即使前端不发送校验请求，后端对每个修改操作独立执行全部相关 BR
- BR 违反时返回 `400 Bad Request` + 明确错误消息（如 "U 位 10-11 已被服务器 X 占用"）

### 8.3 位置操作原子性

上架、移动、下架均为短事务，每个操作在单个数据库事务内完成：

**上架事务：** 在事务内重新校验目标 U 位空闲（SQLite 写锁保证并发安全）→ 占用 U 位 → 更新机柜容量 → 写入操作记录 → 提交。事务冲突（并发上架同一 U 位）由 SQLite 写锁和数据库约束拒绝，后端将冲突映射为可识别业务错误（如 "U 位 10-11 已被占用"）。

**移动事务（BR-014/BR-015）：** 校验新位置 → 占用新 U 位 → 释放原 U 位 → 更新两个机柜的容量 → 写入操作记录 → 提交。任何步骤失败时回滚整个事务，服务器保持原位置不变。

**下架事务（BR-016）：** 释放全部 U 位 → 更新服务器位置状态 → 更新机柜容量 → 写入操作记录 → 提交。

并发竞争时，最终由数据库事务写锁和唯一约束拒绝冲突写入，不允许仅依赖"先查后写"而没有最终拒绝机制。

### 8.4 错误响应约定

所有 API 错误使用统一 JSON 结构：

```json
{
  "error": "人类可读的失败原因",
  "details": "可选的补充信息（如冲突的 U 位编号）"
}
```

HTTP 状态码：
- `400` — 业务规则拒绝（参数不合法、U 位冲突、名称重复等）
- `401` — 未认证
- `403` — 已认证但角色权限不足
- `404` — 资源不存在
- `500` — 未预期的服务端错误

### 8.5 认证与角色

**账号来源：** MVP 用户账号保存在 SQLite User 表中。首个管理员账号通过受控种子数据或首次部署时凭据注入创建（不将密码提交到 Git）。后续账号由已认证管理员通过系统界面创建。不实现自注册。

**密码处理：** 使用 `Microsoft.AspNetCore.Identity.PasswordHasher<TUser>`（`Microsoft.Extensions.Identity.Core` 包中的独立哈希组件）或直接使用 `Rfc2898DeriveBytes`（PBKDF2）配合随机盐和高迭代次数（≥ 100,000）。不使用 ASP.NET Core Identity 完整框架（UserManager、RoleManager、SignInManager 等）。禁止明文存储。

**User 实体最小数据：** 唯一标识、登录名、密码哈希、启用状态、角色（字符串：`机房管理员`、`运维人员`、`DBA/应用运维人员`、`只读查看人员`）。

**登录流程：** 用户提交账号和密码 → 后端验证用户存在且已启用 → 验证密码哈希 → 通过后创建 `ClaimsPrincipal`（含用户标识和角色声明）→ 调用 `HttpContext.SignInAsync` 建立 Cookie 会话。登录失败返回统一错误（不区分"用户不存在"和"密码错误"，防止用户名枚举）。

**注销流程：** 后端调用 `HttpContext.SignOutAsync` 清除认证 Cookie。后续受保护请求返回 `401`，需重新认证。

**Cookie 安全约束：**
- `HttpOnly = true`（JavaScript 不可访问）
- `SameSite = Lax`（单站点部署适用；生产同源托管下无需 None）
- `Secure = true`（生产 HTTPS 下强制；开发 HTTP 环境可关闭）
- 会话有效期：绝对过期 + 滑动过期策略（具体值由 TASK-0007 定义，建议滑动过期 30 分钟，绝对过期 8 小时）
- 认证票据包含用户标识和角色声明，每次请求由 Cookie 中间件解析

**CSRF 最小策略：** ASP.NET Core Cookie Authentication + 同源 SPA 部署 + `SameSite=Lax` 提供基础 CSRF 防护。如果 TASK-0008 采用前后端分离开发（不同端口），需在 TASK-0008 中评估是否需要 antiforgery 头部方案。

- 角色校验在 API 端点层执行：修改端点要求 `机房管理员` 或 `运维人员` 角色
- 匿名用户访问任意非登录端点返回 `401`；访问任意非登录页面被路由守卫重定向到 `/login`
- 前端 `v-if` 基于 `useAuth().role` 控制操作入口可见性，但不构成安全担保
- 不实现 ASP.NET Core Identity 完整框架（UserManager、RoleManager 等），使用自定义最小认证
- 不引入 Identity Server、OAuth 平台、完整 RBAC 引擎、权限配置页面、LDAP、AD、SSO、JWT 与 Cookie 双认证

## 9. 数据持久化方向

### 9.1 数据库选型

**SQLite**（版本 ≥ 3.35，支持 WAL 模式）。

选择理由：
- 零安装、零配置、零服务进程
- EF Core 8 完整支持（迁移、查询、事务）
- 单文件存储，便于备份和迁移
- WAL 模式提供足够的并发读取能力
- 产品基线数据规模（≤ 10000 台服务器）在 SQLite 能力范围内

明确约束：
- 单个 ASP.NET Core 后端实例访问
- 数据库文件存储在服务器本地磁盘
- 不放置于网络共享目录（NFS、SMB、NAS 等）
- 所有数据访问通过后端 API，前端不直接访问数据库
- 启用 WAL 模式（`PRAGMA journal_mode=WAL;`）
- 上架、移动、下架均使用短事务（参见第 8.3 节），事务内重新校验并处理 SQLite 写竞争
- 资产编号可空唯一性由 SQLite 部分唯一索引实现（`CREATE UNIQUE INDEX ... WHERE AssetNumber IS NOT NULL`），配合后端校验形成双重保证
- U 位冲突由后端业务校验和事务内数据库约束/写锁共同最终拒绝
- 所有时间字段使用 UTC 存储
- 不建立多数据库兼容层（无 repository interface、无数据库抽象）
- 不使用 SQLite 不支持的 Schema、Sequence 或数据库生成并发令牌
- 数据库迁移执行前必须创建可恢复的文件备份；常规备份为文件复制（数据库不在写入状态时），备份恢复必须经过验证
- 运行中备份不得直接复制正在写入的数据库文件；需通过 `.backup` 命令或等效安全方式
- 具体备份命令和自动化留给部署任务
- 后续出现多实例、高并发写入或高可用需求时，通过 Change Request 评估迁移至 MySQL

### 9.2 排除的替代方案

| 方案 | 排除理由 |
|------|----------|
| PostgreSQL / MySQL | 需要独立安装和运维，违反最简单可行方案 |
| SQL Server LocalDB | 需要额外安装；SQLite 更简单且跨平台 |
| InMemory (EF Core) | 数据不持久化，无法满足位置记录保留要求 |
| JSON 文件 | 无法保证 U 位占用事务一致性 |
| SQLite 内存模式 | 同上；且无法跨进程启动保留数据 |

### 9.3 实体与关系

以下为最小实体边界，仅定义职责、关键标识和关系。完整字段列表、数据类型和数据库映射由 TASK-0007 定义。

| 实体 | 关键标识 | 关系 |
|------|---------|------|
| Room | Id (PK), Name (unique) | 包含多个 Cabinet |
| Cabinet | Id (PK), (RoomId + CabinetNumber) unique | 属于 Room；包含多个 ServerPosition |
| Server | Id (PK), Name (unique), ManagementIP (unique), AssetNumber (unique if set) | 有 0 或 1 个当前有效 ServerPosition |
| ServerPosition | Id (PK), ServerId (FK) | 属于 Server 和 Cabinet；记录 U 位范围 (StartU, EndU) 和在架状态 |
| User | Id (PK), Username (unique) | 有一个 Role（字符串） |
| AuditRecord | Id (PK), ServerId (FK), UserId (FK) | 关联 Server 和 User；创建后不可修改或删除 |

关系约束：
- 一台 Server 最多有一个状态为"在架"的 ServerPosition
- 一个 Cabinet 的同一 U 位最多被一个状态为"在架"的 ServerPosition 占用
- 一个 Room 可以有 0 到多个 Cabinet
- AuditRecord 只增不删不改

不定义：聚合根、值对象、领域事件、规约模式、仓储接口。Service 层直接使用 DbContext。

## 10. 最小领域边界

### 10.1 实体职责

**Room（机房）**
- 职责：标识服务器和机柜的物理空间容器
- 关键规则：Name 全局唯一 (BR-027)；停用后不能新增机柜或执行位置操作 (BR-028)；包含机柜时不能删除 (BR-018)

**Cabinet（机柜）**
- 职责：容纳服务器的物理柜体，定义 U 位范围
- 关键规则：同一机房内 CabinetNumber 唯一 (BR-001)；U 位总数 ≥1 (BR-002)；U 位编号 1 到 TotalU 连续递增 (BR-003)；停用后不能执行位置操作 (BR-029)；存在在架服务器时不能删除 (BR-017)；编辑 U 位总数不能导致现有服务器越界 (BR-030)

**Server（服务器）**
- 职责：被管理的 IT 设备
- 关键规则：Name 全局唯一 (BR-005)；ManagementIP 全局唯一 (BR-006)；AssetNumber 若填写则全局唯一 (BR-007)；DeviceHeight ≥1 (BR-004)；运行状态由人工维护 (BR-025)

**ServerPosition（服务器位置记录）**
- 职责：记录服务器当前或历史的位置
- 关键规则：一台服务器最多一个"在架"位置 (BR-012)；未上架/已下架不占用 U 位 (BR-013)；下架后释放全部 U 位、服务器记录保留 (BR-016)

**User（用户）**
- 职责：标识操作主体
- 关键规则：所有页面访问需登录；角色分为 机房管理员、运维人员、DBA/应用运维人员、只读查看人员

**AuditRecord（操作记录）**
- 职责：记录位置变更的不可变日志
- 关键规则：上架/移动/下架各写入一条 (BR-022)；创建后不可修改或删除 (BR-023)；包含操作类型、操作对象、前后位置、操作人、操作时间 (BR-024)

### 10.2 关系图（概念）

```
Room 1 ──── * Cabinet 1 ──── * ServerPosition * ──── 1 Server
                                    │
                              AuditRecord * ──── 1 Server
                                    │
                              AuditRecord * ──── 1 User
```

## 11. 项目目录基线

```
datacenter-layout/
├── src/
│   ├── frontend/                      # Vue 3 SPA (Vite)
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts                # 应用入口，挂载 Vue Router、全局配置
│   │       ├── App.vue                # 根组件
│   │       ├── router.ts              # Vue Router 路由定义（9 个页面 + /login）
│   │       ├── pages/                 # 页面组件（每个 PAGE 一个 .vue 文件）
│   │       │   ├── RoomListPage.vue
│   │       │   ├── RoomDetailPage.vue
│   │       │   ├── CabinetListPage.vue
│   │       │   ├── CabinetViewPage.vue
│   │       │   ├── ServerListPage.vue
│   │       │   ├── ServerDetailPage.vue
│   │       │   ├── ServerFormPage.vue
│   │       │   ├── PlacementPage.vue
│   │       │   ├── AuditRecordPage.vue
│   │       │   └── LoginPage.vue
│   │       ├── components/            # 可复用组件
│   │       │   ├── CabinetGrid.vue    # 二维 U 位网格
│   │       │   ├── CapacityStats.vue  # 容量统计展示
│   │       │   └── ErrorMessage.vue   # 错误消息展示
│   │       ├── composables/           # 共享逻辑
│   │       │   ├── useAuth.ts         # 认证状态
│   │       │   └── useApi.ts          # fetch 封装
│   │       └── types/                 # TypeScript 类型定义
│   │           └── index.ts
│   └── backend/                       # ASP.NET Core 8 Web API
│       ├── Program.cs                 # 服务注册、中间件管道
│       ├── appsettings.json           # 非敏感配置（日志级别等）
│       ├── appsettings.Development.json  # 开发环境连接字符串
│       ├── datacenter-layout-backend.csproj
│       ├── Models/                    # EF Core 实体类
│       │   ├── Room.cs
│       │   ├── Cabinet.cs
│       │   ├── Server.cs
│       │   ├── ServerPosition.cs
│       │   ├── User.cs
│       │   └── AuditRecord.cs
│       ├── Data/                      # DbContext 和配置
│       │   └── AppDbContext.cs
│       ├── Services/                  # 业务逻辑（每个资源组一个 Service）
│       │   ├── RoomService.cs
│       │   ├── CabinetService.cs
│       │   ├── ServerService.cs
│       │   ├── PlacementService.cs
│       │   ├── AuditService.cs
│       │   └── AuthService.cs
│       ├── Endpoints/                 # API 端点（Minimal API 或 Controller）
│       │   ├── AuthEndpoints.cs
│       │   ├── RoomEndpoints.cs
│       │   ├── CabinetEndpoints.cs
│       │   ├── ServerEndpoints.cs
│       │   ├── PlacementEndpoints.cs
│       │   ├── AuditEndpoints.cs
│       │   └── ServerStatusEndpoints.cs
│       └── Migrations/                # EF Core 迁移（自动生成）
├── tests/
│   ├── frontend/                      # 前端测试（Vitest）
│   │   └── composables/
│   │       ├── useAuth.test.ts
│   │       └── useApi.test.ts
│   └── backend/                       # 后端测试（xUnit）
│       ├── backend-tests.csproj
│       ├── UnitTests/                 # 单元测试（EF Core InMemory）
│       │   └── PlacementServiceTests.cs
│       └── IntegrationTests/          # 集成测试（SQLite 文件）
│           └── PlacementApiTests.cs
├── docs/
│   ├── product/                       # 产品基线（已有）
│   ├── architecture/                  # 架构基线（本文档）和 ADR
│   ├── contracts/                     # API 契约（TASK-0007 产出）
│   └── ui/                            # UI 设计（后续任务产出）
├── scripts/
│   └── validate-agent-workflow.ps1    # 工作流校验（已有）
├── tasks/                             # 任务文件（已有）
└── .gitignore                         # 已有（含 *.db、*.db-shm、*.db-wal、appsettings.Development.json、appsettings.*.local.json）
```

不创建以下无当前需求支撑的目录：
- `src/Common/` 或 `src/SharedKernel/`
- `src/Infrastructure/` 或 `src/Infrastructure.Abstractions/`
- `src/BuildingBlocks/`
- `src/Framework/` 或 `src/Platform/`
- `src/backend/Interfaces/` 或 `src/backend/Abstractions/`
- `src/backend/Domain/`（不实施 DDD 分层）

## 12. 配置和敏感信息规则

### 12.1 配置文件分层

| 文件 | 内容 | Git |
|------|------|-----|
| `appsettings.json` | 非敏感默认配置（日志级别、允许的主机等） | 是（提交） |
| `appsettings.Development.json` | 开发环境连接字符串（SQLite 文件路径）、开发日志级别 | 否（`.gitignore` 已排除） |
| `appsettings.Development.example.json` | 开发环境配置模板（不含真实路径/凭据，供 TASK-0006 提供） | 是（提交） |
| `appsettings.*.local.json` | 用户本地覆盖（如自定义端口） | 否（`.gitignore` 已排除） |
| `.env`（前端） | Vite 环境变量（API 代理目标） | 否（`.gitignore` 已排除） |
| `.env.example`（前端） | 环境变量模板 | 是（提交） |

### 12.2 敏感信息处理

- SQLite 数据库文件无密码，连接字符串包含文件路径——不是敏感信息
- 用户密码使用 PBKDF2 哈希存储（参见第 8.5 节），不存储明文
- Cookie 认证数据保护密钥由 ASP.NET Core 数据保护 API 自动管理
- 开发环境密钥和连接配置通过 `appsettings.Development.json`（已 gitignored）本地管理
- 不引入 Azure Key Vault、HashiCorp Vault 或任何密钥管理服务
- 生产部署时的敏感配置（如有）通过环境变量注入

### 12.3 SQLite 文件位置

- 开发环境：`src/backend/datacenter-dev.db`
- 路径在 `appsettings.Development.json` 中本地配置
- 数据库文件及 WAL/SHM 文件由 `.gitignore` 排除（`*.db`、`*.db-shm`、`*.db-wal`）

## 13. 本地开发流程

### 13.1 开发环境

- 宿主操作系统：Windows
- 主要开发环境：WSL 2 Ubuntu 24.04
- IDE：Windows Cursor 通过 WSL Remote 连接 Linux 项目
- CLI：Claude Code + Codex CLI 均在 WSL 中运行
- Git 仓库：WSL Linux 文件系统（`/home/shy/projects/datacenter-layout`）
- Node.js：NVM 管理，版本 ≥ 18
- .NET SDK：8.0 LTS，安装在 WSL
- 命令行：WSL 终端中通过 `pwsh` 或 `bash` 执行
- 不依赖独立 Linux 服务器或远程开发机
- 开发环境依据：AGENTS.md（经 CR-0001 更新）

### 13.2 环境检查命令

```powershell
node --version          # ≥ 18
npm --version           # 随 Node.js
dotnet --version        # ≥ 8.0.0
dotnet ef --version     # EF Core CLI 工具
pwsh --version          # 或 powershell
```

### 13.3 启动命令

| 操作 | 命令 | 工作目录 |
|------|------|----------|
| 安装前端依赖 | `npm install` | `src/frontend/` |
| 启动前端开发服务器 | `npm run dev` | `src/frontend/` |
| 还原后端依赖 | `dotnet restore` | `src/backend/` |
| 应用数据库迁移 | `dotnet ef database update` | `src/backend/` |
| 启动后端 | `dotnet run` | `src/backend/` |

前端 Vite dev server 默认 `http://localhost:5173`，API 代理到后端 `http://localhost:5000`（或 `https://localhost:5001`）。

### 13.4 构建命令

| 操作 | 命令 | 工作目录 |
|------|------|----------|
| 前端生产构建 | `npm run build` | `src/frontend/` |
| 后端构建 | `dotnet build` | `src/backend/` |

### 13.5 测试命令

| 操作 | 命令 | 工作目录 |
|------|------|----------|
| 前端测试 | `npx vitest run` | `src/frontend/` |
| 后端单元测试 | `dotnet test` | `tests/backend/` |
| 后端集成测试 | `dotnet test` | `tests/backend/` |
| 工作流校验 | `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | 仓库根目录 |

## 14. 构建和测试基线

### 14.1 前端测试

框架：Vitest（与 Vite 原生集成）。

范围：
- composables 逻辑：`useAuth` 认证状态管理、`useApi` 请求封装和错误处理
- 路由守卫：未认证重定向到 `/login`、角色路由保护

不测试：
- Vue 组件渲染（由后续任务通过手动验收覆盖）
- 浏览器兼容性（产品基线 AC-019 手动验收）

### 14.2 后端单元测试

框架：xUnit + EF Core InMemory 数据库（仅用于纯逻辑测试，不涉及数据库唯一性或事务语义）。

范围（纯计算和逻辑校验，无需真实 SQLite）：
- U 位范围计算（BR-008, BR-009 的数学计算）
- 容量统计计算（BR-019, BR-020, BR-021）
- 输入参数校验逻辑

### 14.3 后端集成测试

框架：xUnit + 实际 SQLite 文件数据库（每个测试类使用独立临时数据库文件，WAL 模式）。

范围（必须使用真实 SQLite 验证）：
- U 位冲突检测和并发拒绝（BR-010, BR-011）
- 上架完整事务（FR-004）
- 移动原子性：成功释放旧位 + 占用新位；失败时原位保留（BR-014, BR-015）
- 下架完整事务：释放全部 U 位（BR-016）
- 同一机房 CabinetNumber 唯一性（BR-001）
- Server Name/ManagementIP 全局唯一约束（BR-005, BR-006）
- 资产编号可空唯一性（BR-007）— SQLite 部分唯一索引验证
- 停用机房拒绝操作（BR-028）
- 停用机柜拒绝操作（BR-029）
- 编辑 U 位总数不得越界（BR-030）
- API 端点 → 业务逻辑 → 数据库读写的完整链路
- 认证中间件和角色校验
- 匿名拒绝（AC-037）

### 14.4 端到端验证

由 TASK-0016 手动执行，按产品基线 37 条 AC 逐项验证。本轮架构基线不定义自动化 E2E 测试框架。

### 14.5 不设定覆盖率数字目标

测试标准是核心 BR 有独立测试覆盖，而非覆盖率百分比。

## 15. 日志和错误处理

### 15.1 开发环境日志

- 使用 ASP.NET Core 内置 `ILogger<T>`
- 输出到控制台（Console Provider）
- 日志级别：`Information`（默认）、`Debug`（开发时可调整）
- SQLite EF Core 查询日志：开发环境可选输出 SQL 语句（`EnableSensitiveDataLogging` 仅开发环境）

### 15.2 错误响应

| 场景 | HTTP 状态码 | 响应体 |
|------|------------|--------|
| 业务规则拒绝（U 位冲突、名称重复等） | 400 | `{ "error": "具体原因" }` |
| 未认证 | 401 | `{ "error": "需要登录" }` |
| 角色权限不足 | 403 | `{ "error": "权限不足" }` |
| 资源不存在 | 404 | `{ "error": "资源不存在" }` |
| 未预期服务端错误 | 500 | `{ "error": "服务内部错误" }`（开发环境同时输出堆栈到控制台；非开发环境不泄露内部细节） |

### 15.3 审计

- 位置操作审计通过 AuditRecord 表写入（不可变），不是日志文件
- 认证事件（登录成功/失败）由 AuthService 写入日志

### 15.4 不引入

- ELK（Elasticsearch、Logstash、Kibana）
- OpenTelemetry 全家桶
- 分布式追踪（ActivitySource、Span）
- 日志聚合或集群
- 专门监控平台（Prometheus、Grafana）
- Seq、Splunk 等日志平台

## 16. 安全与权限边界

### 16.1 认证

认证方案完整定义于第 8.5 节（认证与角色），包括：账号来源（种子数据/管理员创建）、密码哈希（`PasswordHasher<TUser>` 或 PBKDF2 + 随机盐 + ≥ 100,000 迭代）、登录/注销流程、Cookie 安全约束（HttpOnly、SameSite=Lax、Secure on HTTPS、滑动过期）、CSRF 基础策略。

### 16.2 角色与授权

| 角色 | 查看 | 修改（创建、编辑、上架、移动、下架） |
|------|------|--------------------------------------|
| 机房管理员 | 全部 | 全部 |
| 运维人员 | 全部 | 全部（与管理员相同） |
| DBA/应用运维人员 | 全部 | 无（只读） |
| 只读查看人员 | 全部 | 无（只读） |
| 匿名用户 | 无 | 无 |

### 16.3 实现原则

- 认证和角色校验在后端每个修改端点（Controllers 授权过滤器）独立执行
- 前端角色隐显 (`v-if`) 仅用于用户体验，不构成安全担保
- 不实现 RBAC 权限引擎、菜单权限、字段权限、数据权限树
- 不实现 LDAP、AD 或 SSO 集成
- 不实现 JWT、OAuth 2.0 或 OpenID Connect

## 17. 性能验收支撑

### 17.1 基准数据填充

架构支持通过以下方式填充产品基线定义的性能测试数据：
- EF Core 种子数据（`HasData`）或测试初始化脚本
- 1 个机房、200 个 60U 机柜、每柜 50 台 1U 服务器、共 10000 台

### 17.2 验收执行

后续任务（TASK-0016）按以下口径执行性能验证：

- 数据：基准数据集（如上）
- 客户端：≥ 4 逻辑 CPU、8GB RAM、1920×1080、验收时最新稳定版 Chrome
- 服务端：≥ 4 vCPU、8GB RAM、SSD、无其他并发负载
- 网络：有线局域网，延迟 ≤ 5ms，带宽 ≥ 100Mbps
- 计时：从导航/点击到首屏完整可见，不计用户输入和思考时间
- 页面：机房列表、机柜列表、服务器列表、二维机柜视图
- 方法：每页预热 1 次，连续测量 5 次，中位数 ≤ 3 秒且至少 4 次 ≤ 3 秒
- 记录：全部原始数据

### 17.3 架构约束

- 架构不提前实施查询优化、二级缓存或索引调优
- 测量工具不限制（浏览器 DevTools、手动秒表均可）
- 产品基线的 3 秒阈值、数据规模和统计口径不得在架构或实现任务中单方面调整
- 如需调整性能指标，必须通过 Change Request

## 18. 依赖预算

TASK-0005 本身不引入任何依赖（纯文档任务）。以下为后续 MVP 开发任务的最小直接依赖预算，按类别列出。具体精确版本由 TASK-0006/0007/0008 锁定。

### 18.1 前端运行时依赖

| 依赖 | 用途 | 删除成本 |
|------|------|----------|
| `vue` | Vue 3 前端框架 | 替换框架（高） |
| `vue-router` | SPA 客户端路由 | 替换路由库（中） |

### 18.2 前端开发依赖

| 依赖 | 用途 | 删除成本 |
|------|------|----------|
| `vite` | 构建工具和开发服务器 | 替换构建工具（中） |
| `@vitejs/plugin-vue` | Vite 的 Vue 3 官方插件 | 随 Vite 替换 |
| `typescript` | TypeScript 编译器 | 降级为 JavaScript（高） |
| `vitest` | 前端测试框架 | 替换测试框架（中） |
| `@vue/test-utils` | Vue 组件测试辅助（如需） | 替换测试辅助（低） |
| `jsdom` 或 `happy-dom` | Vitest 浏览器环境模拟 | 替换 DOM 模拟（低） |

前端测试通过 `package.json` 中的 `vitest run` 脚本执行，使用已安装的本地 Vitest，不依赖 `npx` 临时下载。

### 18.3 后端运行时依赖

| 依赖 | 用途 | 删除成本 |
|------|------|----------|
| `Microsoft.EntityFrameworkCore.Sqlite` | SQLite EF Core 提供程序 | 更换数据库（中） |
| `Microsoft.Extensions.Identity.Core` | 提供 `PasswordHasher<TUser>` 独立哈希组件（不从完整 Identity 框架引入） | 替换为手动 PBKDF2 实现（低） |

认证和 Cookie 中间件由 ASP.NET Core 共享框架提供，无需额外 NuGet 包。

### 18.4 后端设计时依赖

| 依赖 | 用途 | 删除成本 |
|------|------|----------|
| `Microsoft.EntityFrameworkCore.Design` | EF Core 迁移工具（设计时，非运行时） | 改用 `dotnet ef` 全局工具（低） |

### 18.5 后端测试依赖

| 依赖 | 用途 | 删除成本 |
|------|------|----------|
| `xunit` | 测试框架 | 替换测试框架（中） |
| `Microsoft.NET.Test.Sdk` | .NET 测试运行基础设施 | 随 xUnit 替换 |
| `xunit.runner.visualstudio` | Visual Studio / `dotnet test` 集成 | 低 |
| `Microsoft.AspNetCore.Mvc.Testing` | 集成测试 ASP.NET Core 测试主机（如需） | 替换为手动自托管（中） |
| `Microsoft.EntityFrameworkCore.InMemory` | 纯逻辑单元测试的轻量数据库替代 | 替换为真实 SQLite（低） |

### 18.6 明确不引入的依赖

- 对象映射框架（AutoMapper、Mapster）
- 中介器/命令总线（MediatR、Brighter）
- 验证框架（FluentValidation）
- 日志框架（Serilog、NLog）
- HTTP 客户端库（Axios、Refit）
- UI 组件库（Element Plus、Ant Design Vue、Vuetify）
- 状态管理库（Pinia、Vuex）
- 完整认证框架（ASP.NET Core Identity、IdentityServer、Duende）
- 缓存库（Redis、MemoryCache 分布式扩展）
- 消息队列客户端
- 容器和编排工具

## 19. 明确不实现内容

以下内容不在当前架构基线或后续 MVP 开发中实现：

### 19.1 排除的功能

- 3D 机房漫游、3D 服务器模型、Three.js 场景
- 服务器运行状态实时采集和自动监控
- CMDB 自动发现和自动录入
- 批量导入导出
- 报表中心、仪表盘、大屏首页
- 工单系统和审批流
- 告警和通知平台
- 移动端 App

### 19.2 排除的架构能力

- 微服务或服务拆分
- 消息队列（RabbitMQ、Kafka 等）
- 容器编排（Kubernetes、Docker Swarm）
- 分布式缓存（Redis、Memcached）
- 搜索引擎（Elasticsearch、Lucene）
- 多数据库兼容层（repository pattern abstraction）
- 数据库集群、高可用、读写分离、分库分表
- 完整 RBAC 权限引擎
- LDAP、AD、SSO、OAuth 2.0、OpenID Connect
- 多租户数据隔离
- 国际化（i18n）
- 插件系统
- 事件溯源或 CQRS
- 领域事件体系
- API 版本管理

### 19.3 排除的运维能力

- ELK 日志平台
- OpenTelemetry 分布式追踪
- Prometheus/Grafana 监控
- CI/CD 流水线
- 容器镜像构建
- 云服务集成

## 20. 技术风险和缓解措施

| 编号 | 风险描述 | 影响 | 可能性 | 缓解措施 |
|------|---------|------|--------|----------|
| TR-01 | SQLite 在并发写入场景下性能不足 | 上架/移动/下架操作响应变慢 | 低：MVP 为单用户或少量并发场景 | 启用 WAL 模式；后续出现高并发写入时通过 Change Request 评估迁移 MySQL |
| TR-02 | 前端 HTML/CSS 二维视图在 60U 机柜中渲染性能不足 | 机柜视图加载超过 3 秒 | 低：60 个 div 元素渲染量极小 | 只有 AC-018 实测失败并经 Change Request 获批后，才调整渲染方案。MVP 不提前引入 Canvas、SVG、虚拟列表或 CSS `will-change` |
| TR-03 | Cookie 认证在前后端分离开发（不同端口）时需要配置 CORS | 认证 Cookie 无法跨域携带 | 低：开发时使用 Vite proxy 避免跨域 | 开发环境 Vite proxy 代理 API 请求到同源后端；Cookie 使用 `SameSite=Lax`；生产同源托管下无需额外配置；如后续改为跨域部署，通过 Change Request 评估 |
| TR-04 | 产品基线假设（如服务器名称唯一、IP 唯一）与实际企业环境不符 | 需要调整 BR | 低 | 假设已标记为可逆；变更时通过 Change Request |
| TR-05 | 后续架构或实现任务发现本基线的技术裁决需要调整 | 需要回到架构基线修改 | 低 | 每条裁决都有明确理由和排除分析；修改时建立 ADR |

## 21. 产品需求到架构的追踪关系

| 产品要求 | 架构落脚点 |
|----------|-----------|
| FR-001 机房管理 | 机房资源端点（创建、查看列表、查看详情、编辑）→ RoomService → Room 实体 |
| FR-002 机柜管理 | 机柜资源端点（创建、查看列表、查看详情、编辑 + U 位总数配置）→ CabinetService → Cabinet 实体 |
| FR-003 服务器录入 | 服务器资源端点（创建、查看列表、查看详情、编辑；不实现删除）→ ServerService → Server 实体 |
| FR-004 服务器上架 | 位置操作资源端点 → PlacementService（上架短事务、U 位并发冲突拒绝） |
| FR-005 服务器移动 | 位置操作资源端点 → PlacementService（移动短事务、先占新后放旧、失败回滚） |
| FR-006 服务器下架 | 位置操作资源端点 → PlacementService（下架短事务、释放全部 U 位） |
| FR-007 服务器查询 | 服务器资源端点（多条件查询 + 模糊匹配）→ ServerService |
| FR-008 二维机柜视图 | CabinetGrid.vue（HTML/CSS div 网格，单选当前机柜）→ 机柜资源端点返回 U 位占用数据 |
| FR-009 机柜容量统计 | CabinetService → 上架/移动/下架后重新计算 U 位总数、已用数、空闲数、使用率 |
| FR-010 操作记录查看 | 操作记录资源端点（按服务器查看，只读，不可修改或删除）→ AuditService |
| FR-011 人工运行状态展示 | 运行状态资源端点（人工更新）→ 页面标注"人工维护"说明 |
| FR-012 基本信息变更约束 | RoomService/CabinetService → 删除保护（有机柜/有在架服务器时拒绝）、U 位总数编辑保护（不得越界） |
| NFR-001 数据一致性 | 全部 30 条 BR 在后端 Services 层强制校验；上架/移动/下架均使用短事务 + SQLite 写锁最终拒绝冲突 |
| NFR-002 基础操作响应时间 | SQLite WAL 模式；不提前优化；TASK-0016 按 AC-018 验收 |
| NFR-003 二维视图可用性 | CabinetGrid.vue 使用颜色 + 文本标注双重区分 |
| NFR-004 位置操作校验反馈 | 后端 400 响应包含具体失败原因；前端展示错误消息 |
| NFR-005 操作可追踪性 | AuditRecord 实体只增不删；AuditService 在位置操作事务内写入操作记录 |
| NFR-006 浏览器兼容性 | 标准 HTML/CSS/JS（无浏览器特定 API）；Vite + TypeScript 转译 |
| NFR-007 基本操作安全 | Cookie 认证中间件（HttpOnly, SameSite=Lax）+ Controllers 授权过滤器；匿名访问全页面拒绝 |

## 22. 后续开发任务建议

以下任务基于本架构基线拆分，每个任务可独立开发、审核和提交。任务按顺序执行（非并行），确保认证和授权基础设施在任何受保护业务端点之前到位。任务编号和详细规格在各自任务文件中定义。

| 建议任务 ID | 名称 | 范围摘要 | 前置依赖 | 预计修改目录 |
|-------------|------|---------|----------|-------------|
| TASK-0006 | 项目脚手架 | 前端 Vite + 后端 ASP.NET Core 空项目创建；目录结构初始化；`.gitignore` 确认 | TASK-0005 | `src/`, `.gitignore` |
| TASK-0007 | 后端基础与认证骨架 | EF Core DbContext + 6 个实体 + 初始迁移 + 完整 Cookie 认证（登录/登出）+ User 种子数据 + 角色中间件 + Controllers 基础配置 | TASK-0006 | `src/backend/` |
| TASK-0008 | 前端基础与登录壳 | Vue Router + 登录页 + `useAuth`/`useApi` composables + 路由守卫（含匿名拒绝和角色保护） | TASK-0006 | `src/frontend/` |
| TASK-0009 | 机房管理 | 机房创建/查看列表/查看详情/编辑前后端完整实现（含 BR-018/BR-027/BR-028 后端校验和角色授权） | TASK-0007, TASK-0008 | `src/backend/Models/Room.cs`, `src/backend/Services/RoomService.cs`, `src/backend/Controllers/RoomsController.cs`, `src/frontend/src/pages/RoomListPage.vue`, `src/frontend/src/pages/RoomDetailPage.vue` |
| TASK-0010 | 机柜管理 | 机柜创建/查看列表/查看详情/编辑 + 容量统计（含 BR-001/002/003/017/029/030 后端校验和角色授权） | TASK-0009 | `src/backend/Models/Cabinet.cs`, `src/backend/Services/CabinetService.cs`, `src/backend/Controllers/CabinetsController.cs`, `src/frontend/src/pages/CabinetListPage.vue` |
| TASK-0011 | 服务器基础信息 | 服务器创建/查看列表/查看详情/编辑 + 唯一性校验（含 BR-004/005/006/007 后端校验和角色授权；不含删除） | TASK-0009 | `src/backend/Models/Server.cs`, `src/backend/Services/ServerService.cs`, `src/backend/Controllers/ServersController.cs`, `src/frontend/src/pages/ServerListPage.vue`, `ServerDetailPage.vue`, `ServerFormPage.vue` |
| TASK-0012 | 二维机柜视图 | CabinetGrid.vue（单机柜 HTML/CSS 网格）+ U 位占用数据 API + 点击概要 + 容量统计展示 | TASK-0010, TASK-0011 | `src/backend/Controllers/CabinetsController.cs`（追加视图端点）, `src/frontend/src/components/CabinetGrid.vue`, `src/frontend/src/pages/CabinetViewPage.vue` |
| TASK-0013 | 上架/移动/下架 | PlacementService 完整实现（短事务 + 并发冲突拒绝）+ 操作记录写入 + 位置操作界面（含 BR-008~016/022~024 后端校验和角色授权） | TASK-0012 | `src/backend/Services/PlacementService.cs`, `src/backend/Controllers/PlacementsController.cs`, `src/frontend/src/pages/PlacementPage.vue` |
| TASK-0014 | 查询与筛选 | 多条件组合查询（8 个查询维度）+ 模糊匹配 | TASK-0011 | `src/backend/Services/ServerService.cs`（追加查询方法）, `src/frontend/src/pages/ServerListPage.vue`（追加筛选 UI） |
| TASK-0015 | 运行状态与操作记录 | 人工运行状态更新 + 操作记录按服务器查看（只读）+ 页面人工维护标注 | TASK-0013 | `src/backend/Controllers/`, `src/frontend/src/pages/AuditRecordPage.vue` |
| TASK-0016 | 集成与验收 | 全流程手动 E2E + 性能验证（按 AC-018）+ 浏览器兼容性测试（按 AC-019）+ 数据填充脚本 | TASK-0013, TASK-0014, TASK-0015 | `tests/`, `scripts/` |

**任务顺序：** 严格按编号顺序执行（0006 → 0007,0008 → 0009 → 0010 → 0011 → 0012 → 0013 → 0014,0015 → 0016）。TASK-0007 和 TASK-0008 互不依赖因此可并行（后端 vs 前端，无父子路径重叠）。TASK-0014 和 TASK-0015 可并行（不同文件和端点，无父子路径重叠）。其余均为串行依赖。

**模块锁边界：** 每个任务修改的具体文件和目录已在"预计修改目录"列列出。并行任务不得有父子路径重叠。TASK-0007 和 TASK-0008 无重叠（`src/backend/` vs `src/frontend/`）。TASK-0014 和 TASK-0015 无重叠（ServerService 查询方法 vs 独立 Controller）。

## 23. 待确认事项

| 编号 | 事项 | 影响范围 | 建议确认对象 | 优先级 |
|------|------|---------|-------------|--------|
| TA-01 | 前端 CSS 方案（纯 CSS 还是 CSS Modules） | 前端开发和构建配置 | Cursor Frontend（TASK-0008 中决定） | 低：不影响架构方向；Tailwind CSS 排除（新增未预算依赖） |
| TA-02 | 生产部署方式（直接 dotnet run、systemd、IIS、还是 Docker） | 部署拓扑 | Architect + hangyu | 低：MVP 优先本地开发；部署在开发完成后评估 |
| TA-03 | 是否需要单独的 API 契约文档（OpenAPI/Swagger）还是代码即文档 | 开发效率和 Reviewer 可读性 | Architect（TASK-0007 中决定） | 低 |

## 24. 完成条件

本架构基线（TASK-0005）完成条件：

1. 架构覆盖全部 12 项 FR 和 7 项 NFR。
2. 架构未修改产品基线的任何 BR、FR、NFR 或 AC。
3. 前后端职责边界明确。
4. 数据持久化方向有清晰裁决和约束。
5. 最小领域边界定义完整（6 个实体、职责和关系）。
6. 项目目录结构每个目录有明确用途。
7. 本地开发、构建和测试命令可执行。
8. 测试策略覆盖全部核心 BR。
9. 安全与角色边界与产品基线 NFR-007、AC-020、AC-037 一致。
10. 性能验收口径与产品基线 NFR-002、AC-018 一致，未发生漂移。
11. 明确列出不实现内容和依赖预算。
12. 后续开发任务已拆分为 11 个可独立审核的小型任务。
13. 未包含业务代码、数据库迁移或项目脚手架。
14. 未出现 MVP 范围扩张或过度设计。
15. 工作流校验 20/20 PASS，`git diff --check` PASS。

---

> **文档结束**
>
> 本架构基线由 Claude + DeepSeek Product Manager 编写，是 TASK-0005 的主要技术产出。
> 下一步：交由 Codex Reviewer 独立审核。
