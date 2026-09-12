param([Parameter(Mandatory=$true)][string]$Destination, [switch]$Rebind)
$Arguments = @((Join-Path $PSScriptRoot 'install_skills.mjs'), $Destination)
if ($Rebind) { $Arguments += '--rebind' }
if (Get-Command node -ErrorAction SilentlyContinue) { & node @Arguments }
else { throw 'Node.js is required.' }
if ($LASTEXITCODE -ne 0) { throw 'Skill installation failed.' }
