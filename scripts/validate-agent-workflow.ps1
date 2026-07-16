# Compatible with Windows PowerShell 5.1 and PowerShell 7.
[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$script:PassCount = 0
$script:FailCount = 0

function Write-Check {
    param([int]$Number, [bool]$Passed, [string]$Message)
    if ($Passed) {
        $script:PassCount++
        Write-Host ("PASS [{0}] {1}" -f $Number, $Message)
    }
    else {
        $script:FailCount++
        Write-Host ("FAIL [{0}] {1}" -f $Number, $Message)
    }
}

function Test-ContainsAll {
    param([string]$Content, [string[]]$Tokens)
    foreach ($token in $Tokens) {
        if ($Content.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }
    return $true
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
    "AGENTS.md",
    "agents/claude-product-manager.md",
    "agents/codex-architect.md",
    "agents/codex-backend.md",
    "agents/codex-reviewer.md",
    "agents/cursor-frontend.md",
    "docs/architecture/AGENT-WORKFLOW.md",
    "tasks/TASK-TEMPLATE.md",
    "tasks/current-task.md",
    "tasks/MODULE-LOCKS.md",
    "tasks/TASK-EXAMPLE.md",
    "scripts/validate-agent-workflow.ps1"
)

$missingFiles = @($requiredFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf)
})
$message = if ($missingFiles.Count -eq 0) { "所有必需文件存在" } else { "缺少文件: " + ($missingFiles -join ", ") }
Write-Check 1 ($missingFiles.Count -eq 0) $message

$currentPath = Join-Path $repoRoot "tasks/current-task.md"
$current = if (Test-Path -LiteralPath $currentPath) { Get-Content -Raw -Encoding UTF8 -LiteralPath $currentPath } else { "" }
$legalStates = @(
    "IDLE", "DRAFT", "READY", "IN_PROGRESS", "READY_FOR_REVIEW",
    "CHANGES_REQUESTED", "IN_FIX", "READY_FOR_RETEST", "COMPLETED",
    "BLOCKED", "CANCELLED"
)
$statusMatch = [regex]::Match($current, '(?m)^-\s*Status[：:]\s*([^\r\n]+)\s*$')
$status = if ($statusMatch.Success) { $statusMatch.Groups[1].Value.Trim() } else { "" }
Write-Check 2 ($legalStates -contains $status) ("current-task Status 合法: '{0}'" -f $status)

$ownerMatch = [regex]::Match($current, '(?m)^-\s*Owner[：:]\s*([^\r\n]+)\s*$')
$reviewerMatch = [regex]::Match($current, '(?m)^-\s*Reviewer[：:]\s*([^\r\n]+)\s*$')
$owner = if ($ownerMatch.Success) { $ownerMatch.Groups[1].Value.Trim() } else { "" }
$reviewer = if ($reviewerMatch.Success) { $reviewerMatch.Groups[1].Value.Trim() } else { "" }
$separated = ($owner.Length -gt 0) -and ($reviewer.Length -gt 0) -and
    (-not [string]::Equals($owner, $reviewer, [System.StringComparison]::OrdinalIgnoreCase))
Write-Check 3 $separated ("Owner='{0}', Reviewer='{1}'" -f $owner, $reviewer)

$templatePath = Join-Path $repoRoot "tasks/TASK-TEMPLATE.md"
$template = if (Test-Path -LiteralPath $templatePath) { Get-Content -Raw -Encoding UTF8 -LiteralPath $templatePath } else { "" }
$templateFields = @(
    "Task ID", "Task Name", "Status", "Owner", "Reviewer", "Branch",
    "Requirement Source", "Product Baseline", "Architecture Reference",
    "Module Lock", "前置条件", "允许修改", "禁止修改", "功能要求",
    "非功能要求", "验收标准", "构建命令", "构建结果", "测试命令",
    "测试结果", "开发完成证据", "交接记录", "审核结论", "缺陷清单",
    "缺陷修复记录", "复审结果", "Change Request", "提交说明",
    "提交哈希", "推送结果", "本地哈希", "远端哈希", "已知限制",
    "最终完成条件", "N/A：具体理由"
)
$missingFields = @($templateFields | Where-Object {
    $template.IndexOf($_, [System.StringComparison]::OrdinalIgnoreCase) -lt 0
})
$message = if ($missingFields.Count -eq 0) { "TASK-TEMPLATE.md 包含全部关键字段" } else { "模板缺少字段: " + ($missingFields -join ", ") }
Write-Check 4 ($missingFields.Count -eq 0) $message

$locksPath = Join-Path $repoRoot "tasks/MODULE-LOCKS.md"
Write-Check 5 (Test-Path -LiteralPath $locksPath -PathType Leaf) "tasks/MODULE-LOCKS.md 存在"

$markdownFiles = @($requiredFiles | Where-Object { $_ -like "*.md" })
$badFences = @()
foreach ($relativePath in $markdownFiles) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (Test-Path -LiteralPath $fullPath) {
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $fullPath
        $fenceCount = ([regex]::Matches($content, '(?m)^\s*\x60{3}')).Count
        if (($fenceCount % 2) -ne 0) { $badFences += $relativePath }
    }
}
$message = if ($badFences.Count -eq 0) { "必需 Markdown 文件代码围栏成对" } else { "围栏未闭合: " + ($badFences -join ", ") }
Write-Check 6 ($badFences.Count -eq 0) $message

$workflowPath = Join-Path $repoRoot "docs/architecture/AGENT-WORKFLOW.md"
$workflow = if (Test-Path -LiteralPath $workflowPath) { Get-Content -Raw -Encoding UTF8 -LiteralPath $workflowPath } else { "" }
$missingStates = @($legalStates | Where-Object {
    $workflow.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0
})
$message = if ($missingStates.Count -eq 0) { "权威工作流包含全部合法状态" } else { "权威工作流缺少状态: " + ($missingStates -join ", ") }
Write-Check 7 ($missingStates.Count -eq 0) $message

$moduleTokens = @(
    "MODULE-LOCKS.md", "父子路径", "IN_PROGRESS", "BLOCKED",
    "CLAIMED", "HANDED_OFF", "RELEASED", "Reviewer"
)
Write-Check 8 (Test-ContainsAll $workflow $moduleTokens) "权威工作流包含模块认领、冲突、交接和释放规则"

$changeTokens = @(
    "Change Request ID", "发现者", "原任务", "变更原因", "产品范围影响",
    "技术影响", "文件影响", "测试影响", "风险", "Claude 裁决",
    "Architect 裁决", "更新后的 Requirement Source", "批准状态"
)
Write-Check 9 (Test-ContainsAll $workflow $changeTokens) "权威工作流包含完整 Change Request 规则"

$reviewTokens = @(
    "Owner 与最终 Reviewer 必须是不同主体",
    "Reviewer 不得直接修改被审核代码或文档",
    "任何修复者不得担任最终 Reviewer",
    "hangyu", "补偿性复审", "进入 READY 前必须校验"
)
Write-Check 10 (Test-ContainsAll $workflow $reviewTokens) "权威工作流包含 Reviewer 独立性与例外规则"

Write-Host ("SUMMARY PASS={0} FAIL={1} TOTAL={2}" -f
    $script:PassCount, $script:FailCount, ($script:PassCount + $script:FailCount))
if ($script:FailCount -gt 0) { exit 1 }
exit 0
