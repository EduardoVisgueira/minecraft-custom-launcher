# ============================================================================
#  Gerador de manifest do modpack  —  MC Launcher  (fluxo GitHub Releases)
# ----------------------------------------------------------------------------
#  Escaneia as pastas do modpack, calcula o SHA256 de cada arquivo e gera o
#  manifest.json que o launcher usa para baixar/atualizar o modpack.
#
#  ESTRATEGIA (decidida com o cliente):
#    - mods/   -> arquivos .jar ficam em um GITHUB RELEASE (asset por arquivo).
#                 A URL aponta para o download do Release (achata o nome).
#    - config/ -> fica no REPOSITORIO (raw), porque tem subpastas.
#
#  USO (terminal na pasta que contem mods/ e config/):
#      .\gerar-manifest.ps1
#  Ele pergunta as 2 URLs base. Pronto: gera o manifest.json.
# ============================================================================

param(
  [string]$ReleaseUrl,                      # base do Release (mods)
  [string]$RawUrl,                          # base raw do repo (config)
  [string]$ModpackDir = ".",
  [string[]]$ReleaseDirs = @("mods", "resourcepacks", "shaderpacks"),        # grandes -> Release
  [string[]]$RawDirs     = @("config", "kubejs", "scripts", "defaultconfigs") # texto -> repo raw
)

$ErrorActionPreference = "Stop"

if (-not $ReleaseUrl) {
  Write-Host ""
  Write-Host "URL base do GITHUB RELEASE (onde ficam os .jar dos mods)." -ForegroundColor Cyan
  Write-Host "Formato: https://github.com/USUARIO/REPO/releases/download/TAG"
  Write-Host "Exemplo: https://github.com/leal021/apocalipse-z/releases/download/modpack-v1"
  $ReleaseUrl = Read-Host "URL do Release"
}
if (-not $RawUrl) {
  Write-Host ""
  Write-Host "URL base RAW do repo (onde fica a pasta config/)." -ForegroundColor Cyan
  Write-Host "Formato: https://raw.githubusercontent.com/USUARIO/REPO/main"
  Write-Host "Exemplo: https://raw.githubusercontent.com/leal021/apocalipse-z/main"
  $RawUrl = Read-Host "URL raw"
}
$ReleaseUrl = $ReleaseUrl.TrimEnd('/')
$RawUrl     = $RawUrl.TrimEnd('/')

$root  = (Resolve-Path $ModpackDir).Path
$files = @()

# --- mods/ -> Release (URL = base + nome achatado, URL-encoded) ---
foreach ($d in $ReleaseDirs) {
  $dir = Join-Path $root $d
  if (-not (Test-Path $dir)) { Write-Host "(pulando: '$d' nao existe)" -ForegroundColor DarkYellow; continue }
  Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
    $rel  = $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
    $name = [uri]::EscapeDataString($_.Name)   # asset achatado no Release
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.ToLower()
    $files += [ordered]@{ path = $rel; url = "$ReleaseUrl/$name"; sha256 = $hash }
    Write-Host "  [release] $rel"
  }
}

# --- config/ -> raw repo (URL = base + caminho relativo completo) ---
foreach ($d in $RawDirs) {
  $dir = Join-Path $root $d
  if (-not (Test-Path $dir)) { Write-Host "(pulando: '$d' nao existe)" -ForegroundColor DarkYellow; continue }
  Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
    $rel  = $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
    # caminho relativo URL-encoded por segmento (preserva as barras das subpastas)
    $encRel = ($rel -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.ToLower()
    $files += [ordered]@{ path = $rel; url = "$RawUrl/$encRel"; sha256 = $hash }
    Write-Host "  [raw]     $rel"
  }
}

$manifest = [ordered]@{
  managed_dirs = @($ReleaseDirs + $RawDirs)
  files        = @($files)
}

# JSON em UTF-8 SEM BOM (o launcher faz JSON.parse; BOM quebraria o parse)
$json = $manifest | ConvertTo-Json -Depth 6
$out  = Join-Path $root "manifest.json"
[System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "OK! manifest.json gerado com $($files.Count) arquivo(s)." -ForegroundColor Green
Write-Host "Local: $out"
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Suba os .jar dos mods como assets de um GitHub Release (TAG igual a da URL):"
Write-Host "       gh release create modpack-v1 .\mods\*.jar -t 'Modpack v1'"
Write-Host "       (ou arraste os .jar na pagina do Release no site do GitHub)"
Write-Host "  2. Suba a pasta config/ + o manifest.json no repositorio (commit normal)."
Write-Host "  3. No launcher-config.json (online), aponte 'modpack.manifest_url' para o manifest.json (URL raw)."
Write-Host "  4. Subiu/trocou mod? Re-suba o asset no Release, rode este script e suba o manifest novo."
