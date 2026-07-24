# OPT-003 Fix 2: 修复嵌套方括号误匹配

## Problem (from Codex re-review)

表头 `[2-2[06]]` 会提取出两个"编号"：`2-2[06]` 和 `06`。如果存在编号为 `06` 的机柜，`2-2[06]` 的列会被错误匹配给 `06`。

## Fix

**File:** `src/backend/Datacenter.Api/Services/RackCodeHeaderMatcher.cs`

解析完一个最外层 `[...]` 后，将外层循环位置推进到对应的结束 `]`，不再将其内部的 `[` 作为新的编号起点。

## Test

新增负向用例：
```
[InlineData("机柜[2-2[06]]", "06", false)]
```

## Constraints

- 不过度设计
- 最小改动
