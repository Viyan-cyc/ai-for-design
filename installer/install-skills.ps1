param([Parameter(Mandatory=$true)][string]$Destination, [switch]$Rebind)
$Arguments = @((Join-Path $PSScriptRoot 'install_skills.py'), $Destination)
if ($Rebind) { $Arguments += '--rebind' }
if (Get-Command python3 -ErrorAction SilentlyContinue) { & python3 @Arguments }
elseif (Get-Command python -ErrorAction SilentlyContinue) { & python @Arguments }
else { throw 'Python 3 is required.' }
if ($LASTEXITCODE -ne 0) { throw 'Skill installation failed.' }
