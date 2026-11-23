& {
    param([string] $ScriptFile)

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $previousEncoding = [Console]::OutputEncoding
    try {
        [Console]::OutputEncoding = $utf8
        $OutputEncoding = $utf8

        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        if (!$node) { throw 'Install Node.js 22.19 or newer with npm.' }
        & $node.Source -e 'const [major, minor] = process.versions.node.split(String.fromCharCode(46)).map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)'
        if ($LASTEXITCODE -ne 0) { throw 'Install Node.js 22.19 or newer with npm.' }

        $git = Get-Command git.exe -ErrorAction SilentlyContinue
        if (!$git) { throw 'Install Git for Windows and add it to PATH.' }
        & $git.Source --version | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Git for Windows failed its version check.' }

        if ($ScriptFile) {
            $localEntry = Join-Path (Split-Path -Parent $ScriptFile) 'install.mjs'
            if (Test-Path -LiteralPath $localEntry -PathType Leaf) {
                & $node.Source $localEntry @args
                if ($LASTEXITCODE -ne 0) { throw "BB installer exited with code $LASTEXITCODE." }
                return
            }
        }

        $base = $env:BB_SHARE_BASE_URL
        if (!$base) { $base = 'https://github.com/smart-lty/bb-custom/releases/latest/download' }
        if (!$base.StartsWith('https://')) { throw 'BB_SHARE_BASE_URL must be an HTTPS URL.' }
        $stage = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString('N'))
        $previousProtocols = [Net.ServicePointManager]::SecurityProtocol
        New-Item -Path $stage -ItemType Directory | Out-Null
        try {
            [Net.ServicePointManager]::SecurityProtocol = $previousProtocols -bor [Net.SecurityProtocolType]::Tls12
            $entry = Join-Path $stage 'install.mjs'
            Invoke-WebRequest -UseBasicParsing -Uri ($base.TrimEnd('/') + '/install.mjs') -OutFile $entry
            & $node.Source $entry --source $base @args
            if ($LASTEXITCODE -ne 0) { throw "BB installer exited with code $LASTEXITCODE." }
        } finally {
            [Net.ServicePointManager]::SecurityProtocol = $previousProtocols
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
        }
    } finally {
        [Console]::OutputEncoding = $previousEncoding
    }
} $(if ($MyInvocation.MyCommand -is [System.Management.Automation.ExternalScriptInfo]) { $MyInvocation.MyCommand.Path }) @args
