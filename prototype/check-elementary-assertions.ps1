param(
  [string]$SeedId,
  [string]$ArtifactsRoot = (Resolve-Path ..\artifacts).Path
)

function Invoke-CheckElementaryAssertions {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Id
  )

  node .\check-elementary-assertions.js --seed-id $Id --artifacts-root $ArtifactsRoot
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if ([string]::IsNullOrWhiteSpace($SeedId)) {
  $seedDirs = Get-ChildItem -Path $ArtifactsRoot -Directory | Sort-Object Name
  foreach ($dir in $seedDirs) {
    Invoke-CheckElementaryAssertions -Id $dir.Name
  }
} else {
  Invoke-CheckElementaryAssertions -Id $SeedId
}
