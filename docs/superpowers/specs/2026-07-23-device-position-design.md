# 设备落位图 — 设计文档

## 文档信息

| 属性 | 值 |
|---|---|
| 文档名称 | 设备落位图设计 |
| 创建日期 | 2026-07-23 |
| 状态 | READY_FOR_REVIEW |
| 依赖 | TASK-0020 (机柜导入) |

## 1. 背景

TASK-0020 实现了 Excel 导入机柜（机柜落位图），用户可以在首页导入机柜数据，包括 Code、所属机房、HeightU、X/Y/Z 坐标等。

现需求升级：除了机柜落位图，还需要**设备落位图**——展示每个机柜内部每个 U 位放了什么设备。用户先看到所有机柜的平面排列（按 X/Y/Z 坐标），点击某个机柜后进入新页面查看该机柜的 U 位设备视图。

## 2. 目标

1. 首页展示机房 → 机柜平面布局（机柜落位图）
2. 点击机柜打开新页面，展示该机柜所有 U 位的设备落位视图（U 位数量 = 机柜 HeightU）
3. 支持从 Excel 导入设备落位数据（视觉化格式：机柜分列，U 位从上到下）
4. 先按 2 个机柜做规划，架构为后续扩展更多机柜做准备

## 3. 非目标

- 设备不结构化为名称/IP/型号（存纯文本 Label）
- 不实现 U 位拖拽编辑、设备详情、设备搜索
- 不实现设备上架/下架/移动操作（后续任务）
- 三维视图

## 4. 数据模型

### 4.1 新 Model：DevicePosition

```csharp
public sealed class DevicePosition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RackId { get; set; }
    public Rack Rack { get; set; } = null!;
    public int UNumber { get; set; }          // 1 到 HeightU
    public string? Label { get; set; }         // 设备描述（纯文本）
}
```

### 4.2 约束

| 约束 | 说明 |
|---|---|
| PK `Id` | 主键 |
| FK `RackId → Racks.Id` | 外键，ON DELETE RESTRICT |
| UNIQUE `(RackId, UNumber)` | 同一机柜每个 U 位最多一条记录 |
| `UNumber >= 1` | U 位编号从 1 开始 |

### 4.3 与现有模型关系

```
Room (1) ──> (N) Rack (1) ──> (N) DevicePosition
```

### 4.4 后续扩展路径

当前 `Label` 存纯文本。后续需要结构化时，在 `DevicePosition` 表增加列即可：

- `DeviceName` — 设备名称
- `ManagementIP` — 管理 IP
- `Brand` — 品牌/型号
- `DeviceType` — 设备类型

无需新建表或迁移数据。

## 5. Excel 解析策略

### 5.1 Excel 格式

源文件 `docs/机房机柜.xlsx`（及后续相同格式的文件）：

- **第 1 行**：机柜标识行，每个机柜占 3 列，格式如 `机柜2-2【06】当前A:2.7+B2.6`
  - 列 1: U 位编号
  - 列 2: 设备标签
  - 列 3: U 位编号（校验列）
- **第 2 行起**：数据行，U 位从上到下（42U → 1U）
- **空列**：机柜组之间的分隔
- **空单元格**：该 U 位空闲

### 5.2 机柜编号提取

从第 1 行单元格文本中提取机柜编号：

1. 匹配模式 `机柜<编号>` 或 `<编号>`，编号部分作为 Code
2. **中文符号转英文**：`【`→`[`、`】`→`]`、`（`→`(`、`）`→`)` 等
3. 将 Code 与数据库 `Racks.Code` 做精确匹配（大小写不敏感）

示例：
- 表头：`机柜2-2【06】当前A:2.7+B2.6`
- 提取编号：`2-2【06】` → `2-2[06]`（存入 Rack.Code 时已转换）
- 匹配：`Code == "机柜2-2[06]"`（不区分大小写）

### 5.3 解析流程

```
1. 读取第 1 行，扫描所有非空单元格
2. 对每个非空单元格：
   a. 提取机柜编号
   b. 在数据库中查找匹配的 Rack
   c. 确定该机柜的 3 列范围（列 N = U位编号, 列 N+1 = 设备标签, 列 N+2 = U位校验）
3. 对每个识别出的机柜，从第 2 行起读取：
   a. U 位编号列校验（42→1 或 HeightU→1）
   b. 读取设备标签列
   c. 非空标签生成 DevicePosition 记录
4. 导入时全量覆盖：DELETE 该 RackId 的所有现有记录 → INSERT 新记录
```

### 5.4 冲突策略

| 场景 | 行为 |
|---|---|
| Excel 中某 U 位有设备 | 写入/覆盖该 U 位的 DevicePosition |
| Excel 中某 U 位为空 | 删除该 U 位的已有记录（设备已移除） |
| 机柜编号不匹配 | 跳过此列组，记录警告 |
| U 位编号超出机柜 HeightU | 该行报错，继续处理其他行 |

## 6. API 契约

### 6.1 导入设备落位

```
POST /api/racks/{rackId}/device-positions/import
```

- **Content-Type**: `multipart/form-data`，字段名 `file`，仅 `.xlsx`
- **认证**: 所有登录用户允许；匿名 401
- **CSRF**: 必须校验
- **行为**: 解析指定机柜的设备数据，全量覆盖

**请求**: 文件上传

**成功响应 200**:
```json
{
  "rackId": "guid",
  "rackCode": "机柜2-2[06]",
  "totalUPositions": 42,
  "occupied": 10,
  "empty": 32
}
```

**错误响应**:
- 400 — 文件无效、格式不对
- 404 — Rack 不存在
- 401 — 未登录

### 6.2 查询设备落位

```
GET /api/racks/{rackId}/device-positions
```

- **认证**: 所有登录用户允许；匿名 401

**响应 200**:
```json
{
  "rack": {
    "id": "guid",
    "code": "机柜2-2[06]",
    "roomName": "主机房",
    "heightU": 42,
    "x": 1,
    "y": 2,
    "z": 1
  },
  "positions": [
    { "uNumber": 42, "label": "配线架" },
    { "uNumber": 41, "label": "配线架" },
    { "uNumber": 40, "label": "H3C5600 DC-R06-POC-S56 10.39" },
    { "uNumber": 39, "label": null }
  ],
  "stats": {
    "total": 42,
    "occupied": 10,
    "empty": 32
  }
}
```

`positions` 按 `uNumber` 降序排列（最高 U 位在前，U1 在末尾）。

## 7. 前端设计

### 7.1 路由

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | HomeView | 机房列表 + 机柜落位图（改造） |
| `/racks/:id` | RackDeviceView | 机柜设备落位图（新增） |
| `/login` | LoginView | 登录（不变） |

### 7.2 页面 1：机柜落位图（改造 HomeView）

现有 HomeView 含机房列表 + 机柜导入。改造内容：

- 每个机房展开后显示该机房下的机柜卡片/方块
- 卡片显示：机柜编号、U 位总数、已用/空闲 U 数
- **点击机柜卡片** → 跳转到 `/racks/:id`
- 保留现有机柜导入功能

### 7.3 页面 2：设备落位图（新增 RackDeviceView）

- **路由**: `/racks/:id`
- **顶部**: 面包屑（机房名 > 机柜编号）+ 导入按钮
- **主体**: 左右布局
  - **左侧（宽）**: 二维 U 位视图
    - U1 在顶 → U42 在底（按产品基线，自上而下降序）
    - 每行：U 位编号 | 颜色条（绿色=空闲，蓝色=已占用）| 设备标签
    - 连续相同标签的 U 位在视觉上合并（如配线架占 U41-42）
  - **右侧（窄）**: 容量统计面板
    - U 位总数、已占用数、空闲数
    - 使用率百分比
- **导入**: 点击导入按钮 → 选择 .xlsx → 预览 → 确认 → 刷新视图

### 7.4 导入交互

1. 用户在设备落位页面点击"导入设备"
2. 选择 .xlsx 文件
3. 前端展示预览（该机柜的 U 位占用变化预览）
4. 用户确认 → 调用 import API
5. 完成后刷新 U 位视图

## 8. 架构变更

### 8.1 新增文件

| 文件 | 说明 |
|---|---|
| `Models/DevicePosition.cs` | 新 Model |
| `Migrations/<ts>_AddDevicePositions.cs` | Migration |
| `Migrations/<ts>_AddDevicePositions.Designer.cs` | Migration Designer |
| `Controllers/DevicePositionsController.cs` | API Controller |
| `views/RackDeviceView.vue` | 设备落位图页面 |

### 8.2 修改文件

| 文件 | 说明 |
|---|---|
| `Data/AppDbContext.cs` | 添加 `DbSet<DevicePosition>` + 关系配置 |
| `Migrations/AppDbContextModelSnapshot.cs` | EF 自动更新 |
| `router.ts` | 新增 `/racks/:id` 路由 |
| `views/HomeView.vue` | 改造为机房-机柜布局 |

### 8.3 不新增依赖

复用现有 `ClosedXML 0.104.2`，不引入新包。

## 9. 文件预算

新增（5 个必需）：
1. `Models/DevicePosition.cs`
2. `Controllers/DevicePositionsController.cs`
3. `Migrations/<ts>_AddDevicePositions.cs`
4. `Migrations/<ts>_AddDevicePositions.Designer.cs`
5. `views/RackDeviceView.vue`

修改（4 个）：
6. `Data/AppDbContext.cs`
7. `Migrations/AppDbContextModelSnapshot.cs`
8. `router.ts`
9. `views/HomeView.vue`

**总计：9 个文件**（不含 Migration 时间戳自动生成）。

## 10. 中文符号转换规则

Excel 表头中的中文符号在匹配前转换为英文符号：

| 中文符号 | 英文符号 |
|---|---|
| `【` | `[` |
| `】` | `]` |
| `（` | `(` |
| `）` | `)` |
| `：` | `:` |
| `，` | `,` |
| `；` | `;` |

此规则同时适用于 Excel 导入时机柜编号的匹配和数据库存储。
