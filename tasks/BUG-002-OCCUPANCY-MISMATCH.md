# BUG-002: 首页机柜卡片与详情页占用率不一致

## Problem

首页机柜卡片 `occupiedU` 只统计 ServerPosition（手动上架服务器），机柜详情页统计 DevicePosition（Excel 导入设备）+ ServerPosition。同一机柜在两个页面显示不同占用率。

## Fix

**File:** `src/backend/Datacenter.Api/Controllers/RacksController.cs`

在 GET /api/racks 的 `occupiedU` 计算中，合并两个数据源：
1. DevicePositions WHERE Label IS NOT NULL
2. ServerPositions WHERE Status = "在架"

取两者的 **UNION**（一个 U 位只要被任一数据源占用就算已用），不去重计数可能重复的 U 位。

例如：Excel 导入 U10-U15 有设备标签，手动上架服务器占 U20-U21 → occupiedU = 6 + 2 = 8

**File:** 对应的集成测试文件

增加测试：同时有 DevicePosition 和 ServerPosition 时，occupiedU 正确包含两者。

## Constraints

- 不过度设计
- 不改变机柜详情页的统计逻辑
