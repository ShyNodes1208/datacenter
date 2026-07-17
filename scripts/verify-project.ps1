$ErrorActionPreference = "Stop"
$repoRoot = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { $PWD }

function Assert-ExitZero {
    param([string]$Step, [int]$Code)
    if ($Code -ne 0) {
        throw "$Step failed with exit code $Code"
    }
}

function Assert-True {
    param([string]$Step, [bool]$Condition, [string]$Detail = "")
    if (-not $Condition) {
        if ($Detail) {
            throw "$Step failed: $Detail"
        }
        throw "$Step failed"
    }
}

function Invoke-Native {
    param([string]$Step, [scriptblock]$Action)
    Write-Host "=== $Step ==="
    & $Action
    Assert-ExitZero -Step $Step -Code $LASTEXITCODE
}

Push-Location $repoRoot

try {
    # 1. Environment checks
    Write-Host "=== Environment checks ==="
    $nodeVer = (& node --version)
    Assert-ExitZero -Step "node --version" -Code $LASTEXITCODE
    $npmVer = (& npm --version)
    Assert-ExitZero -Step "npm --version" -Code $LASTEXITCODE
    $dotnetVer = (& dotnet --version)
    Assert-ExitZero -Step "dotnet --version" -Code $LASTEXITCODE
    $pwshVer = (& pwsh --version)
    Assert-ExitZero -Step "pwsh --version" -Code $LASTEXITCODE
    Write-Host "node=$nodeVer npm=$npmVer dotnet=$dotnetVer pwsh=$pwshVer"

    # 2. package-lock.json exists
    Write-Host "=== package-lock.json exists ==="
    Assert-True -Step "package-lock.json" -Condition (Test-Path -LiteralPath "src/frontend/package-lock.json" -PathType Leaf)

    # 3. Deterministic install
    Push-Location src/frontend
    Invoke-Native -Step "Frontend: npm ci" -Action { npm ci }

    # 4. Direct dependency whitelist (AC-SC-03)
    Write-Host "=== Direct dependency whitelist ==="
    $whitelistScript = @'
const pkg = require("./package.json");
const deps = Object.keys(pkg.dependencies || {}).sort();
const devs = Object.keys(pkg.devDependencies || {}).sort();
const expectedDeps = ["vue"];
const expectedDevs = ["@types/node","@vitejs/plugin-vue","@vue/tsconfig","typescript","vite","vitest","vue-tsc"];
function eq(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
if (!eq(deps, expectedDeps) || !eq(devs, expectedDevs)) {
  console.error("deps:", JSON.stringify(deps));
  console.error("devs:", JSON.stringify(devs));
  console.error("expected deps:", JSON.stringify(expectedDeps));
  console.error("expected devs:", JSON.stringify(expectedDevs));
  process.exit(1);
}
console.log("Direct dependency whitelist: PASS");
'@
    $whitelistScript | node
    Assert-ExitZero -Step "Direct dependency whitelist" -Code $LASTEXITCODE

    # 5. AC-SC-18 Layer A — forbidden direct deps
    Write-Host "=== AC-SC-18 A: forbidden direct dependencies ==="
    $layerA = @'
const pkg = require("./package.json");
const direct = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const forbidden = ["jsdom", "happy-dom", "@vue/test-utils"];
const found = forbidden.filter((name) => Object.prototype.hasOwnProperty.call(direct, name));
if (found.length > 0) {
  console.error("Forbidden direct dependencies:", found.join(", "));
  process.exit(1);
}
console.log("Forbidden direct dependencies: none");
'@
    $layerA | node
    Assert-ExitZero -Step "AC-SC-18 A" -Code $LASTEXITCODE

    # 6. AC-SC-18 Layer B — top-level node_modules
    Write-Host "=== AC-SC-18 B: top-level node_modules ==="
    Assert-True -Step "AC-SC-18 B jsdom" -Condition (-not (Test-Path -LiteralPath "node_modules/jsdom"))
    Assert-True -Step "AC-SC-18 B happy-dom" -Condition (-not (Test-Path -LiteralPath "node_modules/happy-dom"))
    Assert-True -Step "AC-SC-18 B @vue/test-utils" -Condition (-not (Test-Path -LiteralPath "node_modules/@vue/test-utils"))
    Write-Host "Top-level forbidden packages: none"

    Pop-Location

    # 7. AC-SC-18 Layer C — project source/config references (exclude package-lock.json)
    Write-Host "=== AC-SC-18 C: project references ==="
    $cTargets = @(
        "src/frontend/src",
        "src/frontend/package.json",
        "src/frontend/vite.config.ts"
    ) + @(Get-ChildItem -Path "src/frontend" -Filter "tsconfig*.json" -File | ForEach-Object { $_.FullName })
    $cMatches = @()
    foreach ($target in $cTargets) {
        if (Test-Path -LiteralPath $target) {
            $hits = & grep -ri "jsdom\|happy-dom\|@vue/test-utils" -- $target 2>$null
            if ($LASTEXITCODE -eq 0 -and $hits) {
                $cMatches += $hits
            }
        }
    }
    Assert-True -Step "AC-SC-18 C" -Condition ($cMatches.Count -eq 0) -Detail ($cMatches -join "`n")
    Write-Host "Project references to forbidden packages: none"

    # 8. Backend NuGet dependency checks
    Write-Host "=== Backend NuGet dependency checks ==="
    $apiCsproj = Get-Content -Raw -LiteralPath "src/backend/Datacenter.Api/Datacenter.Api.csproj"
    Assert-True -Step "API has no PackageReference" -Condition ($apiCsproj -notmatch "PackageReference")

    $testCsprojPath = "tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj"
    $testCsproj = Get-Content -Raw -LiteralPath $testCsprojPath
    $pkgMatches = [regex]::Matches($testCsproj, 'PackageReference\s+Include="([^"]+)"')
    $pkgNames = @($pkgMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
    $expectedPkgs = @("Microsoft.NET.Test.Sdk", "xunit", "xunit.runner.visualstudio") | Sort-Object
    Assert-True -Step "Test PackageReference whitelist" -Condition (($pkgNames -join ",") -eq ($expectedPkgs -join ",")) -Detail ("found=" + ($pkgNames -join ","))

    Assert-True -Step "ProjectReference present" -Condition ($testCsproj -match 'ProjectReference\s+Include="[^"]*Datacenter\.Api\.csproj"')

    $forbiddenCsproj = & grep -ri "EntityFrameworkCore\|SQLite\|Swashbuckle\|Microsoft.AspNetCore.OpenApi\|coverlet\|FluentAssertions\|Moq\|NSubstitute\|Microsoft.AspNetCore.Mvc.Testing" --include="*.csproj" src/backend/ tests/backend/ 2>$null
    Assert-True -Step "Forbidden csproj packages" -Condition ($LASTEXITCODE -ne 0 -or -not $forbiddenCsproj) -Detail ($forbiddenCsproj -join "`n")

    # 9. coverlet.collector absent (source projects only; ignore bin/obj)
    Write-Host "=== coverlet.collector absent ==="
    $coverletHits = & grep -ri "coverlet" --exclude-dir=bin --exclude-dir=obj tests/ 2>$null
    Assert-True -Step "coverlet absent" -Condition ($LASTEXITCODE -ne 0 -or -not $coverletHits) -Detail ($coverletHits -join "`n")

    # Solution project list
    Write-Host "=== Solution project list ==="
    $slnList = & dotnet sln Datacenter.sln list
    Assert-ExitZero -Step "dotnet sln list" -Code $LASTEXITCODE
    $slnProjects = @($slnList | Where-Object { $_ -match '\.csproj$' } | ForEach-Object { $_.Replace('\', '/') } | Sort-Object)
    $expectedSln = @(
        "src/backend/Datacenter.Api/Datacenter.Api.csproj",
        "tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj"
    ) | Sort-Object
    Assert-True -Step "Solution projects" -Condition (($slnProjects.Count -eq 2) -and (($slnProjects -join "|") -eq ($expectedSln -join "|"))) -Detail ($slnProjects -join "`n")

    # 10-12 Frontend typecheck / test / build
    Push-Location src/frontend
    Invoke-Native -Step "Frontend: npm run typecheck" -Action { npm run typecheck }

    Write-Host "=== Frontend: npm run test ==="
    $frontendTest = & npm run test 2>&1 | Out-String
    Write-Host $frontendTest
    Assert-ExitZero -Step "Frontend test" -Code $LASTEXITCODE
    Assert-True -Step "Frontend exactly 1 test" -Condition ($frontendTest -match "1 passed") -Detail "expected 1 passed"

    Invoke-Native -Step "Frontend: npm run build" -Action { npm run build }
    Pop-Location

    # 13-15 Backend restore / build / test
    Invoke-Native -Step "Backend: dotnet restore" -Action { dotnet restore Datacenter.sln }

    Write-Host "=== Backend: dotnet build ==="
    $buildOut = & dotnet build Datacenter.sln --no-restore 2>&1 | Out-String
    Write-Host $buildOut
    Assert-ExitZero -Step "dotnet build" -Code $LASTEXITCODE
    Assert-True -Step "dotnet build 0 warnings" -Condition ($buildOut -match "0 Warning\(s\)") -Detail "expected 0 Warning(s)"
    Assert-True -Step "dotnet build 0 errors" -Condition ($buildOut -match "0 Error\(s\)") -Detail "expected 0 Error(s)"

    Write-Host "=== Backend: dotnet test ==="
    $backendTest = & dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build 2>&1 | Out-String
    Write-Host $backendTest
    Assert-ExitZero -Step "dotnet test" -Code $LASTEXITCODE
    Assert-True -Step "Backend exactly 1 test" -Condition ($backendTest -match "Passed:\s+1" -or $backendTest -match "1 passed") -Detail "expected 1 passed"

    # 16. Template residue checks
    Write-Host "=== Template residue checks ==="
    $weatherFiles = @(Get-ChildItem -Path src/backend -Recurse -Filter "WeatherForecast*" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\/](bin|obj)[\\/]' })
    Assert-True -Step "No WeatherForecast files" -Condition ($weatherFiles.Count -eq 0) -Detail ($weatherFiles.FullName -join "`n")

    $frontendResidue = @(
        "src/frontend/src/components/HelloWorld.vue",
        "src/frontend/src/style.css",
        "src/frontend/public/icons.svg",
        "src/frontend/public/vite.svg",
        "src/frontend/src/assets/hero.png",
        "src/frontend/src/assets/vite.svg",
        "src/frontend/src/assets/vue.svg"
    )
    foreach ($path in $frontendResidue) {
        Assert-True -Step "Residue absent $path" -Condition (-not (Test-Path -LiteralPath $path))
    }
    $counterHits = @(Get-ChildItem -Path src/frontend/src -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'counter' })
    Assert-True -Step "No Counter residue" -Condition ($counterHits.Count -eq 0) -Detail ($counterHits.FullName -join "`n")

    # 17. launchSettings.json weatherforecast
    Write-Host "=== launchSettings.json weatherforecast check ==="
    $launchHits = & grep -ni "weatherforecast" -- src/backend/Datacenter.Api/Properties/launchSettings.json 2>$null
    Assert-True -Step "launchSettings weatherforecast" -Condition ($LASTEXITCODE -ne 0 -or -not $launchHits) -Detail ($launchHits -join "`n")

    # 18. Git tracking check (IR-002 / AC-SC-20) — untracked is OK; tracked is FAIL
    Write-Host "=== Git tracking check (build artifacts) ==="
    $trackedArtifacts = & git ls-files |
        & grep -E '(^|/)(node_modules|dist|bin|obj|TestResults)(/|$)'
    # grep exit 1 means no matches (good); exit 0 means matches (bad)
    Assert-True -Step "No tracked build artifacts" -Condition ($LASTEXITCODE -ne 0 -or -not $trackedArtifacts) -Detail ($trackedArtifacts -join "`n")
    Write-Host "Tracked build artifacts: none"

    # 19. git diff --check
    Write-Host "=== git diff --check ==="
    & git diff --check
    Assert-ExitZero -Step "git diff --check" -Code $LASTEXITCODE

    # 20. Workflow validation
    Write-Host "=== Workflow validation ==="
    $wfOut = & pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1 2>&1 | Out-String
    Write-Host $wfOut
    Assert-ExitZero -Step "workflow validation" -Code $LASTEXITCODE
    Assert-True -Step "workflow 20/20" -Condition ($wfOut -match "PASS=20" -and $wfOut -match "FAIL=0" -and $wfOut -match "TOTAL=20")

    Write-Host "=== ALL CHECKS PASSED ==="
}
catch {
    Write-Host "=== VERIFICATION FAILED ==="
    Write-Host $_
    if ($_.Exception -and $_.Exception.Message) {
        Write-Host $_.Exception.Message
    }
    exit 1
}
finally {
    Pop-Location
}
