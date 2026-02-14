param(
  [string]$SeedId,
  [string]$ArtifactsRoot = (Resolve-Path ..\artifacts).Path,
  [ValidateSet('txt', 'md')]
  [string]$Format = 'md',
  [ValidateSet('true', 'false')]
  [string]$Segments = 'true',
  [ValidateSet('true', 'false')]
  [string]$Mentions = 'true',
  [ValidateSet('true', 'false')]
  [string]$Coverage = 'true',
  [ValidateSet('true', 'false')]
  [string]$DebugIds = 'false',
  [ValidateSet('compact', 'readable', 'table', 'meaning')]
  [string]$Layout = 'table',
  [string]$OutPath = ''
)

function Invoke-RenderElementaryAssertions {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Id,
    [ValidateSet('txt', 'md')]
    [string]$RenderFormat = $Format,
    [ValidateSet('compact', 'readable', 'table', 'meaning')]
    [string]$RenderLayout = $Layout,
    [string]$RenderOutPath = $OutPath
  )

  $seedDir = Join-Path (Join-Path $ArtifactsRoot $Id) 'seed'
  $inPath = Join-Path $seedDir 'seed.elementary-assertions.yaml'
  if (-not (Test-Path $inPath)) {
    throw "Input not found: $inPath"
  }

  $effectiveOut = $RenderOutPath
  if ([string]::IsNullOrWhiteSpace($effectiveOut)) {
    if ($RenderFormat -eq 'md' -and $RenderLayout -eq 'meaning') {
      $effectiveOut = Join-Path $seedDir 'seed.elementary-assertions.meaning.md'
    } elseif ($RenderFormat -eq 'md') {
      $effectiveOut = Join-Path $seedDir 'seed.elementary-assertions.md'
    } else {
      $effectiveOut = Join-Path $seedDir 'seed.elementary-assertions.txt'
    }
  }

  node .\render-elementary-assertions.js `
    --in $inPath `
    --out $effectiveOut `
    --format $RenderFormat `
    --layout $RenderLayout `
    --segments $Segments `
    --mentions $Mentions `
    --coverage $Coverage `
    --debug-ids $DebugIds

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path $ArtifactsRoot)) {
  throw "Artifacts root not found: $ArtifactsRoot"
}

$seedDirs = Get-ChildItem -Path $ArtifactsRoot -Directory | Sort-Object Name
$noArguments = $PSBoundParameters.Count -eq 0

if ($noArguments) {
  foreach ($dir in $seedDirs) {
    $yaml = Join-Path $dir.FullName 'seed\seed.elementary-assertions.yaml'
    if (-not (Test-Path $yaml)) { continue }
    Invoke-RenderElementaryAssertions -Id $dir.Name -RenderFormat 'md' -RenderLayout 'table' -RenderOutPath (Join-Path $dir.FullName 'seed\seed.elementary-assertions.md')
    Invoke-RenderElementaryAssertions -Id $dir.Name -RenderFormat 'md' -RenderLayout 'meaning' -RenderOutPath (Join-Path $dir.FullName 'seed\seed.elementary-assertions.meaning.md')
    Invoke-RenderElementaryAssertions -Id $dir.Name -RenderFormat 'txt' -RenderLayout 'compact' -RenderOutPath (Join-Path $dir.FullName 'seed\seed.elementary-assertions.txt')
  }
} elseif ([string]::IsNullOrWhiteSpace($SeedId)) {
  foreach ($dir in $seedDirs) {
    $yaml = Join-Path $dir.FullName 'seed\seed.elementary-assertions.yaml'
    if (-not (Test-Path $yaml)) { continue }
    Invoke-RenderElementaryAssertions -Id $dir.Name
  }
} else {
  Invoke-RenderElementaryAssertions -Id $SeedId
}