#!/bin/bash

set -e

INSTALL=false
if [[ "$1" == "--install" ]]; then
    INSTALL=true
fi

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$BACKEND_ROOT/.venv"
VENV_PYTHON="$VENV_PATH/bin/python"

find_system_python() {
    for python_cmd in python3 python; do
        if command -v "$python_cmd" >/dev/null 2>&1; then
            echo "$python_cmd"
            return 0
        fi
    done
    return 1
}

SYSTEM_PYTHON=$(find_system_python)

if [[ -z "$SYSTEM_PYTHON" ]]; then
    echo "Error: No encontré Python instalado. Instala Python 3.8+ antes de correr este script."
    exit 1
fi

if [[ "$INSTALL" == true ]]; then
    echo "Preparando entorno virtual en $VENV_PATH..."
    "$SYSTEM_PYTHON" -m venv --clear "$VENV_PATH"
elif [[ ! -f "$VENV_PYTHON" ]]; then
    echo "Creando entorno virtual en $VENV_PATH..."
    "$SYSTEM_PYTHON" -m venv "$VENV_PATH"
fi

if [[ "$INSTALL" == true ]]; then
    echo "Instalando dependencias..."
    "$VENV_PYTHON" -m pip install --upgrade pip
    "$VENV_PYTHON" -m pip install -r "$BACKEND_ROOT/requirements.txt"
fi

cd "$BACKEND_ROOT"
echo "Levantando backend en http://127.0.0.1:8000"
"$VENV_PYTHON" -m uvicorn app.main:app --reload