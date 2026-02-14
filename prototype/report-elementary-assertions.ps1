param(
  [string]$ArtifactsRoot = (Resolve-Path ..\artifacts).Path
)

function Invoke-Report {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptName
  )

  node (Join-Path $PSScriptRoot $ScriptName) --artifacts-root $ArtifactsRoot
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Invoke-Report -ScriptName 'report-baseline-metrics.js'
Invoke-Report -ScriptName 'report-maturity.js'
Invoke-Report -ScriptName 'report-fragment-hotspots.js'
