# Change Request CR-0004

## 基本信息

- Change Request ID：CR-0004
- 发现者：Codex Reviewer（TASK-0006 第三次复审报告 RT-003）
- 原任务：TASK-0006（MVP 项目脚手架）
- 变更原因：
  AC-SC-13 当前命令 `grep -ri "coverlet" tests/` 递归扫描整个 tests/ 目录树。在执行 `dotnet build`/`dotnet test` 后，tests/ 下存在 bin/Debug/net8.0/ 中的编译产物 DLL（如 Microsoft.TestPlatform.CrossPlatEngine.dll），其中包含 "coverlet" 字符串。grep 命中该二进制字符串退出码 0，导致 AC-SC-13 FAIL。
  当前实际测试项目 csproj 中不存在 coverlet.collector PackageReference；verify-project.ps1 已使用 `--exclude-dir=bin --exclude-dir=obj` 正确排除构建产物。问题仅在于 AC-SC-13 规范命令范围过宽。
- 产品范围影响：无。
- 技术影响：
  - AC-SC-13 验证命令从递归 tests/ grep 改为结构化 XML 检查（解析 csproj 的 PackageReference）+ 精确文件 grep。
  - verify-project.ps1 无需修改（已正确使用 --exclude-dir=bin --exclude-dir=obj）。
  - 测试依赖预算不变。
  - 不增加或删除任何依赖。
- 文件影响：
  - tasks/TASK-0006-PROJECT-SCAFFOLD.md（AC-SC-13 命令重写）
  - tasks/CR-0004-TASK-0006-COVERLET-VALIDATION-CORRECTION.md（本文件，新建）
- 测试影响：AC-SC-13 验证命令变更；验收语义不变（测试项目不得引用 coverlet.collector）。
- 风险：低。验证方法更精确（结构化 XML 解析 + 精确文件 grep），不依赖二进制产物排除。
- Claude 裁决：批准。
  - 原验收目标不变：测试项目不得直接引用 coverlet.collector。
  - DLL 中出现 "coverlet" 字符串不等于项目包引用。
  - 新验证只检查依赖声明文件（csproj），不扫描 bin、obj、DLL、PDB、TestResults 或其他构建产物。
  - 不允许通过删除构建目录来规避验收。
  - 不允许新增 coverlet.collector。
- Architect 裁决：批准。
  - 不改变项目结构、技术栈、依赖预算或架构基线。
  - XML 结构化检查是更可靠的依赖验证方法。
- 更新后的 Requirement Source：不适用（产品需求不变）。
- 批准状态：APPROVED

## AC-SC-13 验证方法修正

### 原问题

原 AC-SC-13 命令 `grep -ri "coverlet" tests/` 递归扫描整个 tests/ 目录树，包含：
- `tests/backend/Datacenter.Api.Tests/bin/Debug/net8.0/*.dll`（dotnet build 产物）
- `tests/backend/Datacenter.Api.Tests/obj/`（中间构建产物）

`Microsoft.TestPlatform.CrossPlatEngine.dll` 等二进制文件内包含 "coverlet" 字符串，导致 grep 退出码 0（命中），但实际 csproj 中不存在 coverlet.collector PackageReference。

### 修正方案

AC-SC-13 改为两步验证：

**A. 结构化 XML 检查（权威验收证据）**

```bash
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET

path = Path(
    "tests/backend/Datacenter.Api.Tests/"
    "Datacenter.Api.Tests.csproj"
)

root = ET.parse(path).getroot()

references = [
    element.attrib.get("Include", "")
    for element in root.iter()
    if element.tag.endswith("PackageReference")
]

forbidden = [
    reference
    for reference in references
    if reference.lower() == "coverlet.collector"
]

print("PackageReferences:", ", ".join(references))

if forbidden:
    raise SystemExit(
        "Forbidden PackageReference found: coverlet.collector"
    )

print("coverlet.collector PackageReference: absent")
PY
```

期望：退出码 0，输出 `coverlet.collector PackageReference: absent`。

**B. 精确文件 grep（补充检查）**

```bash
grep -ni "coverlet.collector" \
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

期望：无输出，退出码 1。

### 废除

不再使用：
- `grep -ri "coverlet" tests/`（扫描 bin/obj/DLL 导致误判）
- 任何对 tests/ 的递归二进制扫描

### verify-project.ps1 处理

verify-project.ps1 第 159-162 行已正确使用 `grep -ri "coverlet" --exclude-dir=bin --exclude-dir=obj tests/`，排除构建产物目录。实现无需修改。

## 裁决日期

2026-07-18
