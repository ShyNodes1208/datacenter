# OPT-003: 机柜编号精确匹配

## 现状

`DevicePositionsController` 和 `DevicePositionsBatchController` 中使用 `normalized.Contains(rack.Code)` 匹配机柜编号。如果一个机柜编号是另一个的前缀（如 `2-2[06]` 和 `2-2[06]-B`），短的会误匹配长的表头。

## 要求

改用更精确的匹配逻辑：
- 方案 A：使用正则表达式 `\b` 单词边界匹配
- 方案 B：在表头中提取所有 `[XX]` 格式的编号，精确比较

## Fix

**Files:**
- `src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs`
- `src/backend/Datacenter.Api/Controllers/DevicePositionsBatchController.cs`

找到 `normalized.Contains(rack.Code)` 处，替换为精确匹配逻辑。

## Constraints

- 不过度设计
- 不过度开发
- 确保现有测试仍然通过
