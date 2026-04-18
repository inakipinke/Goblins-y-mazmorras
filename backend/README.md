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
- crea y siembra arquetipos, items desde `items.json`, inventario inicial y tablas de run

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

### Base URL

Si corres el backend localmente con el script del repo:

```text
http://127.0.0.1:8000
```

## Notas importantes

- La tabla `items` se carga automaticamente desde `items.json` en la raiz del repo.
- `POST /inventario/loot` ahora puede recibir un item especifico o generar uno aleatorio por `nivel` o `zona`.
- Cada run nueva arranca limpia: sin equipo, con vida base, con inventario inicial base y sin eventos ya consumidos.

## Ejemplos utiles

### Crear run

```json
POST /run/nueva
{
  "nombre": "Berto",
  "arquetipo": "romantico"
}
```

### Loot directo

```json
POST /inventario/loot
{
  "item_code": "espada_oxidada",
  "cantidad": 1
}
```

### Loot aleatorio por nivel

```json
POST /inventario/loot
{
  "nivel": 2,
  "cantidad": 1
}
```

### Loot aleatorio por zona

```json
POST /inventario/loot
{
  "zona": "castillo",
  "cantidad": 1
}
```

### Consumir evento de mapa

```json
POST /eventos/consumir
{
  "zona": "inicial",
  "tipo": "Combate"
}
```

### Ver estado actual

- `GET /goblin`
- `GET /inventario`
- `GET /equipo`
- `GET /eventos/usados`

### Tests

Cuando el entorno este instalado:

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m pytest
```
