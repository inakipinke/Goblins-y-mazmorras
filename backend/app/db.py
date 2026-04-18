from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "goblins.db"
REPO_ROOT = Path(__file__).resolve().parents[2]

ZONE_SOURCES = (
    {
        "codigo": "inicial",
        "nombre": "Zona Inicial",
        "archivo": "eventos.json",
        "nivel": 1,
    },
    {
        "codigo": "ciudad",
        "nombre": "Ciudad",
        "archivo": "eventos2.json",
        "nivel": 2,
    },
    {
        "codigo": "castillo",
        "nombre": "Castillo",
        "archivo": "eventos3.json",
        "nivel": 3,
    },
)

ARCHETYPES = (
    {
        "codigo": "romantico",
        "nombre": "Goblin Romantico",
        "descripcion": "Tiene mas carisma que verguenza.",
        "fuerza_base":8,
        "carisma_base": 15,
        "destreza_base": 12,
    },
    {
        "codigo": "malo",
        "nombre": "Goblin Malo",
        "descripcion": "Resuelve todo a los golpes.",
        "fuerza_base": 15,
        "carisma_base": 8,
        "destreza_base": 12,
    },
    {
        "codigo": "rayo_mcqueen",
        "nombre": "Goblin Rayo McQueen",
        "descripcion": "No piensa, acelera.",
        "fuerza_base": 12,
        "carisma_base": 8,
        "destreza_base": 15,
    },
)

ITEMS = (
    {
        "codigo": "garrote_astillado",
        "nombre": "Garrote Astillado",
        "descripcion": "No es elegante, pero pega fuerte.",
        "tipo": "arma",
        "slot": "arma",
        "bonus_fuerza": 1,
        "bonus_carisma": 0,
        "bonus_destreza": 0,
        "apilable": 0,
        "efecto_tipo": None,
        "efecto_valor": 0,
    },
    {
        "codigo": "rosa_robada",
        "nombre": "Rosa Robada",
        "descripcion": "Le da un encanto dudoso al portador.",
        "tipo": "accesorio",
        "slot": "accesorio",
        "bonus_fuerza": 0,
        "bonus_carisma": 1,
        "bonus_destreza": 0,
        "apilable": 0,
        "efecto_tipo": None,
        "efecto_valor": 0,
    },
    {
        "codigo": "botas_chispeantes",
        "nombre": "Botas Chispeantes",
        "descripcion": "No frenan nunca.",
        "tipo": "armadura",
        "slot": "botas",
        "bonus_fuerza": 0,
        "bonus_carisma": 0,
        "bonus_destreza": 1,
        "apilable": 0,
        "efecto_tipo": None,
        "efecto_valor": 0,
    },
    {
        "codigo": "chaleco_remendado",
        "nombre": "Chaleco Remendado",
        "descripcion": "Parece fragil, pero impone respeto goblin.",
        "tipo": "armadura",
        "slot": "armadura",
        "bonus_fuerza": 0,
        "bonus_carisma": 1,
        "bonus_destreza": 0,
        "apilable": 0,
        "efecto_tipo": None,
        "efecto_valor": 0,
    },
    {
        "codigo": "venda_sucia",
        "nombre": "Venda Sucia",
        "descripcion": "Mejor no preguntar de donde salio.",
        "tipo": "consumible",
        "slot": None,
        "bonus_fuerza": 0,
        "bonus_carisma": 0,
        "bonus_destreza": 0,
        "apilable": 1,
        "efecto_tipo": "heal",
        "efecto_valor": 3,
    },
)

STARTER_LOADOUT = (
    ("venda_sucia", 3),
)


class GameStateError(Exception):
    pass


class NotFoundError(GameStateError):
    pass


class ConflictError(GameStateError):
    pass


def get_db_path() -> Path:
    configured_path = os.getenv("APP_DB_PATH")
    if configured_path:
        return Path(configured_path).expanduser().resolve()

    return DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS arquetipos (
                codigo TEXT PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE,
                descripcion TEXT NOT NULL,
                fuerza_base INTEGER NOT NULL,
                carisma_base INTEGER NOT NULL,
                destreza_base INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                arquetipo_codigo TEXT NOT NULL,
                goblin_nombre TEXT NOT NULL,
                estado TEXT NOT NULL DEFAULT 'active',
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT,
                FOREIGN KEY (arquetipo_codigo) REFERENCES arquetipos(codigo)
            );

            CREATE TABLE IF NOT EXISTS goblin (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                arquetipo_codigo TEXT NOT NULL,
                fuerza_base INTEGER NOT NULL,
                carisma_base INTEGER NOT NULL,
                destreza_base INTEGER NOT NULL,
                vida_actual INTEGER NOT NULL DEFAULT 100,
                vida_max INTEGER NOT NULL DEFAULT 100,
                oro INTEGER NOT NULL DEFAULT 0,
                esta_vivo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
                FOREIGN KEY (arquetipo_codigo) REFERENCES arquetipos(codigo)
            );

            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                descripcion TEXT NOT NULL,
                tipo TEXT NOT NULL,
                slot TEXT,
                bonus_fuerza INTEGER NOT NULL DEFAULT 0,
                bonus_carisma INTEGER NOT NULL DEFAULT 0,
                bonus_destreza INTEGER NOT NULL DEFAULT 0,
                apilable INTEGER NOT NULL DEFAULT 0,
                efecto_tipo TEXT,
                efecto_valor INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goblin_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                cantidad INTEGER NOT NULL DEFAULT 1 CHECK(cantidad >= 0),
                UNIQUE(goblin_id, item_id),
                FOREIGN KEY (goblin_id) REFERENCES goblin(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id)
            );

            CREATE TABLE IF NOT EXISTS equipo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goblin_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                slot TEXT NOT NULL,
                UNIQUE(goblin_id, slot),
                UNIQUE(goblin_id, item_id),
                FOREIGN KEY (goblin_id) REFERENCES goblin(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id)
            );

            CREATE TABLE IF NOT EXISTS zonas (
                codigo TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                archivo TEXT NOT NULL UNIQUE,
                nivel INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tipos_evento (
                tipo TEXT PRIMARY KEY,
                descripcion TEXT NOT NULL,
                includes_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zona_codigo TEXT NOT NULL,
                nivel INTEGER NOT NULL,
                source_index INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                tipo TEXT NOT NULL,
                descripcion TEXT,
                options_json TEXT,
                effect_json TEXT,
                success_json TEXT,
                failure_json TEXT,
                raw_json TEXT NOT NULL,
                UNIQUE(zona_codigo, source_index),
                FOREIGN KEY (zona_codigo) REFERENCES zonas(codigo),
                FOREIGN KEY (tipo) REFERENCES tipos_evento(tipo)
            );

            CREATE TABLE IF NOT EXISTS run_eventos_usados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                evento_id INTEGER NOT NULL,
                used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(run_id, evento_id),
                FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
                FOREIGN KEY (evento_id) REFERENCES eventos(id)
            );
            """
        )
        _ensure_items_columns(connection)
        _seed_archetypes(connection)
        _seed_items(connection)
        _seed_zones(connection)
        _seed_event_types(connection)
        _seed_events(connection)
        connection.commit()


def _ensure_items_columns(connection: sqlite3.Connection) -> None:
    item_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(items)").fetchall()
    }
    if "efecto_tipo" not in item_columns:
        connection.execute("ALTER TABLE items ADD COLUMN efecto_tipo TEXT")
    if "efecto_valor" not in item_columns:
        connection.execute("ALTER TABLE items ADD COLUMN efecto_valor INTEGER NOT NULL DEFAULT 0")


def _seed_archetypes(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO arquetipos (
            codigo, nombre, descripcion, fuerza_base, carisma_base, destreza_base
        ) VALUES (
            :codigo, :nombre, :descripcion, :fuerza_base, :carisma_base, :destreza_base
        )
        ON CONFLICT(codigo) DO UPDATE SET
            nombre = excluded.nombre,
            descripcion = excluded.descripcion,
            fuerza_base = excluded.fuerza_base,
            carisma_base = excluded.carisma_base,
            destreza_base = excluded.destreza_base
        """,
        ARCHETYPES,
    )


def _seed_items(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO items (
            codigo, nombre, descripcion, tipo, slot,
            bonus_fuerza, bonus_carisma, bonus_destreza, apilable, efecto_tipo, efecto_valor
        ) VALUES (
            :codigo, :nombre, :descripcion, :tipo, :slot,
            :bonus_fuerza, :bonus_carisma, :bonus_destreza, :apilable, :efecto_tipo, :efecto_valor
        )
        ON CONFLICT(codigo) DO UPDATE SET
            nombre = excluded.nombre,
            descripcion = excluded.descripcion,
            tipo = excluded.tipo,
            slot = excluded.slot,
            bonus_fuerza = excluded.bonus_fuerza,
            bonus_carisma = excluded.bonus_carisma,
            bonus_destreza = excluded.bonus_destreza,
            apilable = excluded.apilable,
            efecto_tipo = excluded.efecto_tipo,
            efecto_valor = excluded.efecto_valor
        """,
        ITEMS,
    )


def _seed_zones(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO zonas (codigo, nombre, archivo, nivel)
        VALUES (:codigo, :nombre, :archivo, :nivel)
        ON CONFLICT(codigo) DO UPDATE SET
            nombre = excluded.nombre,
            archivo = excluded.archivo,
            nivel = excluded.nivel
        """,
        ZONE_SOURCES,
    )


def _seed_event_types(connection: sqlite3.Connection) -> None:
    data = _load_json_file("tiposeventos.json")
    payload = [
        {
            "tipo": entry["type"],
            "descripcion": entry["description"],
            "includes_json": json.dumps(entry.get("includes", []), ensure_ascii=False),
        }
        for entry in data["eventTypes"]
    ]

    connection.executemany(
        """
        INSERT INTO tipos_evento (tipo, descripcion, includes_json)
        VALUES (:tipo, :descripcion, :includes_json)
        ON CONFLICT(tipo) DO UPDATE SET
            descripcion = excluded.descripcion,
            includes_json = excluded.includes_json
        """,
        payload,
    )


def _seed_events(connection: sqlite3.Connection) -> None:
    payload = []
    for zone in ZONE_SOURCES:
        data = _load_json_file(zone["archivo"])
        level = data.get("level", zone["nivel"])
        for index, event in enumerate(data["events"], start=1):
            payload.append(
                {
                    "zona_codigo": zone["codigo"],
                    "nivel": level,
                    "source_index": index,
                    "nombre": event["name"],
                    "tipo": event["type"],
                    "descripcion": event.get("description"),
                    "options_json": _dump_json_or_none(event.get("options")),
                    "effect_json": _dump_json_or_none(event.get("effect")),
                    "success_json": _dump_json_or_none(event.get("success")),
                    "failure_json": _dump_json_or_none(event.get("failure")),
                    "raw_json": json.dumps(event, ensure_ascii=False),
                }
            )

    connection.executemany(
        """
        INSERT INTO eventos (
            zona_codigo,
            nivel,
            source_index,
            nombre,
            tipo,
            descripcion,
            options_json,
            effect_json,
            success_json,
            failure_json,
            raw_json
        ) VALUES (
            :zona_codigo,
            :nivel,
            :source_index,
            :nombre,
            :tipo,
            :descripcion,
            :options_json,
            :effect_json,
            :success_json,
            :failure_json,
            :raw_json
        )
        ON CONFLICT(zona_codigo, source_index) DO UPDATE SET
            nivel = excluded.nivel,
            nombre = excluded.nombre,
            tipo = excluded.tipo,
            descripcion = excluded.descripcion,
            options_json = excluded.options_json,
            effect_json = excluded.effect_json,
            success_json = excluded.success_json,
            failure_json = excluded.failure_json,
            raw_json = excluded.raw_json
        """,
        payload,
    )


def _load_json_file(filename: str) -> dict[str, Any]:
    with (REPO_ROOT / filename).open("r", encoding="utf-8") as file:
        return json.load(file)


def _dump_json_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def list_archetypes() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT codigo, nombre, descripcion, fuerza_base, carisma_base, destreza_base
            FROM arquetipos
            ORDER BY codigo
            """
        ).fetchall()

    return [dict(row) for row in rows]


def list_items() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                codigo,
                nombre,
                descripcion,
                tipo,
                slot,
                bonus_fuerza,
                bonus_carisma,
                bonus_destreza,
                apilable,
                efecto_tipo,
                efecto_valor
            FROM items
            ORDER BY id
            """
        ).fetchall()

    return [dict(row) for row in rows]


def list_zones() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT codigo, nombre, archivo, nivel
            FROM zonas
            ORDER BY nivel
            """
        ).fetchall()

    return [dict(row) for row in rows]


def list_event_types() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT tipo, descripcion, includes_json
            FROM tipos_evento
            ORDER BY tipo
            """
        ).fetchall()

    payload = []
    for row in rows:
        event_type = dict(row)
        event_type["includes"] = json.loads(event_type.pop("includes_json"))
        payload.append(event_type)
    return payload


def get_active_run() -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, arquetipo_codigo, goblin_nombre, estado, started_at, ended_at
            FROM runs
            WHERE estado = 'active'
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

    return _row_to_dict(row)


def get_goblin_snapshot() -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        equipment_bonus = _get_equipment_bonus(connection, goblin["id"])
        run = _get_active_run_row(connection)

        return {
            "id": goblin["id"],
            "nombre": goblin["nombre"],
            "arquetipo": goblin["arquetipo_codigo"],
            "vida_actual": goblin["vida_actual"],
            "vida_max": goblin["vida_max"],
            "oro": goblin["oro"],
            "esta_vivo": bool(goblin["esta_vivo"]),
            "run": _row_to_dict(run),
            "stats_base": {
                "fuerza": goblin["fuerza_base"],
                "carisma": goblin["carisma_base"],
                "destreza": goblin["destreza_base"],
            },
            "bonus_equipo": equipment_bonus,
            "stats_totales": {
                "fuerza": goblin["fuerza_base"] + equipment_bonus["fuerza"],
                "carisma": goblin["carisma_base"] + equipment_bonus["carisma"],
                "destreza": goblin["destreza_base"] + equipment_bonus["destreza"],
            },
        }


def list_inventory() -> list[dict[str, Any]]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        rows = connection.execute(
            """
            SELECT
                i.id,
                i.codigo,
                i.nombre,
                i.descripcion,
                i.tipo,
                i.slot,
                i.bonus_fuerza,
                i.bonus_carisma,
                i.bonus_destreza,
                i.apilable,
                i.efecto_tipo,
                i.efecto_valor,
                inv.cantidad
            FROM inventario inv
            JOIN items i ON i.id = inv.item_id
            WHERE inv.goblin_id = ?
            ORDER BY i.nombre
            """,
            (goblin["id"],),
        ).fetchall()

    return [dict(row) for row in rows]


def list_equipment() -> list[dict[str, Any]]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        rows = connection.execute(
            """
            SELECT
                e.slot,
                i.id,
                i.codigo,
                i.nombre,
                i.descripcion,
                i.tipo,
                i.bonus_fuerza,
                i.bonus_carisma,
                i.bonus_destreza
            FROM equipo e
            JOIN items i ON i.id = e.item_id
            WHERE e.goblin_id = ?
            ORDER BY e.slot
            """,
            (goblin["id"],),
        ).fetchall()

    return [dict(row) for row in rows]


def consume_event(zona_codigo: str, tipo_evento: str) -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        zone = connection.execute(
            "SELECT codigo FROM zonas WHERE codigo = ?",
            (zona_codigo,),
        ).fetchone()
        if zone is None:
            raise NotFoundError(f"La zona '{zona_codigo}' no existe.")

        event_type = connection.execute(
            "SELECT tipo FROM tipos_evento WHERE tipo = ?",
            (tipo_evento,),
        ).fetchone()
        if event_type is None:
            raise NotFoundError(f"El tipo de evento '{tipo_evento}' no existe.")

        event = connection.execute(
            """
            SELECT
                e.id,
                e.zona_codigo,
                e.nivel,
                e.source_index,
                e.nombre,
                e.tipo,
                e.descripcion,
                e.options_json,
                e.effect_json,
                e.success_json,
                e.failure_json,
                e.raw_json
            FROM eventos e
            LEFT JOIN run_eventos_usados reu
                ON reu.evento_id = e.id
               AND reu.run_id = ?
            WHERE e.zona_codigo = ?
              AND e.tipo = ?
              AND reu.id IS NULL
            ORDER BY e.source_index
            LIMIT 1
            """,
            (goblin["run_id"], zona_codigo, tipo_evento),
        ).fetchone()

        if event is None:
            raise ConflictError(
                f"No quedan eventos sin usar para la zona '{zona_codigo}' y el tipo '{tipo_evento}' en esta run."
            )

        connection.execute(
            """
            INSERT INTO run_eventos_usados (run_id, evento_id)
            VALUES (?, ?)
            """,
            (goblin["run_id"], event["id"]),
        )
        connection.commit()

    return _hydrate_event_row(event)


def start_new_run(nombre: str, arquetipo_codigo: str) -> dict[str, Any]:
    with get_connection() as connection:
        archetype = connection.execute(
            """
            SELECT codigo, nombre, descripcion, fuerza_base, carisma_base, destreza_base
            FROM arquetipos
            WHERE codigo = ?
            """,
            (arquetipo_codigo,),
        ).fetchone()
        if archetype is None:
            raise NotFoundError(f"El arquetipo '{arquetipo_codigo}' no existe.")

        connection.execute(
            """
            UPDATE runs
            SET estado = 'abandoned', ended_at = CURRENT_TIMESTAMP
            WHERE estado = 'active'
            """
        )
        connection.execute("DELETE FROM goblin")

        run_cursor = connection.execute(
            """
            INSERT INTO runs (arquetipo_codigo, goblin_nombre, estado)
            VALUES (?, ?, 'active')
            """,
            (arquetipo_codigo, nombre),
        )
        run_id = run_cursor.lastrowid

        goblin_cursor = connection.execute(
            """
            INSERT INTO goblin (
                run_id,
                nombre,
                arquetipo_codigo,
                fuerza_base,
                carisma_base,
                destreza_base,
                vida_actual,
                vida_max,
                oro,
                esta_vivo
            ) VALUES (?, ?, ?, ?, ?, ?, 100, 100, 0, 1)
            """,
            (
                run_id,
                nombre,
                arquetipo_codigo,
                archetype["fuerza_base"],
                archetype["carisma_base"],
                archetype["destreza_base"],
            ),
        )
        goblin_id = goblin_cursor.lastrowid
        _seed_starter_inventory(connection, goblin_id)
        connection.commit()

    return get_goblin_snapshot()


def reset_run() -> dict[str, Any]:
    with get_connection() as connection:
        active_run = _get_active_run_row(connection)
        if active_run is None:
            raise NotFoundError("No hay una run activa para reiniciar.")

        connection.execute(
            """
            UPDATE runs
            SET estado = 'reset', ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (active_run["id"],),
        )
        connection.execute("DELETE FROM goblin WHERE run_id = ?", (active_run["id"],))
        connection.commit()

    return {
        "message": "La run fue reiniciada y el estado actual se borro.",
        "run_id": active_run["id"],
    }


def add_loot(*, item_id: int | None = None, item_code: str | None = None, cantidad: int = 1) -> dict[str, Any]:
    if cantidad <= 0:
        raise ConflictError("La cantidad de loot debe ser mayor a cero.")

    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        item = _get_item_catalog(connection, item_id=item_id, item_code=item_code)
        if item is None:
            raise NotFoundError("El item indicado no existe en el catalogo.")

        _add_inventory_quantity(connection, goblin["id"], item["id"], cantidad)
        connection.commit()

    return {
        "message": "Loot agregado correctamente.",
        "item": dict(item),
        "cantidad": cantidad,
        "inventario": list_inventory(),
    }


def use_item(*, item_id: int | None = None, item_code: str | None = None) -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        item = _get_inventory_item(connection, goblin["id"], item_id=item_id, item_code=item_code)
        if item is None:
            raise NotFoundError("El item no existe en el inventario.")
        if item["tipo"] != "consumible":
            raise ConflictError("Solo se pueden usar items consumibles.")

        effect_type = item["efecto_tipo"]
        effect_value = item["efecto_valor"]
        if effect_type != "heal":
            raise ConflictError("El item no tiene un efecto usable configurado.")

        updated_life = min(goblin["vida_actual"] + effect_value, goblin["vida_max"])
        healed_amount = updated_life - goblin["vida_actual"]

        connection.execute(
            """
            UPDATE goblin
            SET vida_actual = ?
            WHERE id = ?
            """,
            (updated_life, goblin["id"]),
        )
        _remove_inventory_quantity(connection, goblin["id"], item["id"], 1)
        connection.commit()

    return {
        "message": "Item usado correctamente.",
        "efecto": effect_type,
        "valor": effect_value,
        "curacion_aplicada": healed_amount,
        "goblin": get_goblin_snapshot(),
        "inventario": list_inventory(),
    }


def apply_damage(cantidad: int) -> dict[str, Any]:
    if cantidad <= 0:
        raise ConflictError("La cantidad de dano debe ser mayor a cero.")

    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        updated_life = max(goblin["vida_actual"] - cantidad, 0)
        is_alive = 1 if updated_life > 0 else 0
        connection.execute(
            """
            UPDATE goblin
            SET vida_actual = ?, esta_vivo = ?
            WHERE id = ?
            """,
            (updated_life, is_alive, goblin["id"]),
        )

        run_state = "active"
        if updated_life == 0:
            connection.execute(
                """
                UPDATE runs
                SET estado = 'defeated', ended_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (goblin["run_id"],),
            )
            run_state = "defeated"

        connection.commit()

    response: dict[str, Any] = {
        "message": "Dano aplicado correctamente.",
        "dano": cantidad,
        "vida_actual": updated_life,
        "esta_vivo": updated_life > 0,
        "run_estado": run_state,
    }
    if updated_life > 0:
        response["goblin"] = get_goblin_snapshot()
    return response


def mark_defeat() -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa para marcar derrota.")

        connection.execute(
            """
            UPDATE goblin
            SET vida_actual = 0, esta_vivo = 0
            WHERE id = ?
            """,
            (goblin["id"],),
        )
        connection.execute(
            """
            UPDATE runs
            SET estado = 'defeated', ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (goblin["run_id"],),
        )
        connection.commit()

    return {
        "message": "La run fue marcada como derrota.",
        "run_id": goblin["run_id"],
        "estado": "defeated",
    }


def get_used_events_for_active_run() -> list[dict[str, Any]]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        rows = connection.execute(
            """
            SELECT
                e.id,
                e.zona_codigo,
                e.nivel,
                e.source_index,
                e.nombre,
                e.tipo,
                e.descripcion,
                e.options_json,
                e.effect_json,
                e.success_json,
                e.failure_json,
                e.raw_json
            FROM run_eventos_usados reu
            JOIN eventos e ON e.id = reu.evento_id
            WHERE reu.run_id = ?
            ORDER BY reu.used_at, e.source_index
            """,
            (goblin["run_id"],),
        ).fetchall()

    return [_hydrate_event_row(row) for row in rows]


def equip_item(*, item_id: int | None = None, item_code: str | None = None) -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        item = _get_inventory_item(connection, goblin["id"], item_id=item_id, item_code=item_code)
        if item is None:
            raise NotFoundError("El item no existe en el inventario.")
        if item["slot"] is None:
            raise ConflictError("El item no se puede equipar.")

        equipped = connection.execute(
            """
            SELECT item_id
            FROM equipo
            WHERE goblin_id = ? AND slot = ?
            """,
            (goblin["id"], item["slot"]),
        ).fetchone()

        if equipped is not None:
            connection.execute(
                "DELETE FROM equipo WHERE goblin_id = ? AND slot = ?",
                (goblin["id"], item["slot"]),
            )
            _add_inventory_quantity(connection, goblin["id"], equipped["item_id"], 1)

        _remove_inventory_quantity(connection, goblin["id"], item["id"], 1)
        connection.execute(
            """
            INSERT INTO equipo (goblin_id, item_id, slot)
            VALUES (?, ?, ?)
            """,
            (goblin["id"], item["id"], item["slot"]),
        )
        connection.commit()

    return {
        "message": "Item equipado correctamente.",
        "equipo": list_equipment(),
        "inventario": list_inventory(),
        "goblin": get_goblin_snapshot(),
    }


def unequip_item(slot: str) -> dict[str, Any]:
    with get_connection() as connection:
        goblin = _get_active_goblin(connection)
        if goblin is None:
            raise NotFoundError("No hay una run activa. Crea una con POST /run/nueva.")

        equipped = connection.execute(
            """
            SELECT item_id
            FROM equipo
            WHERE goblin_id = ? AND slot = ?
            """,
            (goblin["id"], slot),
        ).fetchone()
        if equipped is None:
            raise NotFoundError(f"No hay ningun item equipado en el slot '{slot}'.")

        connection.execute(
            "DELETE FROM equipo WHERE goblin_id = ? AND slot = ?",
            (goblin["id"], slot),
        )
        _add_inventory_quantity(connection, goblin["id"], equipped["item_id"], 1)
        connection.commit()

    return {
        "message": "Item desequipado correctamente.",
        "equipo": list_equipment(),
        "inventario": list_inventory(),
        "goblin": get_goblin_snapshot(),
    }


def _seed_starter_inventory(connection: sqlite3.Connection, goblin_id: int) -> None:
    for item_code, cantidad in STARTER_LOADOUT:
        item = connection.execute(
            "SELECT id FROM items WHERE codigo = ?",
            (item_code,),
        ).fetchone()
        if item is None:
            raise NotFoundError(f"No existe el item inicial '{item_code}'.")

        connection.execute(
            """
            INSERT INTO inventario (goblin_id, item_id, cantidad)
            VALUES (?, ?, ?)
            """,
            (goblin_id, item["id"], cantidad),
        )


def _get_active_run_row(connection: sqlite3.Connection) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT id, arquetipo_codigo, goblin_nombre, estado, started_at, ended_at
        FROM runs
        WHERE estado = 'active'
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()


def _get_active_goblin(connection: sqlite3.Connection) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT
            g.id,
            g.run_id,
            g.nombre,
            g.arquetipo_codigo,
            g.fuerza_base,
            g.carisma_base,
            g.destreza_base,
            g.vida_actual,
            g.vida_max,
            g.oro,
            g.esta_vivo
        FROM goblin g
        JOIN runs r ON r.id = g.run_id
        WHERE r.estado = 'active'
        ORDER BY g.id DESC
        LIMIT 1
        """
    ).fetchone()


def _get_equipment_bonus(connection: sqlite3.Connection, goblin_id: int) -> dict[str, int]:
    row = connection.execute(
        """
        SELECT
            COALESCE(SUM(i.bonus_fuerza), 0) AS fuerza,
            COALESCE(SUM(i.bonus_carisma), 0) AS carisma,
            COALESCE(SUM(i.bonus_destreza), 0) AS destreza
        FROM equipo e
        JOIN items i ON i.id = e.item_id
        WHERE e.goblin_id = ?
        """,
        (goblin_id,),
    ).fetchone()

    return {
        "fuerza": row["fuerza"],
        "carisma": row["carisma"],
        "destreza": row["destreza"],
    }


def _get_inventory_item(
    connection: sqlite3.Connection,
    goblin_id: int,
    *,
    item_id: int | None,
    item_code: str | None,
) -> sqlite3.Row | None:
    if item_id is not None:
        return connection.execute(
            """
            SELECT i.id, i.codigo, i.nombre, i.slot, inv.cantidad
                 , i.tipo, i.efecto_tipo, i.efecto_valor
            FROM inventario inv
            JOIN items i ON i.id = inv.item_id
            WHERE inv.goblin_id = ? AND i.id = ?
            """,
            (goblin_id, item_id),
        ).fetchone()

    if item_code is not None:
        return connection.execute(
            """
            SELECT i.id, i.codigo, i.nombre, i.slot, inv.cantidad
                 , i.tipo, i.efecto_tipo, i.efecto_valor
            FROM inventario inv
            JOIN items i ON i.id = inv.item_id
            WHERE inv.goblin_id = ? AND i.codigo = ?
            """
            ,
            (goblin_id, item_code),
        ).fetchone()

    raise ConflictError("Debes enviar item_id o item_code.")


def _hydrate_event_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "zona": row["zona_codigo"],
        "nivel": row["nivel"],
        "indice": row["source_index"],
        "nombre": row["nombre"],
        "tipo": row["tipo"],
        "descripcion": row["descripcion"],
        "options": json.loads(row["options_json"]) if row["options_json"] else None,
        "effect": json.loads(row["effect_json"]) if row["effect_json"] else None,
        "success": json.loads(row["success_json"]) if row["success_json"] else None,
        "failure": json.loads(row["failure_json"]) if row["failure_json"] else None,
        "raw": json.loads(row["raw_json"]),
    }


def _add_inventory_quantity(
    connection: sqlite3.Connection,
    goblin_id: int,
    item_id: int,
    cantidad: int,
) -> None:
    current = connection.execute(
        """
        SELECT cantidad
        FROM inventario
        WHERE goblin_id = ? AND item_id = ?
        """,
        (goblin_id, item_id),
    ).fetchone()

    if current is None:
        connection.execute(
            """
            INSERT INTO inventario (goblin_id, item_id, cantidad)
            VALUES (?, ?, ?)
            """,
            (goblin_id, item_id, cantidad),
        )
        return

    connection.execute(
        """
        UPDATE inventario
        SET cantidad = cantidad + ?
        WHERE goblin_id = ? AND item_id = ?
        """,
        (cantidad, goblin_id, item_id),
    )


def _get_item_catalog(
    connection: sqlite3.Connection,
    *,
    item_id: int | None,
    item_code: str | None,
) -> sqlite3.Row | None:
    if item_id is not None:
        return connection.execute(
            """
            SELECT
                id,
                codigo,
                nombre,
                descripcion,
                tipo,
                slot,
                bonus_fuerza,
                bonus_carisma,
                bonus_destreza,
                apilable,
                efecto_tipo,
                efecto_valor
            FROM items
            WHERE id = ?
            """,
            (item_id,),
        ).fetchone()

    if item_code is not None:
        return connection.execute(
            """
            SELECT
                id,
                codigo,
                nombre,
                descripcion,
                tipo,
                slot,
                bonus_fuerza,
                bonus_carisma,
                bonus_destreza,
                apilable,
                efecto_tipo,
                efecto_valor
            FROM items
            WHERE codigo = ?
            """,
            (item_code,),
        ).fetchone()

    raise ConflictError("Debes enviar item_id o item_code.")


def _remove_inventory_quantity(
    connection: sqlite3.Connection,
    goblin_id: int,
    item_id: int,
    cantidad: int,
) -> None:
    current = connection.execute(
        """
        SELECT cantidad
        FROM inventario
        WHERE goblin_id = ? AND item_id = ?
        """,
        (goblin_id, item_id),
    ).fetchone()
    if current is None or current["cantidad"] < cantidad:
        raise ConflictError("No hay cantidad suficiente de ese item en el inventario.")

    remaining = current["cantidad"] - cantidad
    if remaining == 0:
        connection.execute(
            """
            DELETE FROM inventario
            WHERE goblin_id = ? AND item_id = ?
            """,
            (goblin_id, item_id),
        )
        return

    connection.execute(
        """
        UPDATE inventario
        SET cantidad = ?
        WHERE goblin_id = ? AND item_id = ?
        """,
        (remaining, goblin_id, item_id),
    )
