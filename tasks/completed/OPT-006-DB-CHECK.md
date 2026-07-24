# OPT-006: 添加 DevicePosition UNumber CHECK 约束

## 现状

UNumber 有效性只在应用层校验，数据库层没有 `UNumber >= 1` 的 CHECK 约束。

## 要求

添加 EF Migration 为 DevicePositions 表增加 `CK_DevicePositions_UNumber` CHECK 约束。

## Fix

**File:** `src/backend/Datacenter.Api/Data/AppDbContext.cs`

在 DevicePosition 的 entity 配置中添加 CHECK 约束：

```csharp
devicePosition.ToTable("DevicePositions", table =>
{
    table.HasCheckConstraint("CK_DevicePositions_UNumber", "UNumber >= 1");
});
```

然后生成新 Migration：`dotnet ef migrations add AddDevicePositionUNumberCheck`

## Constraints

- 不过度设计
- 确保现有测试通过
