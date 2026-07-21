# 机房管理 — 最小业务功能设计

## 1. 文档信息

| 属性 | 值 |
|------|-----|
| 文档名称 | 机房管理最小业务功能设计 |
| 创建日期 | 2026-07-21 |
| 来源 | hangyu 提出的企业机房服务器落位可视化需求 |
| 产品基线 | docs/product/MVP-PRODUCT-BASELINE.md (TASK-0004) |
| 架构基线 | docs/architecture/MVP-ARCHITECTURE-BASELINE.md (TASK-0005) |
| 作者 | Claude + DeepSeek Product Manager |
| 状态 | DRAFT |
| 对应架构任务 | TASK-0009（概念引用，本设计不创建该任务文件） |

## 2. 设计概述

### 2.1 业务目标

允许授权用户创建、查看列表、查看详情和编辑机房信息。机房是机柜的物理容器，是系统数据模型的顶层实体。

### 2.2 使用者

| 角色 | 权限 |
|------|------|
| 机房管理员 | 创建、查看、编辑 |
| 运维人员 | 创建、查看、编辑 |
| DBA/应用运维人员 | 仅查看（列表、详情） |
| 只读查看人员 | 仅查看（列表、详情） |
| 匿名用户 | 无权限（API 返回 401，页面重定向到 /login） |

### 2.3 解决的问题

- 登录后用户看到空白占位页，无任何业务操作可执行
- 机柜无处归属（机柜必须属于一个机房）
- 后续所有业务实体（Cabinet、Server）缺少顶层组织容器

### 2.4 非目标

- 不实现删除机房
- 不实现停用/启用状态切换
- 不实现机房内机柜列表预览（机柜实体尚不存在）
- 不实现搜索、筛选或分页
- 不实现批量操作
- 不修改登录或认证模块
- 不创建导航菜单系统
- 不提前创建 Cabinet、Server 或其他未来实体

## 3. 数据设计

### 3.1 Room 实体

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| Id | int | PK, auto-increment | 主键 |
| Name | string | required, unique | 机房名称，全局唯一 (BR-027) |
| Location | string? | optional | 物理位置描述（楼层、建筑等） |
| Notes | string? | optional | 备注信息 |
| CreatedAt | DateTime | required, UTC | 创建时间 |
| UpdatedAt | DateTime | required, UTC | 最后更新时间 |

**明确不包含的字段：**
- `IsActive`（停用/启用状态）：BR-028 需要的字段，但本任务不实现停用校验逻辑。后续加一个 boolean 列只产生一次迁移，现在加入属于"提前建设"。留给 Cabinet 任务。

### 3.2 数据库约束

- Name 唯一索引：`CREATE UNIQUE INDEX IX_Rooms_Name ON Rooms(Name)`
- Name 不可为空
- CreatedAt / UpdatedAt 由服务端设置，不接受客户端传入

### 3.3 DbContext 变更

在 `AppDbContext.cs` 中新增：

```
public DbSet<Room> Rooms => Set<Room>();
```

在 `OnModelCreating` 中新增 Room 实体配置（Name 唯一索引、必填约束）。

## 4. API 设计

### 4.1 端点清单

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| GET | /api/rooms | 需要 | 全部 | 返回全部机房列表 |
| GET | /api/rooms/{id} | 需要 | 全部 | 返回单个机房详情 |
| POST | /api/rooms | 需要 | 管理员、运维 | 创建机房 |
| PUT | /api/rooms/{id} | 需要 | 管理员、运维 | 编辑机房 |

### 4.2 请求/响应格式

**GET /api/rooms** → `200 OK`

```json
[
  {
    "id": 1,
    "name": "A栋-3楼-机房A",
    "location": "A栋3楼东侧",
    "notes": "核心业务机房",
    "createdAt": "2026-07-21T10:00:00Z",
    "updatedAt": "2026-07-21T10:00:00Z"
  }
]
```

空列表返回 `[]`（非 404）。

**GET /api/rooms/{id}** → `200 OK`（单对象，格式同上）或 `404`

**POST /api/rooms**

请求体：
```json
{
  "name": "A栋-3楼-机房A",
  "location": "A栋3楼东侧",
  "notes": "核心业务机房"
}
```

成功 → `201 Created`，响应体为创建的 Room 对象（含 Id、CreatedAt、UpdatedAt）。

失败 → `400 Bad Request`：
```json
{
  "error": "机房名称已存在"
}
```

**PUT /api/rooms/{id}**

请求体（所有字段均可选，仅更新传入字段）：
```json
{
  "name": "A栋-3楼-机房A（更新）",
  "location": "新位置",
  "notes": "更新备注"
}
```

成功 → `200 OK`，响应体为更新后的 Room 对象。

失败 → `400 Bad Request`（名称重复等）、`404 Not Found`。

### 4.3 错误响应

| 场景 | HTTP 状态码 | error 消息示例 |
|------|------------|---------------|
| Name 为空 | 400 | "机房名称不能为空" |
| Name 重复（创建） | 400 | "机房名称已存在" |
| Name 重复（编辑，与其他机房冲突） | 400 | "机房名称已存在" |
| 资源不存在 | 404 | "机房不存在" |
| 未认证 | 401 | "需要登录" |
| 角色权限不足（只读角色执行 POST/PUT） | 403 | "权限不足" |
| 服务端未预期错误 | 500 | "服务内部错误" |

### 4.4 URL 设计裁决

使用 `/api/rooms`（复数），与 ASP.NET Core 约定和控制器的 `[Route("api/rooms")]` 一致。不使用 `/api/room`（单数）。

## 5. 后端设计

### 5.1 分层职责

```
RoomsController  ←  HTTP 请求/响应、模型绑定、角色授权、Antiforgery
      │
      ▼
RoomService       ←  业务逻辑、名称唯一性校验、数据访问
      │
      ▼
AppDbContext      ←  EF Core、SQLite 持久化
```

- Controller 不包含业务逻辑
- Service 直接使用 DbContext（不引入 Repository 抽象）
- 不使用 DTO 或 AutoMapper——手动映射 Room 实体到响应 JSON

### 5.2 RoomService

```csharp
public class RoomService(AppDbContext db)
{
    public async Task<List<Room>> GetAllAsync() { ... }
    public async Task<Room?> GetByIdAsync(int id) { ... }
    public async Task<(Room? Room, string? Error)> CreateAsync(string name, string? location, string? notes) { ... }
    public async Task<(Room? Room, string? Error)> UpdateAsync(int id, string? name, string? location, string? notes) { ... }
}
```

- `CreateAsync`：校验 Name 非空 → 校验 Name 唯一 → 创建 Room（设置 CreatedAt/UpdatedAt 为 UTC now）→ SaveChanges → 返回
- `UpdateAsync`：查询 Room → 不存在返回 null → 如修改 Name，校验非空且不与**其他** Room 冲突 → 更新字段 → UpdatedAt = UTC now → SaveChanges → 返回
- 不使用 `FindAsync` 后分离 DbContext 的模式——所有操作在同一上下文完成

### 5.3 RoomsController

```csharp
[Authorize]
[ApiController]
[Route("api/rooms")]
public class RoomsController(RoomService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() { ... }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id) { ... }

    [HttpPost]
    [Authorize(Roles = "机房管理员,运维人员")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest request) { ... }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "机房管理员,运维人员")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoomRequest request) { ... }
}
```

- 角色字符串使用 `Roles` 静态类中定义的常量（`Roles.RoomAdministrator`、`Roles.Operations`）
- `CreateRoomRequest` 和 `UpdateRoomRequest` 为 Controller 内部使用的简单记录类型（record），不放独立文件
- `[ValidateAntiForgeryToken]` 仅用于状态变更端点（POST/PUT），GET 不要求

### 5.4 时间处理

- 所有时间字段使用 UTC（`DateTime.UtcNow`）
- 响应中直接返回 UTC 时间戳，前端负责按需格式化展示
- 不引入 `DateTimeOffset` 或时区库

### 5.5 数据库迁移

EF Core 迁移在 `src/backend/Datacenter.Api/` 目录下执行：

```bash
dotnet ef migrations add AddRooms --project src/backend/Datacenter.Api
```

迁移自动生成：
- `Migrations/{timestamp}_AddRooms.cs`
- `Migrations/{timestamp}_AddRooms.Designer.cs`
- 更新 `Migrations/AppDbContextModelSnapshot.cs`

**迁移前必须确认**：开发数据库文件（`datacenter-dev.db`）存在于 `.gitignore` 排除路径；迁移只影响代码文件，不直接操作运行中的数据库。

## 6. 前端设计

### 6.1 路由变更

在 `router.ts` 中：

```typescript
routes: [
  { path: '/login', component: LoginView },
  { path: '/', redirect: '/rooms' },                    // 从 HomeView 改为重定向
  { path: '/rooms', component: RoomListPage, meta: { requiresAuth: true } },
  { path: '/rooms/:id', component: RoomDetailPage, meta: { requiresAuth: true } },
]
```

- `/` 直接重定向到 `/rooms`，不再渲染 HomeView
- HomeView.vue 文件保留（不删除），但在路由中不再引用
- `:id` 使用数字路由参数

### 6.2 RoomListPage.vue

**状态：**

```
rooms: Room[]           ← GET /api/rooms 的结果
loading: boolean        ← 初始加载中
error: string | null    ← 请求失败时显示
```

**模板结构：**

```
<Page title="机房列表">
  <Error v-if="error" :message="error" />
  <Loading v-else-if="loading" />
  <Empty v-else-if="!rooms.length" message="暂无机房，请创建第一个机房" />
  <Table v-else>
    <tr v-for="room in rooms" @click="goToDetail(room.id)">
      <td>{{ room.name }}</td>
      <td>{{ room.location || '—' }}</td>
    </tr>
  </Table>
  <button v-if="canCreate" @click="goToCreate">新建机房</button>
</Page>
```

- `canCreate`：基于 `useAuth().user.role` 判断，管理员或运维为 true
- 点击行导航到 `/rooms/:id`
- "新建机房"按钮导航到 `/rooms/:id` 的创建模式（或使用新路由 `/rooms/new`）

**创建模式裁决：**

机房创建使用独立路由 `/rooms/new` 还是模态框？裁决如下：

- 使用 `/rooms/new` 路由，渲染 RoomDetailPage 的创建变体
- 或者：在 RoomListPage 上使用内联表单（不离开列表页）

**最终裁决：** 使用内联表单——在 RoomListPage 点击"新建机房"后，在列表上方展开一个简单表单（Name + Location + Notes + 提交/取消按钮）。理由：
1. 机房字段少（3 个），不需要独立页面
2. 减少路由和页面文件数量
3. 创建成功后直接刷新列表，无需页面跳转

**内联表单交互：**
- 点击"新建机房"→ 表单区域展开，按钮变为禁用
- 填写 Name（必填）、Location（可选）、Notes（可选）
- 提交 → POST /api/rooms → 成功：关闭表单、追加到列表顶部或重新加载列表 → 失败：展示错误
- 取消 → 关闭表单，清空输入

### 6.3 RoomDetailPage.vue

**状态：**

```
room: Room | null       ← GET /api/rooms/{id} 的结果
loading: boolean
error: string | null
editing: boolean        ← 是否处于编辑模式
editForm: { name, location, notes }
saveError: string | null
```

**查看模式模板：**

```
<Page :title="room?.name || '机房详情'">
  <Error v-if="error" :message="error" />
  <Loading v-else-if="loading" />
  <template v-else-if="room">
    <dl>
      <dt>名称</dt><dd>{{ room.name }}</dd>
      <dt>位置</dt><dd>{{ room.location || '—' }}</dd>
      <dt>备注</dt><dd>{{ room.notes || '—' }}</dd>
      <dt>创建时间</dt><dd>{{ formatDate(room.createdAt) }}</dd>
      <dt>更新时间</dt><dd>{{ formatDate(room.updatedAt) }}</dd>
    </dl>
    <button v-if="canEdit" @click="startEdit()">编辑</button>
    <RouterLink to="/rooms">← 返回列表</RouterLink>
  </template>
</Page>
```

**编辑模式（editing = true）：**

在查看模式基础上，详情区域切换为表单：

```
<form @submit.prevent="save">
  <label>名称 <input v-model="editForm.name" required /></label>
  <label>位置 <input v-model="editForm.location" /></label>
  <label>备注 <textarea v-model="editForm.notes"></textarea></label>
  <Error v-if="saveError" :message="saveError" />
  <button type="submit">保存</button>
  <button type="button" @click="cancelEdit">取消</button>
</form>
```

- `canEdit`：同 RoomListPage，管理员或运维为 true
- `startEdit()`：`editForm = { name: room.name, location: room.location, notes: room.notes }`
- `cancelEdit()`：恢复原值，`editing = false`，`saveError = null`
- `save()`：PUT /api/rooms/{id} → 成功：更新 `room`、`editing = false` → 失败：显示 `saveError`
- 不使用 `<RouterLink>` 做保存后的导航——用户留在详情页看到更新结果

### 6.4 数据获取

使用已有的 `useApi()` composable：

```typescript
import { useApi } from '../composables/useApi'

const api = useApi()

// GET 列表
const rooms = await api.get('/api/rooms')

// POST 创建
const result = await api.post('/api/rooms', { name, location, notes })

// PUT 更新
const result = await api.put(`/api/rooms/${id}`, { name, location, notes })
```

- `useApi` 已处理 CSRF token（POST/PUT 自动附加 header）
- `useApi` 已处理 401 响应
- 不引入 Axios 或其他 HTTP 库

### 6.5 角色 UI 控制

```typescript
import { useAuth } from '../composables/useAuth'

const { user } = useAuth()
const canModify = computed(() =>
  user.value?.role === '机房管理员' || user.value?.role === '运维人员'
)
```

- 仅前端 UX 控制——后端独立校验角色
- 不存储角色常量到独立文件（直接用字符串比较，与已有 LoginView 一致）

## 7. 组件设计

### 7.1 不新建通用组件

本任务不创建通用表单组件、通用表格组件或通用错误组件。RoomListPage 和 RoomDetailPage 各自内联其 UI 结构。当后续任务（Cabinet、Server）出现第三次重复时，再评估提取。

**唯一的复用：** 如有需要，RoomListPage 和 RoomDetailPage 可共享简单的日期格式化函数（`formatDate`），放在页面文件内或一个最小 `utils/date.ts` 中。

### 7.2 CSS

- 使用纯 CSS（scoped `<style>`），与 TASK-0008 的 LoginView/HomeView 一致
- 不引入 Tailwind CSS、CSS Modules 或 CSS-in-JS
- 如 TA-01（架构基线待确认事项）尚未裁决，本任务默认使用纯 scoped CSS

## 8. 数据流

### 8.1 机房列表加载

```
RoomListPage mounted
  → api.get('/api/rooms')
    → browser fetch → HTTP GET /api/rooms + Cookie + CSRF (not validated for GET)
      → RoomsController.GetAll()
        → RoomService.GetAllAsync()
          → db.Rooms.ToListAsync()
        ← List<Room>
      ← 200 OK + JSON
    ← Room[]
  → 渲染列表（或空状态/错误状态）
```

### 8.2 机房创建

```
用户填写内联表单 → 点击提交
  → api.post('/api/rooms', body)
    → browser fetch → HTTP POST /api/rooms + Cookie + CSRF header
      → [ValidateAntiForgeryToken] → [Authorize(Roles)] → RoomsController.Create()
        → RoomService.CreateAsync(name, location, notes)
          → 校验 Name 非空
          → 校验 Name 唯一 (db.Rooms.AnyAsync)
          → 创建 Room 实体
          → db.Rooms.Add + db.SaveChangesAsync
        ← (Room, null)
      ← 201 Created + JSON
    ← Room
  → 关闭表单，Room 加入列表
```

### 8.3 机房编辑

```
用户在 RoomDetailPage 点击编辑 → 修改字段 → 保存
  → api.put('/api/rooms/{id}', body)
    → browser fetch → HTTP PUT /api/rooms/{id} + Cookie + CSRF header
      → [ValidateAntiForgeryToken] → [Authorize(Roles)] → RoomsController.Update()
        → RoomService.UpdateAsync(id, name, location, notes)
          → 查询 Room by Id（不存在 → null → 404）
          → 如修改 Name：校验非空 + 唯一（排除自身）
          → 更新字段 + UpdatedAt = UtcNow
          → db.SaveChangesAsync
        ← (Room, null)
      ← 200 OK + JSON
    ← Room
  → 更新页面展示，退出编辑模式
```

## 9. 错误处理

### 9.1 后端

- Service 返回 `(T? Result, string? Error)` 元组——不使用异常做控制流
- Controller 将 Error 映射为 HTTP 状态码和 JSON 响应体
- 未预料的异常由 ASP.NET Core 全局异常中间件捕获，返回 500
- 不引入全局异常过滤器或 ProblemDetails 中间件

### 9.2 前端

- `useApi` 已处理网络错误和 401，返回 `{ error: string }` 格式
- 页面组件解析 API 错误并在 UI 中展示
- 表单提交失败保留用户输入，不清空表单
- 不使用 toast 通知（保持与 LoginView 一致的内联错误展示）

## 10. 测试策略

### 10.1 后端单元测试（xUnit，无数据库）

新增 `tests/backend/Datacenter.Api.Tests/UnitTests/RoomUnitTests.cs`：

- Name 为空时 `CreateAsync` 返回错误
- Name 为空白字符串时 `CreateAsync` 返回错误

（Room 的核心逻辑是名称校验和唯一性校验。唯一性依赖数据库，留在集成测试。单元测试只覆盖纯逻辑的输入校验。）

### 10.2 后端集成测试（xUnit + SQLite 文件 + WebApplicationFactory）

新增 `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`：

| 测试场景 | 预期 |
|---------|------|
| 管理员创建机房成功 | 201，响应含 Id、Name、CreatedAt |
| 创建机房时 Name 为空 | 400 |
| 创建机房时 Name 重复 | 400，error 含"已存在" |
| 获取全部机房列表（含空列表） | 200，返回数组 |
| 获取单个机房 | 200，返回正确机房 |
| 获取不存在的机房 | 404 |
| 管理员编辑机房成功 | 200，UpdatedAt 已更新 |
| 编辑时 Name 与其他机房重复 | 400 |
| 编辑不存在的机房 | 404 |
| 匿名用户访问任意 API | 401 |
| 只读角色创建机房 | 403 |
| 只读角色编辑机房 | 403 |
| 运维人员创建/编辑机房 | 成功（200/201） |
| POST/PUT 无 CSRF Token | 400（Antiforgery 验证失败） |

### 10.3 前端测试（Vitest）

新增 `src/frontend/src/__tests__/room-views.test.ts`：

遵循 TASK-0008 建立的 SSR 视图测试模式（`renderToString` + `createSSRApp` + composable mock，不依赖 `@vue/test-utils` 或 jsdom）：

- RoomListPage SSR 渲染不崩溃，空列表时包含"暂无"提示文本
- RoomListPage SSR 渲染包含机房数据时，输出包含 Name 文本
- RoomDetailPage SSR 渲染包含 room 数据时不崩溃
- 路由 `/rooms` 和 `/rooms/:id` 的 `requiresAuth` 守卫行为正确（复用已有守卫模式）
- 不测试 DOM 交互（点击、表单输入），不引入 `@vue/test-utils`

### 10.4 不测试的内容

- 浏览器兼容性（手动验收，AC-019）
- 性能（TASK-0016 统一验收）
- UI 样式细节

## 11. 文件预算

### 11.1 新增文件（8 个）

| # | 文件 | 说明 |
|---|------|------|
| 1 | `src/backend/Datacenter.Api/Models/Room.cs` | Room 实体 |
| 2 | `src/backend/Datacenter.Api/Services/RoomService.cs` | 业务逻辑 |
| 3 | `src/backend/Datacenter.Api/Controllers/RoomsController.cs` | API 端点 |
| 4 | `src/frontend/src/views/RoomListPage.vue` | 列表页 + 内联创建表单 |
| 5 | `src/frontend/src/views/RoomDetailPage.vue` | 详情页 + 内联编辑表单 |
| 6 | `tests/backend/Datacenter.Api.Tests/UnitTests/RoomUnitTests.cs` | 后端单元测试 |
| 7 | `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs` | 后端集成测试 |
| 8 | `src/frontend/src/__tests__/room-views.test.ts` | 前端 SSR 视图测试 |

### 11.2 修改文件（2 个）

| # | 文件 | 变更 |
|---|------|------|
| 1 | `src/backend/Datacenter.Api/Data/AppDbContext.cs` | 新增 `DbSet<Room>` + OnModelCreating 配置 |
| 2 | `src/frontend/src/router.ts` | 新增 `/rooms`、`/rooms/:id` 路由，`/` 改为重定向 |

### 11.3 自动生成文件（3 个）

| # | 文件 | 说明 |
|---|------|------|
| — | `src/backend/Datacenter.Api/Migrations/{ts}_AddRooms.cs` | EF Core 迁移 |
| — | `src/backend/Datacenter.Api/Migrations/{ts}_AddRooms.Designer.cs` | 迁移设计器文件 |
| — | `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs` | 自动更新快照 |

### 11.4 文件预算汇总

- 新增：7（或 8，取决于前端测试模式）
- 修改：2
- 自动生成：3（EF Core 迁移）
- **不修改**：Program.cs、AuthController.cs、AuthService.cs、User.cs、LoginView.vue、HomeView.vue、useAuth.ts、useApi.ts、package.json、.csproj、appsettings.json

## 12. 依赖预算

**零新增依赖。** 所有实现使用已批准的现有依赖：

- 后端：ASP.NET Core、EF Core Sqlite、`PasswordHasher<TUser>`（已有）
- 前端：Vue 3、Vue Router 4、TypeScript、Vite（已有）
- 测试：xUnit、`Microsoft.AspNetCore.Mvc.Testing`、Vitest（已有）
- HTTP：浏览器 fetch（已有 `useApi` 封装）

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Room 实体字段后期不足 | 需要新增字段和迁移 | 字段随时可通过新迁移添加；Name/Location/Notes 覆盖企业机房最小描述需求 |
| 不建 IsActive 导致后续任务需要额外迁移 | 多一次迁移 | 加一个 boolean 列的迁移成本极低，接受此成本 |
| RoomListPage 内联创建表单在字段增多时不够用 | 需要重构为独立页面 | 当前仅 3 字段；明确约束：字段超过 5 个时才拆分为独立创建页 |

## 14. 防过度设计检查

| 检查项 | 状态 |
|--------|------|
| 未引入未批准依赖 | ✅ PASS |
| 未创建 Repository 抽象 | ✅ PASS — Service 直接使用 DbContext |
| 未创建 DTO/AutoMapper | ✅ PASS — 手动映射 |
| 未创建通用基类（BaseController、BaseService） | ✅ PASS |
| 未创建通用组件（AppTable、AppForm） | ✅ PASS — 各自内联 |
| 未引入 Pinia、Axios、UI 组件库 | ✅ PASS |
| 未创建导航菜单系统 | ✅ PASS — 仅加路由 |
| 未提前创建 Cabinet/Server 实体 | ✅ PASS |
| 未添加 IsActive 字段 | ✅ PASS — 明确留给后续任务 |
| 未添加不必要的 API 端点（DELETE、PATCH） | ✅ PASS — 仅 CRUD 四端点 |

## 15. 防过度开发检查

| 检查项 | 状态 |
|--------|------|
| 未实现 BR-028（停用校验） | ✅ PASS — IsActive 不存在 |
| 未实现 BR-018（有机柜时禁止删除） | ✅ PASS — 不暴露 DELETE |
| 未实现搜索/筛选/分页 | ✅ PASS — 列表直接全量返回 |
| 未实现批量操作 | ✅ PASS |
| 未修改登录/认证/CSRF 模块 | ✅ PASS |
| 未新增产品基线未要求的页面 | ✅ PASS — 仅 PAGE-001 + PAGE-002 |
| 未实现前端菜单/NavBar | ✅ PASS |
| 所有实现可追踪到 AC | ✅ 待 AC 确认 |

## 16. 验收标准

### AC-R01：机房列表 — 空状态
**Given** 已认证用户（任意角色）且系统中无机房记录
**When** 访问 `/rooms`
**Then** 页面显示"暂无机房"提示；管理员/运维看到"新建机房"按钮，只读角色不看到该按钮

### AC-R02：机房列表 — 数据展示
**Given** 系统中存在至少 1 个机房
**When** 已认证用户访问 `/rooms`
**Then** 列表显示每个机房的 Name 和 Location；点击行导航到 `/rooms/:id`

### AC-R03：创建机房 — 成功
**Given** 管理员或运维人员已登录
**When** 在机房列表页点击"新建机房"，填写 Name + Location + Notes，提交
**Then** 机房创建成功；列表刷新显示新机房；Name/Location 与输入一致

### AC-R04：创建机房 — Name 必填
**Given** 管理员或运维人员已登录
**When** 提交创建表单时 Name 为空
**Then** 前端阻止提交（HTML required），后端同样校验（返回 400）

### AC-R05：创建机房 — Name 唯一
**Given** 管理员或运维人员已登录，系统中已存在名为"核心机房"的机房
**When** 尝试创建另一个名为"核心机房"的机房
**Then** 后端返回 400，error 消息包含"已存在"；前端展示错误，表单保留用户输入

### AC-R06：查看机房详情
**Given** 系统中存在一个机房
**When** 已认证用户访问 `/rooms/:id`
**Then** 页面显示 Name、Location、Notes、创建时间、更新时间

### AC-R07：编辑机房 — 成功
**Given** 管理员或运维人员已登录，查看某机房详情
**When** 点击"编辑"，修改 Name 或 Location 或 Notes，保存
**Then** 页面更新显示新值；UpdatedAt 更新

### AC-R08：编辑机房 — Name 冲突
**Given** 管理员或运维人员已登录，系统中存在机房 A 和机房 B
**When** 编辑机房 A，将 Name 改为与机房 B 相同的名称，保存
**Then** 后端返回 400，error 消息包含"已存在"；机房 A 名称不变

### AC-R09：只读角色拒绝创建
**Given** DBA/应用运维人员或只读查看人员已登录
**When** 直接 POST /api/rooms（绕过前端 UI）
**Then** 后端返回 403；数据库无变化

### AC-R10：只读角色拒绝编辑
**Given** DBA/应用运维人员或只读查看人员已登录
**When** 直接 PUT /api/rooms/1（绕过前端 UI）
**Then** 后端返回 403；数据库无变化

### AC-R11：匿名用户拒绝访问
**Given** 未登录
**When** 访问 `/rooms` 页面
**Then** 路由守卫重定向到 `/login`

### AC-R12：匿名用户拒绝 API
**Given** 未登录
**When** 直接 GET /api/rooms
**Then** 后端返回 401

### AC-R13：CSRF 保护
**Given** 管理员已登录
**When** 发送 POST /api/rooms 不带 CSRF Token
**Then** 后端拒绝请求（Antiforgery 验证失败）；数据库无变化

### AC-R14：登录后自动进入机房列表
**Given** 用户未登录
**When** 完成登录
**Then** 自动导航到 `/rooms`（而非之前的 HomeView 占位页）

### AC-R15：现有测试保持通过
**Given** 本任务修改了 router.ts 和 AppDbContext.cs
**When** 运行全量测试
**Then** 前端现有 44 个测试和后端现有 28 个测试保持通过（或需要因路由变更做最小适配）

## 17. 实现提示（非规范性）

以下不是规格要求，只帮助实施 Agent 理解上下文：

- TASK-0007 的 `AuthTestFixture` 提供了集成测试的基础设施（`WebApplicationFactory`、测试数据库初始化），本任务的集成测试可复用
- TASK-0007 的 `AuthController` 展示了 Controller 结构和 `[ValidateAntiForgeryToken]` 用法
- TASK-0008 的 `LoginView.vue` 展示了表单提交、错误展示和 `useApi`/`useAuth` 使用模式
- `router.ts` 中 `/` 从 HomeView 改为重定向后，HomeView.vue 文件保留不删（Git 历史完整性）

---

> **文档结束**
>
> 本设计文档由 Claude + DeepSeek Product Manager 编写。
> 下一步：自检 → 用户审阅 → 进入 writing-plans 技能编写实施计划。
