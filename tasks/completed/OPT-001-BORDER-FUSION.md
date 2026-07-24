# OPT-001: 合并单元格边框融合

## 现状

多 U 设备已合并为蓝色块，文字已居中。但每个 U 行仍有独立边框（`border-bottom: 1px solid #ccc`），合并块内部行与行之间的边框没有消除，视觉上不像一个完整的合并单元格。

## 要求

合并块内部行之间不显示分隔线，只在合并块最底部显示一条边框。效果类似 Excel 合并单元格。

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

- 合并块内部的 U 行（除最后一行外）去掉 `border-bottom`
- 或者用 `:last-child` / 条件判断只在合并块最后一行显示底部边框

## Constraints

- 不过度设计
- 不破坏现有合并逻辑和按钮位置
