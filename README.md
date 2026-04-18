# Goblins-y-mazmorras

Juegito para la hackaton UTN 2026.

## Backend

El backend usa FastAPI y vive en `backend/`.
La base de datos local usa SQLite y se crea sola al iniciar.

El modelo del juego esta orientado a un solo jugador y una sola run activa por vez.
Las tablas principales son:

- `arquetipos`
- `runs`
- `goblin`
- `items`
- `inventario`
- `equipo`
- `zonas`
- `tipos_evento`
- `eventos`
- `run_eventos_usados`

### Arranque rapido en Windows

Desde la raiz del repo:

```powershell
.\backend\start.ps1 -Install
```

Eso hace lo siguiente:

- recrea `backend/.venv` para asegurar un entorno sano
- instala dependencias de `backend/requirements.txt`
- levanta la API con recarga automatica en `http://127.0.0.1:8000`
- crea la base SQLite local si no existe
- crea y siembra arquetipos, items base, inventario inicial y tablas de run

Usa `.\backend\start.ps1` sin `-Install` si solo queres volver a levantarlo usando el entorno ya creado.

### Endpoints base

- `GET /`
- `GET /health`
- `GET /arquetipos`
- `GET /items`
- `GET /zonas`
- `GET /eventos/tipos`
- `GET /run/actual`
- `POST /run/nueva`
- `POST /run/reset`
- `GET /goblin`
- `GET /inventario`
- `GET /eventos/usados`
- `POST /eventos/consumir`
- `POST /inventario/loot`
- `POST /inventario/usar`
- `GET /equipo`
- `POST /equipo/equipar`
- `POST /equipo/desequipar/{slot}`
- `POST /goblin/recibir-dano`
- `POST /run/derrota`
- `GET /docs`

### Arquetipos

- `romantico`: mas carisma
- `malo`: mas fuerza
- `rayo_mcqueen`: mas destreza

### Flujo recomendado

1. `POST /run/nueva` con `nombre` y `arquetipo`
2. `GET /goblin` para stats base y totales
3. `GET /inventario`
4. `POST /equipo/equipar`
5. `GET /equipo`
6. `POST /goblin/recibir-dano` durante combate
7. `POST /inventario/usar` para consumibles
8. `POST /run/derrota` o `POST /run/reset` cuando el jugador pierde

### Eventos hexagonales

Los eventos de mapa se cargan automaticamente desde los JSON del repo:

- `eventos.json` para la zona `inicial`
- `eventos2.json` para la zona `ciudad`
- `eventos3.json` para la zona `castillo`
- `tiposeventos.json` para las definiciones de tipos

Cuando el frontend detecta que el jugador pisa una casilla, puede consumir un evento no repetido de esa zona y ese tipo:

```json
POST /eventos/consumir
{
  "zona": "inicial",
  "tipo": "Combate"
}
```

La API devuelve un evento no usado para la run actual y lo marca inmediatamente como consumido para que no vuelva a salir en esa misma partida.

### Tests

Cuando el entorno este instalado:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m pytest
```
