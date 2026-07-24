# OPT-003 Fix: 完善机柜编号精确匹配

## Problem (from Codex review)

当前 RackCodeHeaderMatcher 只排除编号后紧跟 `-` 的情况，以下仍会误匹配：

| Header | Code | 当前结果 | 期望 |
|---|---|---|---|
| `机柜X2-2[06]` | `2-2[06]` | true | false |
| `机柜2-2[06]B` | `2-2[06]` | true | false |
| `机柜A2-2[06]设备` | `2-2[06]` | true | false |

## Fix

Excel 表头中机柜编号的格式是 `[编号]`（方括号包裹）。正确的匹配方式：

1. 从表头文本中提取所有 `[...]` 内的内容
2. 对每个提取出的编号做**精确相等**比较（不是 Contains）
3. 编号匹配 = 提取的括号内容与 rack.Code 完全相等

## Files

- `src/backend/Datacenter.Api/Services/RackCodeHeaderMatcher.cs`
- 相关测试文件

## Constraints

- 不过度设计
- 增加 Codex 提到的负向测试用例
