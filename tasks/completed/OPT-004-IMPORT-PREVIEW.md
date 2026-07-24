# OPT-004: 设备导入前增加预览步骤

## 现状

RackDeviceView 中选择 Excel 文件后直接导入，用户无法预览内容。DevicePosition 导入是全量覆盖，选错文件会立即覆盖已有数据。

## 要求

文件选择后先展示预览（显示将要导入的设备列表），用户确认后再执行导入。

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

参考 HomeView 机柜导入的两步流程（uploadPreview → submitImport）：
1. 选文件 → 调用后端预览端点获取即将导入的数据
2. 展示预览列表（U位、设备标签）
3. 用户确认后真正执行导入

**Backend:** 检查 `POST /api/racks/{id}/device-positions/import` 是否支持预览，或需要新增预览端点。

## Constraints

- 不过度设计
- 不过度开发
- 复用 HomeView 导入的两步模式
