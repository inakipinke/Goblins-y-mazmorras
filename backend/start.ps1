param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$backendRoot = $PSScriptRoot
$venvPath = Join-Path $backendRoot ".venv"
$venvPython = Join-Path $venvPath "Scripts\\python.exe"
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
    & $systemPython -m venv --clear $venvPath
}
elseif (-not (Test-Path $venvPython)) {
    Write-Host "Creando entorno virtual en $venvPath..."
    & $systemPython -m venv $venvPath
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
