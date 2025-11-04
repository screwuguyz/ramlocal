param(
  [string]$Root = "."
)

# Converts UTF-16 (LE/BE) and UTF-8 with BOM to UTF-8 (no BOM),
# preserving all Turkish characters.

$ErrorActionPreference = 'Stop'

$exts = @("*.ts","*.tsx","*.js","*.mjs","*.json","*.md","*.css")

function Convert-File([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 2) { return }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

  # UTF-8 with BOM
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
    Write-Host "Stripped UTF-8 BOM: $Path"
    return
  }

  # UTF-16 LE BOM
  if ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    $text = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
    [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
    Write-Host "Converted UTF-16 LE -> UTF-8: $Path"
    return
  }

  # UTF-16 BE BOM
  if ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    $text = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
    [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
    Write-Host "Converted UTF-16 BE -> UTF-8: $Path"
    return
  }

  # Heuristic: if there are lots of null bytes, try UTF-16 LE
  $nulls = 0
  foreach ($b in $bytes) { if ($b -eq 0) { $nulls++ } }
  if ($nulls -gt ($bytes.Length/10)) {
    try {
      $text = [System.Text.Encoding]::Unicode.GetString($bytes)
      [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
      Write-Host "Heuristically converted -> UTF-8: $Path"
    } catch {
      Write-Warning "Skipped (unknown encoding): $Path"
    }
  }
}

foreach ($ext in $exts) {
  Get-ChildItem -Path $Root -Recurse -Filter $ext | ForEach-Object { Convert-File $_.FullName }
}

Write-Host "Done. All text files normalized to UTF-8 (no BOM)."

