param([Parameter(Mandatory=$true)][string]$LiteralPath)
$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $LiteralPath
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point rejected' }
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowed = @($currentSid, 'S-1-5-18', 'S-1-5-32-544')
foreach ($rule in (Get-Acl -LiteralPath $LiteralPath).Access) {
    if ($rule.AccessControlType -ne 'Allow') { continue }
    $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    if ($allowed -contains $sid) { continue }
    $writes = [Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
    if ($rule.IdentityReference.Value -match '\\CodexSandboxUsers$' -and -not ($rule.FileSystemRights -band $writes)) { continue }
    throw 'Unexpected file access principal'
}
Write-Output 'private-windows-acl-verified'
