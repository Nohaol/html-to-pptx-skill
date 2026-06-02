param(
  [Parameter(Mandatory = $true)]
  [string]$OutputZip,

  [Parameter(Mandatory = $true)]
  [string[]]$Files
)

$resolvedFiles = @()
foreach ($file in $Files) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "File not found: $file"
  }
  $resolvedFiles += (Resolve-Path -LiteralPath $file).Path
}

$zipParent = Split-Path -Parent $OutputZip
if ($zipParent -and -not (Test-Path -LiteralPath $zipParent)) {
  New-Item -ItemType Directory -Path $zipParent | Out-Null
}

if (Test-Path -LiteralPath $OutputZip) {
  Remove-Item -LiteralPath $OutputZip -Force
}

Compress-Archive -LiteralPath $resolvedFiles -DestinationPath $OutputZip
Get-ChildItem -LiteralPath $OutputZip | Select-Object Name,Length,LastWriteTime

