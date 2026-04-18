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
- crea y siembra arquetipos, items desde `items.json` y tablas de run

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
- `GET /equipo`
- `POST /equipo/equipar`
- `POST /equipo/desequipar/{slot}`
- `POST /goblin/recibir-dano`
- `POST /goblin/stats/asignar`
- `POST /run/derrota`
- `GET /docs`

### Base URL

Si corres el backend localmente con el script del repo:

```text
http://127.0.0.1:8000
```

## Notas importantes

- La tabla `items` se carga automaticamente desde `items.json` en la raiz del repo.
- El juego ya no usa items consumibles; todo el catalogo actual es equipable o de inventario permanente.
- `POST /inventario/loot` ahora puede recibir un item especifico o generar uno aleatorio por `nivel` o `zona`.
- El loot de una run ya no repite items: cada item puede obtenerse una sola vez por run, aunque despues se equipe o desequipe.
- Cada run nueva arranca limpia: sin equipo, con vida base, con inventario vacio y sin eventos ya consumidos.
- `POST /run/reset` ahora cierra la run activa y crea otra nueva al instante con el mismo nombre y arquetipo, pero reiniciada desde cero.
- `POST /goblin/stats/asignar` modifica solo los stats base del goblin de la run activa; nunca toca el arquetipo original.
- Los items equipados pueden sumar `bonus_vida` a la vida maxima total, pero la vida base de cada run vuelve a `100`.
- Los slots equipables validos son solo `casco`, `botas`, `armadura`, `arma` y `amuleto`; si equipas otro item del mismo slot, reemplaza al anterior.
- Regla del repo: cada API nueva debe agregarse tambien a esta documentacion.

## Ejemplos utiles

### Crear run

```json
POST /run/nueva
{
  "nombre": "Berto",
  "arquetipo": "romantico"
}
```

### Reiniciar run

```json
POST /run/reset
```

Reinicia la run activa y arranca otra nueva en el momento con:

- el mismo nombre
- el mismo arquetipo
- stats base limpias del arquetipo
- `vida_actual = 100`
- `vida_max = 100`
- inventario inicial
- equipo vacio

### Asignar puntos base al goblin

```json
POST /goblin/stats/asignar
{
  "stat": "fuerza",
  "cantidad": 3
}
```

`stat` puede ser `vida`, `fuerza`, `carisma` o `destreza`.
Los puntos se aplican solo al goblin de la run activa.

Si el stat es `vida`, se incrementan tanto `vida_max` como `vida_actual`.

### Loot directo

```json
POST /inventario/loot
{
  "item_code": "espada_oxidada",
  "cantidad": 1
}
```

Si ese item ya fue obtenido en la run actual, la API responde `409`.

### Loot aleatorio por nivel

```json
POST /inventario/loot
{
  "nivel": 2,
  "cantidad": 1
}
```

El backend evita repetir items ya obtenidos en la run y nunca entrega mas de una copia del mismo item.

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
