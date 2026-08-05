# 线缆 Excel 批量导入

## 目标

用 Excel 模板批量导入端口和线缆连接，替代逐条手动录入。施工台账直接导入系统。

## Excel 模板

一个 Sheet，表头如下。模板文件放在 `docs/线缆导入模板.xlsx`，含表头和一行示例数据。

| 列 | 必填 | 说明 |
|----|------|------|
| 源设备 | 是 | 设备名称或管理 IP，用于匹配已有设备 |
| 源端口 | 是 | 端口名，如 GE0/0/1 |
| 源端口类型 | 否 | RJ45 / SFP+ / QSFP28 / LC，端口不存在时自动创建用 |
| 源端口速率 | 否 | 如 1G / 10G，端口不存在时自动创建用 |
| 目标设备 | 是 | 同上 |
| 目标端口 | 是 | 端口名 |
| 目标端口类型 | 否 | 同上 |
| 目标端口速率 | 否 | 同上 |
| 线缆类型 | 是 | 铜缆 / 光纤 / DAC |
| 颜色 | 否 | |
| 长度 | 否 | |

端口处理逻辑：已存在则直接使用（不修改已有属性），不存在则自动创建（使用模板中的类型和速率，不填默认 RJ45）。

## 后端 API

### `POST /api/cables/import`

**请求:** `multipart/form-data`
- `file`: .xlsx 文件（≤10MB）
- CSRF token（Header: `X-XSRF-TOKEN`）
- 需要角色：机房管理员 / 运维人员

**处理流程:**

```
上传 → 解析 Excel → 逐行处理（逐行独立，失败不影响其他行）:
  1. 匹配"源设备"：按 Name 精确匹配 → 按 ManagementIP 精确匹配 → 都不匹配则标记错误
  2. 匹配"目标设备"：同上
  3. 源端口存在性检查：存在则直接用；不存在则自动创建（类型+速率来自模板）
  4. 目标端口存在性检查：同上
  5. 占用检查：任一端口已被其他 Cable 连接 → 标记错误
  6. 自连接检查：源端口 == 目标端口 → 标记错误
  7. 创建 Cable（SourcePortId, TargetPortId, CableType, Color, Length）
→ 返回结果报告
```

- 逐行独立事务：成功行写入数据库，失败行记入 errors 列表
- 同一行内的端口创建 + Cable 创建在同一事务中

**响应:**

```json
{
  "totalRows": 100,
  "successCount": 95,
  "errorCount": 5,
  "errors": [
    { "row": 3, "error": "源设备不存在: xxx" },
    { "row": 7, "error": "源端口已被占用: app-web-01 / GE0/0/1" },
    { "row": 12, "error": "源端口与目标端口相同" },
    { "row": 25, "error": "目标端口已被占用: net-core-sw-01 / GE0/0/5" }
  ]
}
```

**位置:** `CablesController.cs`，新增 `Import` 方法（约 120 行）

## 前端

### 入口

`CableListView.vue` 顶部筛选栏右侧加"导入 Excel"按钮。

### 交互

```
[📥 导入 Excel] → 触发 <input type="file" accept=".xlsx"> → 选择文件 → 自动上传 →

成功:
  ✅ 导入完成：95/100 行成功
  (可展开) 5 行失败详情

失败:
  ❌ 导入失败: (错误信息)
```

### 实现

- 新增 `handleImport(file: File)` 函数
- 用 `FormData` 上传，带 CSRF token
- 上传完成后刷新线缆列表
- 结果展示为可展开的错误详情区域

## 改动范围

| 层 | 文件 | 改动 |
|----|------|------|
| 后端 | `CablesController.cs` | +120 行（Import 方法） |
| 前端 | `CableListView.vue` | +50 行（按钮 + 上传逻辑 + 结果展示） |
| 文档 | `docs/线缆导入模板.xlsx` | 新建（含表头 + 示例行） |
| 文档 | `docs/superpowers/specs/2026-08-05-cable-excel-import-design.md` | 本文件 |

## 不做

- 预览+确认两阶段（第一期保持简单）
- 端口修改（已有端口属性不动）
- LLDP/SNMP 发现（第二期）
- 更新模式（重复导入同一连接不做 upsert，报端口占用错）
