# Task 2: CablesController — Purpose 支持

> **Assigned to:** Cursor
> **Depends on:** Task 1
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

让 Create / Import / List 端点支持 Purpose 字段。

## 文件

| 文件 | 操作 |
|------|------|
| `src/backend/Datacenter.Api/Controllers/CablesController.cs` | 修改 |
| `docs/线缆导入模板.xlsx` | 修改 |

## Steps

### 1. CreateCableRequest 加 Purpose

修改 `CreateCableRequest` record，在末尾加 `string? Purpose`：

```csharp
public sealed record CreateCableRequest(
    Guid SourcePortId, Guid TargetPortId, string CableType, string? Color, string? Length, string? Purpose);
```

### 2. Create 方法使用 Purpose

创建 Cable 时使用：

```csharp
Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "正常" : request.Purpose.Trim()
```

### 3. List 端点加 purpose 筛选

- 参数加 `[FromQuery] string? purpose`
- 筛选: `if (!string.IsNullOrWhiteSpace(purpose)) query = query.Where(c => c.Purpose == purpose);`
- Select 投影加 `c.Purpose`

### 4. Import 方法支持 Purpose

- `requiredHeaders` 数组不变（Purpose 可选）
- 读取: `var purpose = RowCell(worksheet, row, headerMap, "线路用途") ?? "正常";`
- 创建 Cable 时使用 `Purpose = purpose`

### 5. 更新 Excel 导入模板

在 `docs/线缆导入模板.xlsx` 表头末尾（"长度"之后）添加"线路用途"列。示例行填"正常"。

### 6. 编译验证

```bash
cd src/backend/Datacenter.Api && dotnet build
```

## Commit

```
feat: add Purpose support to cable create/import/list endpoints
```
