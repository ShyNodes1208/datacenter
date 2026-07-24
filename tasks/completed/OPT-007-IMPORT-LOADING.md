# OPT-007: 导入时增加 loading 指示

## 现状

导入过程中及导入后刷新数据时，没有视觉 loading 指示。

## 要求

- 文件选择后上传解析时显示 loading
- 确认导入写入时显示 loading
- 数据刷新时显示 loading

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`（设备导入部分）

参考 HomeView 的 `importSubmitting` 模式，在导入按钮上显示状态文字：
- 上传中显示"解析中..."
- 导入中显示"导入中..."
- 按钮 disabled 状态已有，补充文字提示即可

## Constraints

- 不过度设计
- 复用现有 `importSubmitting` / `loadingServers` 状态
