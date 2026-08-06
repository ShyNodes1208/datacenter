# Task 1: Cable 模型 — Purpose 字段

> **Assigned to:** Cursor (Frontend/Full-stack)
> **Depends on:** none
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

给 Cable 模型添加 `Purpose` 字段，分类为 正常/存储/上联。

## 文件

| 文件 | 操作 |
|------|------|
| `src/backend/Datacenter.Api/Models/Cable.cs` | 修改 |
| Migration 文件 (EF 自动生成) | 新建 |

## Steps

### 1. 修改 Cable 模型

在 `Models/Cable.cs` 现有属性之后添加：

```csharp
public string Purpose { get; set; } = "正常";
```

### 2. 生成迁移

```bash
cd src/backend/Datacenter.Api
dotnet ef migrations add AddCablePurpose
```

### 3. 在迁移 Up 方法中添加回填 SQL

在生成的 Migration 的 `Up` 方法中，`AddColumn` 之后：

```csharp
migrationBuilder.Sql(@"
    UPDATE ""Cables"" SET ""Purpose"" = '存储'
    WHERE ""CableType"" = 'DAC' AND ""Purpose"" = '正常';

    UPDATE ""Cables"" SET ""Purpose"" = '上联'
    WHERE ""SourcePortId"" IN (
        SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (
            SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" ILIKE '%交换%'
               OR ""DeviceType"" ILIKE '%switch%'
               OR ""DeviceType"" ILIKE '%路由%'
               OR ""DeviceType"" ILIKE '%router%'
        )
    )
      AND ""TargetPortId"" IN (
        SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (
            SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" ILIKE '%交换%'
               OR ""DeviceType"" ILIKE '%switch%'
               OR ""DeviceType"" ILIKE '%路由%'
               OR ""DeviceType"" ILIKE '%router%'
        )
    )
      AND ""Purpose"" = '正常';
");
```

### 4. 应用迁移

```bash
cd src/backend/Datacenter.Api && dotnet ef database update
```

### 5. 编译验证

```bash
cd src/backend/Datacenter.Api && dotnet build
```

## Commit

```
feat: add Purpose column to Cable for logical cable classification
```
