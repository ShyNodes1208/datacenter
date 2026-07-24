# OPT-005: 机柜卡片显示占用统计

## 现状

HomeView 机柜卡片只显示编号和 U 位数，未显示已用/空闲 U 数。

## 要求

机柜卡片增加显示：
- 已用 U 数 / 总 U 数
- 或简单的占用百分比

## Fix

**Files:**
- `src/backend/Datacenter.Api/Controllers/RacksController.cs` — GET /api/racks 返回占用统计
- `src/frontend/src/views/HomeView.vue` — 机柜卡片显示统计

### Backend
在 GET /api/racks 的返回中增加 `occupiedU` 字段。可 JOIN ServerPositions (Status="在架") 统计每个机柜的占用 U 数。

### Frontend
在机柜卡片中增加一行显示：`已用 10/42U (24%)`

## Constraints

- 不过度设计：轻量统计，不新建端点
- 不过度开发
