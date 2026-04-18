param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$backendRoot = $PSScriptRoot
$venvPath = Join-Path $backendRoot ".venv"

function Get-VenvPython {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VirtualEnvPath
    )

    $candidates = @(
        (Join-Path $VirtualEnvPath "Scripts\\python.exe"),
        (Join-Path $VirtualEnvPath "bin\\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $candidates[0]
}

function Remove-VenvSafely {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VirtualEnvPath
    )

    if (-not (Test-Path $VirtualEnvPath)) {
        return
    }

    try {
        Remove-Item -LiteralPath $VirtualEnvPath -Recurse -Force -ErrorAction Stop
    }
    catch {
        Write-Warning "No pude borrar $VirtualEnvPath automaticamente. Cierra procesos que usen la venv y borralo manualmente si queres recrearla."
        throw
    }
}

$venvPython = Get-VenvPython -VirtualEnvPath $venvPath
function Get-SystemPython {
    $candidates = @()

    if (Get-Command python -ErrorAction SilentlyContinue) {
        $candidates += (Get-Command python).Source
    }

    $pyVenvConfig = Join-Path $venvPath "pyvenv.cfg"
    if (Test-Path $pyVenvConfig) {
        $homeLine = Get-Content $pyVenvConfig | Where-Object { $_ -like "home = *" } | Select-Object -First 1
        if ($homeLine) {
            $homePath = $homeLine.Split("=", 2)[1].Trim()
            if ($homePath) {
                $candidates += (Join-Path $homePath "python.exe")
            }
        }
    }

    $candidates += @(
        (Join-Path $env:LocalAppData "Programs\\Python\\Python314\\python.exe"),
        (Join-Path $env:LocalAppData "Programs\\Python\\Python313\\python.exe"),
        (Join-Path $env:LocalAppData "Python\\pythoncore-3.14-64\\python.exe"),
        (Join-Path $env:LocalAppData "Python\\pythoncore-3.13-64\\python.exe")
    )

    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

$systemPython = Get-SystemPython

if (-not $systemPython) {
    Write-Error "No encontre Python instalado. Instala Python 3.13+ o agrega python al PATH antes de correr este script."
}

if ($Install) {
    Write-Host "Preparando entorno virtual en $venvPath..."
    Remove-VenvSafely -VirtualEnvPath $venvPath
    & $systemPython -m venv $venvPath
    $venvPython = Get-VenvPython -VirtualEnvPath $venvPath
}
elseif (-not (Test-Path $venvPython)) {
    Write-Host "Creando entorno virtual en $venvPath..."
    & $systemPython -m venv $venvPath
    $venvPython = Get-VenvPython -VirtualEnvPath $venvPath
}

if ($Install) {
    Write-Host "Instalando dependencias..."
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r (Join-Path $backendRoot "requirements.txt")
}

Push-Location $backendRoot
try {
    Write-Host "Levantando backend en http://127.0.0.1:8000"
    & $venvPython -m uvicorn app.main:app --reload
}
finally {
    Pop-Location
}
