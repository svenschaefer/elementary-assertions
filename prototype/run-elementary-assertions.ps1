param(
  [string]$SeedId,
  [string]$ArtifactsRoot = (Join-Path $PSScriptRoot '..\artifacts'),
  [string]$WtiEndpoint = "http://127.0.0.1:32123",
  [int]$TimeoutMs = 120000
)

function Invoke-ElementaryAssertions {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Id
  )

  node (Join-Path $PSScriptRoot 'elementary-assertions.js') `
    --seed-id $Id `
    --artifacts-root $ArtifactsRoot `
    --wti-endpoint $WtiEndpoint `
    --timeout-ms $TimeoutMs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path $ArtifactsRoot)) {
  throw "Artifacts root not found: $ArtifactsRoot"
}

if ([string]::IsNullOrWhiteSpace($SeedId)) {
  $seedDirs = Get-ChildItem -Path $ArtifactsRoot -Directory | Sort-Object Name
  foreach ($dir in $seedDirs) {
    $seedTxt = Join-Path $dir.FullName 'seed\seed.txt'
    if (-not (Test-Path $seedTxt)) { continue }
    Invoke-ElementaryAssertions -Id $dir.Name
  }
} else {
  Invoke-ElementaryAssertions -Id $SeedId
}
