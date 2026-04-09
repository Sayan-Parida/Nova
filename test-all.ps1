$ErrorActionPreference = 'Stop'

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8081' }
$BackendDir = Join-Path $PSScriptRoot 'backend'
$BackendOutLog = Join-Path $PSScriptRoot 'backend-test.log'
$BackendErrLog = Join-Path $PSScriptRoot 'backend-test.err.log'
$WaitSeconds = 15

$passCount = 0
$failCount = 0
$backendProcess = $null

function Print-Result {
    param(
        [string]$Name,
        [int]$Expected,
        [int]$Actual
    )

    if ($Actual -eq $Expected) {
        Write-Host "PASS: $Name (expected $Expected, got $Actual)"
        $script:passCount++
    }
    else {
        Write-Host "FAIL: $Name (expected $Expected, got $Actual)"
        $script:failCount++
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = '',
        [string]$Token = '',
        [string]$TimezoneOffset = ''
    )

    $tempFile = [System.IO.Path]::GetTempFileName()
    $bodyFile = $null
    try {
        $args = @('-s', '-o', $tempFile, '-w', '%{http_code}', '-X', $Method)
        $args += "${BaseUrl}${Path}"

        if ($Body) {
            $bodyFile = [System.IO.Path]::GetTempFileName()
            Set-Content -Path $bodyFile -Value $Body -NoNewline
            $args += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
        }

        if ($Token) {
            $args += @('-H', "Authorization: Bearer $Token")
        }

        if ($TimezoneOffset) {
            $args += @('-H', "X-Timezone-Offset: $TimezoneOffset")
        }

        $statusRaw = & curl.exe @args
        $statusCode = [int]$statusRaw
        $responseBody = Get-Content -Path $tempFile -Raw

        return @{
            StatusCode = $statusCode
            Body       = $responseBody
        }
    }
    finally {
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        if ($bodyFile) {
            Remove-Item -Path $bodyFile -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    Write-Host 'Starting backend in background...'
    $backendProcess = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'mvnw.cmd spring-boot:run' `
        -WorkingDirectory $BackendDir `
        -RedirectStandardOutput $BackendOutLog `
        -RedirectStandardError $BackendErrLog `
        -PassThru

    Write-Host "Backend PID: $($backendProcess.Id)"
    Write-Host "Waiting $WaitSeconds seconds for backend to boot..."
    Start-Sleep -Seconds $WaitSeconds

    $testEmail = "test-all-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$([Guid]::NewGuid().ToString('N').Substring(0,6))@nova.app"
    $testPassword = 'StrongPass123'
    $wrongPassword = 'WrongPass999'
    $encryptedData = 'ZW5jcnlwdGVkLWN5Y2xl'
    $todayDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
    $timezoneOffset = '+00:00'
    $token = ''

    # 1) GET /api/health -> 200
    $r1 = Invoke-Api -Method 'GET' -Path '/api/health'
    Print-Result -Name 'GET /api/health' -Expected 200 -Actual $r1.StatusCode

    # 2) POST /api/auth/register with test email -> 201
    $registerBody = @{
        email = $testEmail
        password = $testPassword
        timezone = 'UTC'
    } | ConvertTo-Json -Compress
    $r2 = Invoke-Api -Method 'POST' -Path '/api/auth/register' -Body $registerBody
    Print-Result -Name 'POST /api/auth/register (new user)' -Expected 201 -Actual $r2.StatusCode

    # 3) POST /api/auth/register same email again -> 409
    $r3 = Invoke-Api -Method 'POST' -Path '/api/auth/register' -Body $registerBody
    Print-Result -Name 'POST /api/auth/register (duplicate user)' -Expected 409 -Actual $r3.StatusCode

    # 4) POST /api/auth/login with wrong password -> 401
    $wrongLoginBody = @{
        email = $testEmail
        password = $wrongPassword
    } | ConvertTo-Json -Compress
    $r4 = Invoke-Api -Method 'POST' -Path '/api/auth/login' -Body $wrongLoginBody
    Print-Result -Name 'POST /api/auth/login (wrong password)' -Expected 401 -Actual $r4.StatusCode

    # 5) POST /api/auth/login with correct password -> 200, save token
    $goodLoginBody = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json -Compress
    $r5 = Invoke-Api -Method 'POST' -Path '/api/auth/login' -Body $goodLoginBody
    Print-Result -Name 'POST /api/auth/login (correct password)' -Expected 200 -Actual $r5.StatusCode

    try {
        $json = $r5.Body | ConvertFrom-Json
        if ($json.accessToken) {
            $token = [string]$json.accessToken
        }
        elseif ($json.token) {
            $token = [string]$json.token
        }
    }
    catch {
        $token = ''
    }

    if ($token) {
        Write-Host 'PASS: token extracted from login response'
        $passCount++
    }
    else {
        Write-Host 'FAIL: could not extract token from login response'
        $failCount++
    }

    # 6) POST /api/cycles with token -> 201
    $cycleBody = @{
        encryptedData = $encryptedData
        dataType = 'CYCLE'
        logDate = $todayDate
    } | ConvertTo-Json -Compress
    $r6 = Invoke-Api -Method 'POST' -Path '/api/cycles' -Body $cycleBody -Token $token -TimezoneOffset $timezoneOffset
    Print-Result -Name 'POST /api/cycles (with token)' -Expected 201 -Actual $r6.StatusCode

    # 7) POST /api/cycles without token -> 403
    $r7 = Invoke-Api -Method 'POST' -Path '/api/cycles' -Body $cycleBody
    Print-Result -Name 'POST /api/cycles (without token)' -Expected 403 -Actual $r7.StatusCode

    Write-Host ''
    Write-Host "Test Summary: $passCount passed, $failCount failed"
    if ($failCount -eq 0) {
        Write-Host 'OVERALL: PASSED'
        exit 0
    }

    Write-Host 'OVERALL: FAILED'
    exit 1
}
finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Write-Host "Stopping backend (PID $($backendProcess.Id))..."
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
