# TASK-0020：Excel 导入机柜

## 任务信息

- Task ID：TASK-0020
- Status：READY
- Implementation Started：NO
- Blocker：无；但实施认领前必须等待 TASK-0019 释放重叠的两个前端路径
- Task Owner：Codex Backend（后端先实施并交接后，由 Cursor Frontend 实施前端）
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer
- Branch：`feature/task-0020-import-racks`
- Requirement Source：项目负责人 2026-07-23 书面批准的“Excel 导入机柜”产品需求；`docs/product/MVP-PRODUCT-BASELINE.md` SC-02、6.1-2、BL-10 的本次书面启用裁决
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`；现有 Cookie 认证、CSRF、Room、EF Core SQLite 与首页基线
- Dependency：TASK-0007、TASK-0009；前端实施另依赖 TASK-0019 完成并释放重叠路径
- Module Lock：Architect 规格锁已完成并释放；未认领任何 Backend 或 Frontend 实施锁

## 目标与最小范围

登录用户在首页选择一个 `.xlsx` 文件，先预览逐行校验结果；遇到数据库中已有的同机房同编号机柜时，逐行选择覆盖或跳过，也可取消整次操作；确认后按行导入并展示创建、跳过、覆盖、失败数量和错误。预览不写数据库，取消不调用正式导入接口。

仅实现本需求所需的 Rack 表、两个导入 API、首页导入交互和自动化测试。所有四种现有登录角色均可调用两个端点和使用导入入口；匿名请求返回 401，不增加角色限制。

## Rack 数据模型

```csharp
public sealed class Rack
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public Guid RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public int HeightU { get; set; }
    public string? Brand { get; set; }
    public double? Power { get; set; }
    public string? Notes { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
}
```

数据库约束：

- 主键：`Id`。
- 必填：`Code`、`RoomId`、`HeightU`、`X`、`Y`、`Z`。
- 外键：`RoomId → Rooms.Id`，不启用级联删除，保持现有删除行为。
- 唯一索引：`(RoomId, Code)`，保证同一机房内编号唯一。
- 不增加当前验收未要求的字段、状态、审计表、Service、Repository 或通用导入框架。

## Excel 格式

读取第一个工作表，第一行为列头，数据从第 2 行开始。列头匹配时忽略前后空格；必须存在全部 9 个约定列头，顺序不限。空白数据行忽略，不计入汇总。

| 列头 | 字段 | 必填 | 规则 |
|---|---|---:|---|
| 机柜编号 | `code` | 是 | Trim 后非空；同一机房内唯一 |
| 所在机房 | `roomName` | 是 | Trim 后按不区分大小写匹配已有 `Room.Name` |
| 高度(U) | `heightU` | 是 | 正整数 |
| 品牌 | `brand` | 否 | 空白按 `null` 处理 |
| 额定功率 | `power` | 否 | 数字，单位 kW；空白按 `null` 处理 |
| 备注 | `notes` | 否 | 空白允许 |
| X坐标 | `x` | 是 | 数字 |
| Y坐标 | `y` | 是 | 数字 |
| Z坐标 | `z` | 是 | 数字 |

文件不是 `.xlsx`、工作簿无法读取、首个工作表不存在或必需列头缺失时，返回 400 和 `{ "error": "明确的中文错误" }`。单行字段错误不使预览整体失败，而是写入该行 `errors`。示例错误包括“机柜编号不能为空”“所在机房不能为空”“高度(U)不能为空”“高度(U)必须为正整数”“X坐标必须为数字”“机房 'xxx' 不存在”。

## API 契约

### 1. `POST /api/racks/import-preview`

- Content-Type：`multipart/form-data`；文件字段名 `file`，仅接受 `.xlsx`。
- 认证：所有登录用户允许；匿名 401。
- CSRF：必须校验；缺失或无效返回 400 `{ "error": "防伪令牌缺失或无效" }`。
- 行为：解析并校验，不写数据库；按 Trim 后的 `roomName` 不区分大小写查询 `Room.Id`；检查数据库中的 `(RoomId, Code)` 重复。
- 同一上传文件内重复的 `(RoomId, Code)` 也标记为错误，防止正式导入产生顺序依赖；错误文本为“同一文件内机柜编号重复”。该行不同时作为数据库重复行计数。

成功返回 200：

```json
{
  "rows": [{
    "row": 2,
    "code": "R001",
    "roomName": "主机房",
    "roomId": "guid-or-null",
    "heightU": 42,
    "brand": "华为",
    "power": 5.5,
    "notes": "",
    "x": 1,
    "y": 2,
    "z": 1,
    "errors": [],
    "duplicate": false,
    "existingRackId": null
  }],
  "totalRows": 1,
  "validRows": 1,
  "errorRows": 0,
  "duplicateRows": 0
}
```

`duplicate=true` 仅表示与数据库已有 `(RoomId, Code)` 重复，且 `existingRackId` 返回该记录 Id。`validRows` 为 `errors` 为空的行数，数据库重复行仍可由用户选择覆盖或跳过，计入有效行；`errorRows` 为 `errors` 非空的行数。

### 2. `POST /api/racks/import`

- Content-Type：`application/json`。
- 认证：所有登录用户允许；匿名 401。
- CSRF：必须校验；缺失或无效返回 400 `{ "error": "防伪令牌缺失或无效" }`。
- 请求中的行必须由服务端重新完整校验，不信任 preview 返回值。

请求：

```json
{
  "rows": [{
    "row": 2,
    "action": "create",
    "code": "R001",
    "roomId": "guid",
    "heightU": 42,
    "brand": "华为",
    "power": 5.5,
    "notes": "",
    "x": 1,
    "y": 2,
    "z": 1,
    "existingRackId": null
  }]
}
```

动作语义：

- `create`：新增。`roomId` 必须存在，`code` Trim 后非空，`heightU > 0`；同一请求内或数据库中已存在同机房同编号时该行失败。
- `skip`：不写数据库，计入 `skipped`；无需依赖 `existingRackId`。
- `overwrite`：`existingRackId` 必须存在，并且必须指向与请求 `roomId + code` 相同的现有记录；只更新 `HeightU`、`Brand`、`Power`、`Notes`、`X/Y/Z`，不得修改 `Id`、`Code` 或 `RoomId`。
- 未知 action 作为该行失败。每行独立处理并保存；单行失败不回滚其他成功行，以匹配响应中的逐行 `failed/errors` 语义。
- 保存时仍由数据库唯一索引兜底；竞争导致的唯一冲突仅记为该行失败，不伪装其他数据库异常。

成功返回 200（即使存在行级失败）：

```json
{
  "created": 5,
  "skipped": 2,
  "overwritten": 1,
  "failed": 0,
  "errors": []
}
```

行级错误格式：`{ "row": 3, "error": "机房不存在" }`。请求体为空、`rows` 缺失或不是可处理集合时返回 400，不进入逐行处理。

## 前端交互

- 首页为所有登录用户显示“Excel 导入机柜”入口，仅接受 `.xlsx`。
- 选择文件后获取 CSRF token 并调用 preview；展示总数、有效、错误、重复统计和逐行结果。
- 错误行不可提交。普通有效行固定为 `create`；数据库重复行必须让用户逐行选择“覆盖”或“跳过”，未选择时禁止确认导入。
- “取消”清空本次文件、预览和选择，不调用 `/api/racks/import`。
- 确认时只发送可处理行；提交期间防重复操作；完成后展示 created/skipped/overwritten/failed 与逐行 errors。
- 不新增页面、路由、UI 框架、状态管理库或 Excel 前端解析依赖。

## 验收标准

1. 四种现有角色登录后均能看到并使用导入入口；匿名访问两个 API 均为 401。
2. preview 需要有效 CSRF，只接受字段名 `file` 的 `.xlsx`，读取第一个工作表并按 Trim 后列头名匹配 9 列。
3. 合法 Excel 行被正确解析为约定字段，预览不写数据库，汇总数字准确。
4. 必填缺失、`heightU` 非正整数、`power` 或坐标非数字、机房不存在均产生明确行级错误。
5. `roomName` Trim 后不区分大小写匹配；数据库重复项返回 `duplicate=true` 和正确 `existingRackId`。
6. 同一文件或同一正式请求中的同机房同编号不会创建两条机柜。
7. create 创建字段完整的 Rack；数据库复合唯一索引阻止同机房同编号重复，但允许不同机房使用相同编号。
8. skip 不修改数据库并正确计数；overwrite 只更新由匹配的 `existingRackId` 定位的允许字段，不改变 Id、Code、RoomId。
9. 正式导入重新校验 roomId、必填、正整数、数字、唯一性及 overwrite 目标；单行失败记录 row/error，其他合法行仍成功，汇总准确。
10. 前端对重复行要求逐行选择覆盖/跳过；取消不导入；错误行不可提交；提交中不能重复发送。
11. EF Migration 可应用，Rack 外键禁用级联删除，`(RoomId, Code)` 唯一索引存在。
12. 后端、前端既有测试保持通过，新增集成测试覆盖认证、CSRF、预览校验、create/skip/overwrite、行级失败和数据库约束。

## 文件预算与允许修改

产品输入标注“7 个文件”，但列出的必需文件实际为 9 个，且 EF Core Migration 必须同步 ModelSnapshot。Architect 将最小可执行预算校正为 **10 个必需文件，最多 11 个文件**；第 11 个仅在现有夹具无法完成测试数据准备时使用。Migration 时间戳由实现时自动生成。

新增（5）：

1. `src/backend/Datacenter.Api/Models/Rack.cs`
2. `src/backend/Datacenter.Api/Controllers/RacksController.cs`
3. `tests/backend/Datacenter.Api.Tests/IntegrationTests/RackIntegrationTests.cs`
4. `src/backend/Datacenter.Api/Migrations/<timestamp>_AddRacks.cs`
5. `src/backend/Datacenter.Api/Migrations/<timestamp>_AddRacks.Designer.cs`

修改（5 个必需 + 1 个可选）：

6. `src/backend/Datacenter.Api/Data/AppDbContext.cs`
7. `src/backend/Datacenter.Api/Datacenter.Api.csproj`（仅增加 `ClosedXML` 0.104.2）
8. `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs`（EF 自动生成）
9. `src/frontend/src/views/HomeView.vue`
10. `src/frontend/src/__tests__/router-and-views.test.ts`（按仓库真实路径校正）
11. `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthTestFixture.cs`（可选，仅当测试 seed 必需）

任何额外产品文件、依赖或抽象均需先走 Change Request。实施者必须逐个精确路径检查并认领；不得认领 Backend/Frontend 目录父路径。TASK-0019 当前对第 9、10 项持有 `HANDED_OFF` 锁，释放前不得认领或修改这两个文件。

## 新依赖与复杂度预算

- 允许新增依赖：后端 `ClosedXML` **0.104.2**（MIT），仅用于读取 `.xlsx`。
- 允许新增抽象：0；直接在 `RacksController` 内实现当前两个端点所需的最小私有辅助逻辑。
- 允许数据模型变化：仅上述 Rack 实体、关系、约束、Migration 和 Snapshot。
- 允许 API 变化：仅上述两个 `/api/racks` POST 端点。
- 复杂方案采用理由：N/A；单 Controller + ClosedXML + EF Core 为当前最小方案。

## 明确不做

- 机柜列表、详情、编辑、删除页面或 API。
- 机柜导出、模板下载、`.xls`/CSV、多个工作表导入。
- 2D/3D 视图、搜索、排序、筛选、分页、批量编辑。
- 后台任务、导入历史、回滚、通用导入引擎、Service、Repository、新组件库。

## 测试与验证命令

```powershell
dotnet test
Set-Location src/frontend
npm test
npm run typecheck
npm run build
Set-Location ../..
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
```

## Reviewer 独立性与交接

- Owner 与 Reviewer 不同：是。
- Backend/Frontend 实施者与最终 Reviewer 不同：是。
- 例外：N/A；无需 hangyu 例外批准。
- Workflow：`DRAFT → READY`；尚未进入 `IN_PROGRESS`。
- 2026-07-23：PM 产品范围已书面批准；Codex Architect 完成数据模型、API、文件预算、验收标准和冲突前置条件，执行 `DRAFT → READY`。
- 下一动作：待 TASK-0019 完成并释放重叠前端锁后，Codex Backend 在 feature 分支检查全部目标路径冲突，只认领后端精确实施路径并进入 `IN_PROGRESS`；后端交接后由 Cursor Frontend 独立认领前端路径。

## 完成门禁

最终必须由 Codex Reviewer 确认验收、构建与测试、迁移、CSRF/认证、文件预算、防过度开发检查全部通过；所有实施锁释放；提交已推送；工作区干净且本地/远端哈希一致，方可转为 `COMPLETED`。当前上述完成证据均为 N/A：尚未实施。
