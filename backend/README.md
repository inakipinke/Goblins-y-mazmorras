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

### Base URL

Si corres el backend localmente con el script del repo:

```text
http://127.0.0.1:8000
```

Todos los ejemplos de abajo asumen esa URL.

### Como consumir cada API

#### `GET /`

Sirve para comprobar que la API responde.

Ejemplo:

```http
GET / HTTP/1.1
Host: 127.0.0.1:8000
```

Respuesta esperada:

```json
{
  "name": "Goblins y Mazmorras API",
  "status": "ok",
  "docs": "/docs",
  "active_run": null
}
```

#### `GET /health`

Sirve para healthcheck y para saber si hay una run activa.

Respuesta ejemplo:

```json
{
  "status": "healthy",
  "db_path": "C:/.../backend/data/goblins.db",
  "active_run": false
}
```

#### `GET /arquetipos`

Devuelve los 3 arquetipos base del goblin.

Respuesta ejemplo:

```json
[
  {
    "codigo": "malo",
    "nombre": "Goblin Malo",
    "descripcion": "Resuelve todo a los golpes.",
    "fuerza_base": 15,
    "carisma_base": 8,
    "destreza_base": 12
  }
]
```

#### `GET /items`

Devuelve el catalogo de items disponibles.

Te sirve para obtener `id`, `item_code`, stats y tipo de item antes de lootear, equipar o usar.

#### `GET /zonas`

Devuelve las zonas del mapa:

```json
[
  { "codigo": "inicial", "nombre": "Zona Inicial", "archivo": "eventos.json", "nivel": 1 },
  { "codigo": "ciudad", "nombre": "Ciudad", "archivo": "eventos2.json", "nivel": 2 },
  { "codigo": "castillo", "nombre": "Castillo", "archivo": "eventos3.json", "nivel": 3 }
]
```

#### `GET /eventos/tipos`

Devuelve los tipos de evento posibles cargados desde `tiposeventos.json`.

Ejemplo de respuesta:

```json
[
  {
    "tipo": "Combate",
    "descripcion": "Eventos centrados en enfrentar enemigos...",
    "includes": ["peleas contra enemigos comunes", "emboscadas"]
  }
]
```

#### `GET /run/actual`

Devuelve la run activa.

Si no hay una run activa devuelve `404`.

#### `POST /run/nueva`

Crea una run nueva y reinicia el estado actual del jugador.

Body:

```json
{
  "nombre": "Berto",
  "arquetipo": "romantico"
}
```

Respuesta ejemplo:

```json
{
  "message": "Run creada correctamente.",
  "goblin": {
    "id": 1,
    "nombre": "Berto",
    "arquetipo": "romantico",
    "vida_actual": 100,
    "vida_max": 100,
    "oro": 0,
    "esta_vivo": true,
    "run": {
      "id": 1,
      "arquetipo_codigo": "romantico",
      "goblin_nombre": "Berto",
      "estado": "active",
      "started_at": "2026-04-18 12:00:00",
      "ended_at": null
    },
    "stats_base": {
      "fuerza": 8,
      "carisma": 15,
      "destreza": 12
    },
    "bonus_equipo": {
      "fuerza": 0,
      "carisma": 0,
      "destreza": 0
    },
    "stats_totales": {
      "fuerza": 8,
      "carisma": 15,
      "destreza": 12
    }
  },
  "inventario": [
    {
      "codigo": "venda_sucia",
      "cantidad": 3
    }
  ],
  "equipo": []
}
```

#### `POST /run/reset`

Resetea la run activa y borra el estado actual del goblin.

Respuesta ejemplo:

```json
{
  "message": "La run fue reiniciada y el estado actual se borro.",
  "run_id": 1
}
```

#### `POST /run/derrota`

Marca la run activa como perdida.

Respuesta ejemplo:

```json
{
  "message": "La run fue marcada como derrota.",
  "run_id": 1,
  "estado": "defeated"
}
```

#### `GET /goblin`

Devuelve el estado actual del goblin.

Incluye:

- stats base
- bonus por equipo
- stats totales
- vida
- oro
- estado de la run

Si no hay run activa devuelve `404`.

#### `GET /inventario`

Devuelve el inventario actual del goblin.

Ejemplo de respuesta:

```json
[
  {
    "id": 5,
    "codigo": "venda_sucia",
    "nombre": "Venda Sucia",
    "descripcion": "Mejor no preguntar de donde salio.",
    "tipo": "consumible",
    "slot": null,
    "bonus_fuerza": 0,
    "bonus_carisma": 0,
    "bonus_destreza": 0,
    "apilable": 1,
    "efecto_tipo": "heal",
    "efecto_valor": 3,
    "cantidad": 3
  }
]
```

#### `POST /inventario/loot`

Agrega un item al inventario de la run.

Podés mandar `item_id` o `item_code`, pero no los dos al mismo tiempo.

Body usando `item_code`:

```json
{
  "item_code": "garrote_astillado",
  "cantidad": 1
}
```

Respuesta:

```json
{
  "message": "Loot agregado correctamente.",
  "item": {
    "id": 1,
    "codigo": "garrote_astillado",
    "nombre": "Garrote Astillado"
  },
  "cantidad": 1,
  "inventario": []
}
```

#### `POST /inventario/usar`

Usa un item consumible del inventario.

Body:

```json
{
  "item_code": "venda_sucia"
}
```

Respuesta ejemplo:

```json
{
  "message": "Item usado correctamente.",
  "efecto": "heal",
  "valor": 3,
  "curacion_aplicada": 3,
  "goblin": {},
  "inventario": []
}
```

Si el item no es consumible devuelve `409`.

#### `GET /equipo`

Devuelve los objetos actualmente equipados.

Respuesta ejemplo:

```json
[
  {
    "slot": "arma",
    "id": 1,
    "codigo": "garrote_astillado",
    "nombre": "Garrote Astillado",
    "descripcion": "No es elegante, pero pega fuerte.",
    "tipo": "arma",
    "bonus_fuerza": 1,
    "bonus_carisma": 0,
    "bonus_destreza": 0
  }
]
```

#### `POST /equipo/equipar`

Equipa un item desde el inventario.

Body:

```json
{
  "item_code": "garrote_astillado"
}
```

O:

```json
{
  "item_id": 1
}
```

Respuesta ejemplo:

```json
{
  "message": "Item equipado correctamente.",
  "equipo": [],
  "inventario": [],
  "goblin": {}
}
```

Si ya hay un item en ese slot, lo desequipa automaticamente y vuelve al inventario.

#### `POST /equipo/desequipar/{slot}`

Desequipa el item de un slot especifico.

Ejemplo:

```http
POST /equipo/desequipar/arma HTTP/1.1
Host: 127.0.0.1:8000
```

Respuesta ejemplo:

```json
{
  "message": "Item desequipado correctamente.",
  "equipo": [],
  "inventario": [],
  "goblin": {}
}
```

#### `POST /goblin/recibir-dano`

Aplica dano al goblin.

Body:

```json
{
  "cantidad": 25
}
```

Respuesta ejemplo si sigue vivo:

```json
{
  "message": "Dano aplicado correctamente.",
  "dano": 25,
  "vida_actual": 75,
  "esta_vivo": true,
  "run_estado": "active",
  "goblin": {}
}
```

Respuesta ejemplo si muere:

```json
{
  "message": "Dano aplicado correctamente.",
  "dano": 100,
  "vida_actual": 0,
  "esta_vivo": false,
  "run_estado": "defeated"
}
```

#### `POST /eventos/consumir`

Consume un evento hexagonal no repetido para la run actual.

Body:

```json
{
  "zona": "inicial",
  "tipo": "Combate"
}
```

Respuesta ejemplo:

```json
{
  "message": "Evento consumido correctamente.",
  "evento": {
    "id": 1,
    "zona": "inicial",
    "nivel": 1,
    "indice": 1,
    "nombre": "Trampa",
    "tipo": "Combate",
    "descripcion": "Un animal salvaje te ataca.",
    "options": [],
    "effect": null,
    "success": {},
    "failure": {},
    "raw": {}
  }
}
```

Si ya no quedan eventos disponibles para esa `zona` y ese `tipo`, devuelve `409`.

#### `GET /eventos/usados`

Devuelve todos los eventos ya consumidos en la run actual.

Te sirve para debug, save-state o frontend si querés mostrar historial.

### Orden recomendado de consumo

1. `POST /run/nueva`
2. `GET /goblin`
3. `GET /zonas`
4. `GET /eventos/tipos`
5. `POST /eventos/consumir`
6. Resolver el evento en frontend
7. Según el resultado, llamar a `POST /inventario/loot`, `POST /inventario/usar`, `POST /goblin/recibir-dano`, `POST /equipo/equipar` o `POST /run/derrota`

### Errores comunes

- `404`: no existe la run activa, la zona, el tipo de evento o el recurso pedido
- `409`: conflicto de estado, por ejemplo no quedan eventos disponibles o intentás usar/equipar algo inválido
- `400`: body inválido o faltan campos

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
