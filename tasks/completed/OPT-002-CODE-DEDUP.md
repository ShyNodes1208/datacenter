# OPT-002: 单柜导入与批量导入代码去重

## 现状

`DevicePositionsController` 和 `DevicePositionsBatchController` 中解析 Excel、检测合并单元格、构建 DevicePosition 的逻辑几乎相同。

## 要求

提取共享的 Excel 解析逻辑到一个独立服务类，两个 Controller 都调用它。

## Fix

**Files:**
- `src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs` — 改为调用共享服务
- `src/backend/Datacenter.Api/Controllers/DevicePositionsBatchController.cs` — 改为调用共享服务
- 新建 `src/backend/Datacenter.Api/Services/DevicePositionExcelParser.cs` — 共享解析逻辑

解析方法输入：`XLWorkbook`, `rack`（或 rackId+rackCode）→ 输出：`Dictionary<int, string?>` (UNumber → Label)

## Constraints

- 不过度设计：只提取真正重复的部分
- 不改变现有行为
- 所有现有测试必须通过
