$ErrorActionPreference = "Stop"
$repoRoot = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { $PWD }

Push-Location $repoRoot

try {
    Write-Host "=== Frontend: npm install ==="
    Push-Location src/frontend
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    Write-Host "=== Frontend: npm run typecheck ==="
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

    Write-Host "=== Frontend: npm run test ==="
    npm run test
    if ($LASTEXITCODE -ne 0) { throw "frontend test failed" }

    Write-Host "=== Frontend: npm run build ==="
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
    Pop-Location

    Write-Host "=== Backend: dotnet restore ==="
    dotnet restore Datacenter.sln
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

    Write-Host "=== Backend: dotnet build ==="
    dotnet build Datacenter.sln --no-restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed" }

    Write-Host "=== Backend: dotnet test ==="
    dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build
    if ($LASTEXITCODE -ne 0) { throw "dotnet test failed" }

    Write-Host "=== Workflow validation ==="
    pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
    if ($LASTEXITCODE -ne 0) { throw "workflow validation failed" }

    Write-Host "=== ALL CHECKS PASSED ==="
} finally {
    Pop-Location
}
