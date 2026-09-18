# generate-ux-prototype env install (Windows)
#
# ASCII-only comments: PowerShell 5.1 reads BOM-less UTF-8 via the system ANSI
# code page, so non-ASCII comments can break parsing (fastui project hit this).
#
# Does ONE thing: get a working node.
# Reuse an existing node when `node -v` works (any major version); only
# download a portable node when there is none. After node is settled, run
# setup-env.mjs which installs the compiler deps via npm (npm-only, no yarn).
#
# Download source: REMOTE MANIFEST. The manifest
# URL lives in references/env-config.json (manifestUrl). The manifest carries
# node.version, per-platform {file, sha256, stripComponents} and npmRegistry.
# node packages resolve relative to dirname(manifestUrl); integrity via the
# manifest's embedded sha256 (replaces the old SHASUMS256.txt flow).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-Manifest <url|path>]
#              [-EnvDir <path>] [-Registry <npm registry>] [-ForcePortableNode]
#              [-Proxy <addr>] [-Check]
[CmdletBinding()]
param(
  [string]$Manifest = "",
  [string]$EnvDir = "",
  [string]$Registry = "",
  [switch]$ForcePortableNode,
  [string]$Proxy = "",
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ---------- paths ----------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

# ---------- env config (single source: references/env-config.json) ----------
$CfgPath = Join-Path $SkillDir "references\env-config.json"
function Read-Cfg([string]$Field) {
  try {
    $j = Get-Content $CfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return [string]$j.$Field
  } catch { return "" }
}
# manifest URL: -Manifest > env-config.json manifestUrl
if (-not $Manifest) { $Manifest = Read-Cfg "manifestUrl" }
$EnvDirName = Read-Cfg "envDirName"

if (-not $EnvDir) {
  $envVar = Read-Cfg "envDirEnvVar"
  if ($envVar -and [Environment]::GetEnvironmentVariable($envVar)) {
    $EnvDir = [Environment]::GetEnvironmentVariable($envVar)
  } else {
    $EnvDir = Join-Path $env:LOCALAPPDATA $EnvDirName
  }
}
$NodeDir = Join-Path $EnvDir "node"
$NodeBin = Join-Path $NodeDir "node.exe"
$LogPath = Join-Path $EnvDir "install.log"

# ---------- logging ----------
$script:LogOn = $false
try {
  New-Item -ItemType Directory -Path $EnvDir -Force | Out-Null
  $script:LogOn = $true
} catch { }
function WriteLog($text) {
  if (-not $script:LogOn) { return }
  try {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($LogPath, "$text`r`n", $enc)
  } catch { }
}
function Say($msg) { Write-Host $msg; WriteLog $msg }
function Flatten($s) { if ($null -eq $s) { return "" }; return (($s -replace "\s+", " ").Trim()) }
function Emit($msg) { $line = Flatten $msg; Write-Output $line; WriteLog $line }
# Fail must be defined before every call site (PS registers functions at runtime).
function Fail($code, $reason, $detail, $hint) {
  Emit "RESULT: FAIL | ${code}: ${reason}"
  if ($detail) { Emit "DETAIL: $detail" }
  if ($hint) { Emit "HINT: $hint" }
  if ($script:LogOn) { Emit "LOG: $LogPath" }
  exit 1
}

WriteLog "`r`n===== $(Get-Date -Format o) install.ps1 $args"

if (-not $Manifest) {
  Fail "NO_MANIFEST" "no manifest URL (references/env-config.json missing manifestUrl)" $CfgPath "fix env-config.json or pass -Manifest <url>"
}

# ---------- TLS 1.2 (PS 5.1 defaults to 1.0/1.1; servers reject it) ----------
try {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch { }

# ---------- proxy: direct by default (mirror is public; agent-injected proxies
# often cannot reach it) ----------
if ($Proxy) {
  try {
    [System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy($Proxy, $true)
  } catch {
    Fail "BAD_PROXY" "-Proxy address not parseable: $Proxy" $_.Exception.Message "form: http://host:port"
  }
} else {
  try {
    [System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy
  } catch {
    Say "[warn] cannot clear default proxy, requests may still go through the system proxy"
  }
}

$PlatformKey = "win32-x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $PlatformKey = "win32-arm64" }

# ---------- manifest helpers (ConvertFrom-Json is native, no python needed) ----------
function Get-Manifest([string]$Url, [string]$OutFile) {
  # cache-busting query; file paths (offline handoff) must not get one
  if ($Url -match "^https?://") {
    $sep = "?"
    if ($Url.Contains("?")) { $sep = "&" }
    $Url = "$Url${sep}t=$(Get-Date -UFormat %s)"
    try { Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -Headers @{"Cache-Control" = "no-cache" } } catch { return $false }
  } else {
    if (-not (Test-Path $Url)) { return $false }
    Copy-Item $Url $OutFile -Force
  }
  return $true
}
function Get-PlatformEntry($ManifestJson, [string]$Key) {
  return $ManifestJson.node.platforms.$Key
}

try {

  # ---------- system node detection ----------
  $SysNode = ""; $SysNodeVer = ""
  try {
    $c = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) {
      $SysNode = $c.Source
      $SysNodeVer = (& $SysNode -v 2>$null | Select-Object -First 1)
    }
  } catch { }
  if ("$SysNodeVer" -notmatch '^v\d+\.') { $SysNode = ""; $SysNodeVer = "" }

  $PoolNodeOk = $false
  if (Test-Path $NodeBin) {
    try {
      & $NodeBin -v 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $PoolNodeOk = $true }
    } catch { }
  }

  # ---------- pick node: pool > system > download (no version gate) ----------
  $needNode = $false; $nodeSrc = ""; $EffectiveNode = ""
  if ($ForcePortableNode) {
    $needNode = $true; $nodeSrc = "download(-ForcePortableNode)"
  } elseif ($PoolNodeOk) {
    $nodeSrc = "pool"; $EffectiveNode = $NodeBin
  } elseif ($SysNode) {
    $nodeSrc = "system"; $EffectiveNode = $SysNode
  } else {
    $needNode = $true; $nodeSrc = "download(no node on machine)"
  }
  $nodeLine = "[node] source: $nodeSrc"
  if ($EffectiveNode) { $nodeLine += " -> $EffectiveNode" }
  if ($SysNodeVer) { $nodeLine += "; system node $SysNodeVer" }
  Say $nodeLine

  # ---------- -Check: probe manifest + every platform's asset, no download ----------
  if ($Check) {
    Say "CHECK_MODE: probe-only"
    Say "PLATFORM_HERE: $PlatformKey"
    Say "MANIFEST_URL: $Manifest"
    $MJson = Join-Path ([System.IO.Path]::GetTempPath()) ("ux-proto-check-" + [guid]::NewGuid().ToString("N").Substring(0, 8) + ".json")
    if (-not (Get-Manifest $Manifest $MJson)) {
      Fail "MANIFEST_UNREACHABLE" "cannot fetch manifest: $Manifest" "" "if this machine needs a proxy to reach the intranet, add -Proxy <addr> and re-run -Check"
    }
    Say "MANIFEST_HTTP: OK"
    try { $MJ = Get-Content $MJson -Raw -Encoding UTF8 | ConvertFrom-Json } catch {
      Fail "MANIFEST_NOT_JSON" "manifest is not JSON (proxy/gateway error page?)" $_.Exception.Message ""
    }
    $bad = 0; $total = 0
    foreach ($prop in $MJ.node.platforms.PSObject.Properties) {
      $total++
      $assetUrl = "$($Manifest -replace '/[^/]*$', '')/$($prop.Value.file)"
      $hcode = ""; $gcode = ""
      try {
        $r = Invoke-WebRequest -Uri $assetUrl -Method Head -UseBasicParsing -TimeoutSec 60
        $hcode = [int]$r.StatusCode
      } catch { $hcode = "ERR" }
      try {
        # PS 5.1 restricted headers: Range must go through AddRange, not -Headers
        $req = [System.Net.HttpWebRequest]::Create($assetUrl)
        $req.Method = "GET"
        $req.AllowAutoRedirect = $true
        $req.Timeout = 60000
        $req.AddRange("bytes", 0, 0)
        $resp = $req.GetResponse()
        $gcode = [int]$resp.StatusCode
        $resp.Close()
      } catch {
        $gcode = "ERR"
        if ($_.Exception.Response) {
          $sc = [int]$_.Exception.Response.StatusCode
          if ($sc -eq 206 -or $sc -eq 200) { $gcode = $sc }
        }
      }
      Say ("ASSET_" + $prop.Name.ToUpper() + ": HEAD=$hcode GET=$gcode")
      if ($gcode -ne 200 -and $gcode -ne 206) { $bad++ }
    }
    Remove-Item $MJson -Force -ErrorAction SilentlyContinue
    Say "CHECKED_PLATFORMS: $total"
    if ($total -eq 0) { Fail "NO_PLATFORM_PKG" "manifest node.platforms is empty" "" "fix the manifest on the hosting server" }
    if ($bad -ne 0) { Fail "ASSET_UNREACHABLE" "$bad/$total platform packages unreachable (see ASSET_* lines above)" "" "confirm hosting/nginx/WAF with the platform team" }
    Say "RESULT: OK"
    Say "NOTE: probe-only (HEAD + 1-byte Range GET); full integrity is still enforced by sha256 at install time"
    exit 0
  }

  $Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("ux-proto-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
  try {
    if ($needNode) {
      $MJson = Join-Path $Tmp "manifest.json"
      Say "[manifest] $Manifest"
      if (-not (Get-Manifest $Manifest $MJson)) {
        Fail "MANIFEST_UNREACHABLE" "cannot fetch manifest: $Manifest" "" "run with -Check first to see per-platform status; if this machine needs a proxy, pass -Proxy <addr>. note: reaching the download step means NO usable node was found (see the [node] source line) - installing any node by any means skips this whole path"
      }
      try { $MJ = Get-Content $MJson -Raw -Encoding UTF8 | ConvertFrom-Json } catch {
        Fail "MANIFEST_NOT_JSON" "manifest is not JSON (proxy/gateway/SSO error page?)" $_.Exception.Message ""
      }

      $Entry = Get-PlatformEntry $MJ $PlatformKey
      if (-not $Entry -or -not $Entry.file) {
        Fail "NO_PLATFORM_PKG" "manifest has no node package for $PlatformKey" "" "add node.platforms.$PlatformKey to the manifest"
      }

      $Base = "$Manifest" -replace '/[^/]*$', ''
      $PkgFile = Split-Path -Leaf $Entry.file
      $Url = "$Base/$($Entry.file)"
      $Pkg = Join-Path $Tmp $PkgFile

      Say "[download] $Url"
      try {
        Invoke-WebRequest -Uri $Url -OutFile $Pkg -UseBasicParsing
      } catch {
        Fail "DOWNLOAD_FAILED" "cannot download $Url" "$($_.Exception.Message)" "check network/proxy; retry; or install node manually from https://nodejs.org then re-run (any version works)"
      }
      if (-not (Test-Path $Pkg) -or (Get-Item $Pkg).Length -eq 0) {
        Fail "DOWNLOAD_FAILED" "downloaded file is empty: $Pkg" "" "retry; if it persists the hosted copy may be broken"
      }

      # sha256 verify against the manifest's embedded hash (integrity >= TLS chain)
      if (-not $Entry.sha256) {
        Fail "SHA256_UNKNOWN" "manifest entry has no sha256 for $PkgFile" "" "fix the manifest on the hosting server"
      }
      $Got = (Get-FileHash -Algorithm SHA256 $Pkg).Hash.ToLower()
      if ($Got -ne $Entry.sha256.ToLower()) {
        Fail "SHA256_MISMATCH" "node zip checksum mismatch (truncated or tampered)" "expected=$($Entry.sha256) actual=$Got size=$((Get-Item $Pkg).Length)" "retry download; if it persists the hosted copy may be broken"
      }

      # Win10 1803+ ships bsdtar (tar.exe), which extracts zip and supports --strip-components.
      # Use the absolute Windows tar.exe: when PS is invoked from Git Bash, /usr/bin/tar
      # (GNU) may come first on PATH and GNU tar cannot read "C:\..." (exit 128).
      $strip = 1
      if ($Entry.stripComponents) { $strip = [int]$Entry.stripComponents }
      New-Item -ItemType Directory -Path $NodeDir -Force | Out-Null
      $WinTar = Join-Path $env:SystemRoot "System32\tar.exe"
      & $WinTar -xf $Pkg -C $NodeDir --strip-components=$strip
      if ($LASTEXITCODE -ne 0) { Fail "EXTRACT_FAILED" "extract failed: $Pkg" "tar exit=$LASTEXITCODE" "confirm tar.exe exists (Win10 1803+)" }
      if (-not (Test-Path $NodeBin)) { Fail "EXTRACT_FAILED" "extracted but node.exe not found at $NodeBin" "" "report to skill maintainer" }
      Say "[node] $(& $NodeBin -v) -> $NodeDir"
      $EffectiveNode = $NodeBin
    }
  } finally {
    # only remove the temp dir this script created - guard before deleting
    if ($Tmp -and (Test-Path $Tmp)) { Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue }
  }

  # ---------- registry from manifest (download path only; -Registry wins) ----------
  if (-not $Registry -and $MJ) {
    try { $Registry = [string]$MJ.npmRegistry } catch { }
  }

  # ---------- handoff to setup-env.mjs (npm-only dep install) ----------
  if (-not $EffectiveNode) { Fail "NODE_MISSING" "no usable node resolved (internal state)" "" "send the whole LOG run for triage" }
  $argv = @((Join-Path $SkillDir "scripts\setup-env.mjs"), "--env-dir=$EnvDir")
  if ($Registry) { $argv += "--registry=$Registry" }
  Say "[handoff] $EffectiveNode $($argv[1..($argv.Length-1)] -join ' ')"
  # PS 5.1 under $ErrorActionPreference=Stop may raise NativeCommandError on
  # child stderr; relax during handoff, exit code still comes from $LASTEXITCODE.
  $prevEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $EffectiveNode @argv
  $childCode = $LASTEXITCODE
  $ErrorActionPreference = $prevEAP
  exit $childCode

} catch {
  if ($script:FailCode) { exit $script:FailCode }
  Fail "UNEXPECTED" "install script aborted" "$($_.Exception.Message) @ line $($_.InvocationInfo.ScriptLineNumber)" "send the whole LOG run (from the ===== line) for triage"
}
