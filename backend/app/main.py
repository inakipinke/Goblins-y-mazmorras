from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

from app.db import (
    ConflictError,
    NotFoundError,
    add_loot,
    apply_damage,
    consume_event,
    equip_item,
    get_db_path,
    get_goblin_snapshot,
    get_active_run,
    get_used_events_for_active_run,
    init_db,
    list_archetypes,
    list_equipment,
    list_event_types,
    list_inventory,
    list_items,
    list_zones,
    mark_defeat,
    reset_run,
    start_new_run,
    unequip_item,
    use_item,
)


class NewRunPayload(BaseModel):
    nombre: str = Field(min_length=1, max_length=40)
    arquetipo: str = Field(min_length=1)


class EquipPayload(BaseModel):
    item_id: int | None = None
    item_code: str | None = None

    @model_validator(mode="after")
    def validate_identifier(self) -> "EquipPayload":
        if (self.item_id is None) == (self.item_code is None):
            raise ValueError("Debes enviar exactamente uno: item_id o item_code.")
        return self


class ItemReferencePayload(EquipPayload):
    pass


class LootPayload(BaseModel):
    item_id: int | None = None
    item_code: str | None = None
    nivel: int | None = Field(default=None, ge=1)
    zona: str | None = None
    cantidad: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def validate_loot_source(self) -> "LootPayload":
        explicit_item = self.item_id is not None or self.item_code is not None
        random_item = self.nivel is not None or self.zona is not None

        if explicit_item and random_item:
            raise ValueError("Envia un item especifico o un nivel/zona para loot aleatorio, no ambas cosas.")

        if not explicit_item and not random_item:
            raise ValueError("Debes enviar item_id, item_code, nivel o zona.")

        if self.item_id is not None and self.item_code is not None:
            raise ValueError("Debes enviar solo uno: item_id o item_code.")

        if self.nivel is not None and self.zona is not None:
            raise ValueError("Debes enviar solo uno: nivel o zona.")

        return self


class DamagePayload(BaseModel):
    cantidad: int = Field(ge=1)


class ConsumeEventPayload(BaseModel):
    zona: str = Field(min_length=1)
    tipo: str = Field(min_length=1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Goblins y Mazmorras API",
    version="0.2.1",  # Incremented to force reload
    description="Backend del goblin roguelike con inventario, equipo y runs.",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Handle preflight OPTIONS requests
@app.options("/{path:path}")
async def options_handler(path: str):
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=400, detail=str(error))


@app.get("/")
def read_root() -> dict[str, object]:
    return {
        "name": "Goblins y Mazmorras API",
        "status": "ok",
        "docs": "/docs",
        "active_run": get_active_run(),
    }


@app.get("/health")
def healthcheck() -> dict[str, object]:
    return {
        "status": "healthy",
        "db_path": str(get_db_path()),
        "active_run": get_active_run() is not None,
    }


@app.get("/arquetipos")
def get_arquetipos() -> list[dict[str, object]]:
    return list_archetypes()


@app.get("/items")
def get_items() -> list[dict[str, object]]:
    return list_items()


@app.get("/zonas")
def get_zonas() -> list[dict[str, object]]:
    return list_zones()


@app.get("/eventos/tipos")
def get_tipos_evento() -> list[dict[str, object]]:
    return list_event_types()


@app.get("/run/actual")
def get_current_run() -> dict[str, object]:
    run = get_active_run()
    if run is None:
        raise HTTPException(status_code=404, detail="No hay una run activa.")
    return run


@app.post("/run/nueva")
def create_run(payload: NewRunPayload) -> dict[str, object]:
    try:
        goblin = start_new_run(payload.nombre.strip(), payload.arquetipo.strip())
    except Exception as error:
        raise _translate_error(error) from error

    return {
        "message": "Run creada correctamente.",
        "goblin": goblin,
        "inventario": list_inventory(),
        "equipo": list_equipment(),
    }


@app.post("/run/reset")
def reset_current_run() -> dict[str, object]:
    try:
        return reset_run()
    except Exception as error:
        raise _translate_error(error) from error


@app.get("/goblin")
def get_goblin() -> dict[str, object]:
    try:
        return get_goblin_snapshot()
    except Exception as error:
        raise _translate_error(error) from error


@app.get("/inventario")
def get_inventory() -> list[dict[str, object]]:
    try:
        return list_inventory()
    except Exception as error:
        raise _translate_error(error) from error


@app.get("/eventos/usados")
def get_used_events() -> list[dict[str, object]]:
    try:
        return get_used_events_for_active_run()
    except Exception as error:
        raise _translate_error(error) from error


@app.get("/equipo")
def get_equipped_items() -> list[dict[str, object]]:
    try:
        return list_equipment()
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/equipo/equipar")
def equip(payload: EquipPayload) -> dict[str, object]:
    try:
        return equip_item(item_id=payload.item_id, item_code=payload.item_code)
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/equipo/desequipar/{slot}")
def unequip(slot: str) -> dict[str, object]:
    try:
        return unequip_item(slot)
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/inventario/loot")
def loot(payload: LootPayload) -> dict[str, object]:
    try:
        return add_loot(
            item_id=payload.item_id,
            item_code=payload.item_code,
            nivel=payload.nivel,
            zona=payload.zona.strip() if payload.zona else None,
            cantidad=payload.cantidad,
        )
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/inventario/usar")
def consume_item(payload: ItemReferencePayload) -> dict[str, object]:
    try:
        return use_item(item_id=payload.item_id, item_code=payload.item_code)
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/goblin/recibir-dano")
def receive_damage(payload: DamagePayload) -> dict[str, object]:
    try:
        return apply_damage(payload.cantidad)
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/run/derrota")
def defeat_run() -> dict[str, object]:
    try:
        return mark_defeat()
    except Exception as error:
        raise _translate_error(error) from error


@app.post("/eventos/consumir")
def draw_event(payload: ConsumeEventPayload) -> dict[str, object]:
    try:
        event = consume_event(
            zona_codigo=payload.zona.strip(),
            tipo_evento=payload.tipo.strip(),
        )
    except Exception as error:
        raise _translate_error(error) from error

    return {
        "message": "Evento consumido correctamente.",
        "evento": event,
    }
