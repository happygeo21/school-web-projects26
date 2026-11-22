param(
    [Parameter(Mandatory=$true)][ValidateSet('PersonalRules','Probe','Protocol','Serve')][string]$Mode,
    [string]$PrivatePackage, [string]$ExpectedRulesSHA256, [string]$Config,
    [string]$Report, [string]$Prepared,
    [string]$NodeExe = 'node', [string]$PythonExe = 'python', [string]$JavaHome,
    [switch]$UseSystemCA
)
$ErrorActionPreference = 'Stop'
$previousPath = $env:PATH
$previousJava = $env:JAVA_HOME
try {
    $nodePath = (Get-Command $NodeExe -ErrorAction Stop).Source
    $env:PATH = "$(Split-Path $nodePath);$previousPath"
    if ($JavaHome) { $env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path; $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }
    $nodeArgs = @()
    if ($UseSystemCA) {
        if (-not ((& $nodePath --help) -match '--use-system-ca')) { throw 'This Node version does not support --use-system-ca' }
        $nodeArgs += '--use-system-ca'
    }
    switch ($Mode) {
        'PersonalRules' {
            if (-not $PrivatePackage -or $ExpectedRulesSHA256 -notmatch '^[a-f0-9]{64}$') { throw 'External private package and verified SHA256 required' }
            & $PythonExe (Join-Path $PSScriptRoot 'run-personal-rules.py') --package $PrivatePackage --expected-sha256 $ExpectedRulesSHA256
        }
        'Probe' {
            if (-not $Config -or -not $Report) { throw 'Private config and new report required' }
            & $nodePath @nodeArgs (Join-Path $PSScriptRoot 'live-test.mjs') --probe-only --config $Config --report $Report
        }
        'Protocol' {
            if (-not $Config -or -not $Report) { throw 'Private config and new report required' }
            & $nodePath @nodeArgs (Join-Path $PSScriptRoot 'live-test.mjs') --config $Config --report $Report
        }
        'Serve' {
            if (-not $Prepared) { throw 'Existing private prepared folder required' }
            & $nodePath @nodeArgs (Join-Path $PSScriptRoot 'serve-live-test.mjs') --prepared $Prepared
        }
    }
    $code = $LASTEXITCODE
} finally {
    $env:PATH = $previousPath
    $env:JAVA_HOME = $previousJava
}
exit $code
