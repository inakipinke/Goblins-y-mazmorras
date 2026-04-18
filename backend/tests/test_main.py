import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("APP_DB_PATH", str(tmp_path / "test.db"))

    with TestClient(app) as test_client:
        yield test_client


def test_root(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_healthcheck(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["active_run"] is False


def test_lists_seeded_archetypes(client: TestClient) -> None:
    response = client.get("/arquetipos")

    assert response.status_code == 200
    archetypes = response.json()
    assert [archetype["codigo"] for archetype in archetypes] == [
        "malo",
        "rayo_mcqueen",
        "romantico",
    ]


def test_lists_zones_and_event_types(client: TestClient) -> None:
    zones_response = client.get("/zonas")
    assert zones_response.status_code == 200
    assert [zone["codigo"] for zone in zones_response.json()] == [
        "inicial",
        "ciudad",
        "castillo",
    ]

    event_types_response = client.get("/eventos/tipos")
    assert event_types_response.status_code == 200
    event_types = [event_type["tipo"] for event_type in event_types_response.json()]
    assert "Combate" in event_types
    assert "Santuario" in event_types


def test_lists_items_seeded_from_items_json(client: TestClient) -> None:
    response = client.get("/items")

    assert response.status_code == 200
    items = response.json()
    espada = next(item for item in items if item["codigo"] == "espada_oxidada")
    assert espada["tipo"] == "arma"
    assert espada["nivel"] == 1
    assert espada["bonus_fuerza"] == 9
    assert espada["bonus_vida"] == 0


def test_can_create_run_and_get_goblin(client: TestClient) -> None:
    create_response = client.post(
        "/run/nueva",
        json={"nombre": "Berto", "arquetipo": "romantico"},
    )

    assert create_response.status_code == 200
    body = create_response.json()
    assert body["goblin"]["nombre"] == "Berto"
    assert body["goblin"]["stats_base"] == {
        "vida": 100,
        "fuerza": 8,
        "carisma": 15,
        "destreza": 12,
    }
    assert body["goblin"]["vida_actual"] == 100
    assert body["goblin"]["vida_max"] == 100
    assert len(body["inventario"]) == 1
    assert body["inventario"][0]["codigo"] == "venda_sucia"
    assert body["equipo"] == []

    goblin_response = client.get("/goblin")
    assert goblin_response.status_code == 200
    assert goblin_response.json()["stats_totales"] == {
        "vida": 100,
        "fuerza": 8,
        "carisma": 15,
        "destreza": 12,
    }


def test_equip_item_updates_stats_and_inventory(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Tacho", "arquetipo": "malo"})
    client.post("/inventario/loot", json={"item_code": "espada_oxidada", "cantidad": 1})

    inventory_response = client.get("/inventario")
    espada = next(item for item in inventory_response.json() if item["codigo"] == "espada_oxidada")

    equip_response = client.post(
        "/equipo/equipar",
        json={"item_id": espada["id"]},
    )

    assert equip_response.status_code == 200
    assert any(item["codigo"] == "espada_oxidada" for item in equip_response.json()["equipo"])
    assert all(item["codigo"] != "espada_oxidada" for item in equip_response.json()["inventario"])
    assert equip_response.json()["goblin"]["stats_totales"]["fuerza"] == 24


def test_unequip_returns_item_to_inventory(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Lola", "arquetipo": "rayo_mcqueen"})
    client.post("/inventario/loot", json={"item_code": "botas_de_cuero", "cantidad": 1})
    client.post("/equipo/equipar", json={"item_code": "botas_de_cuero"})

    unequip_response = client.post("/equipo/desequipar/botas")

    assert unequip_response.status_code == 200
    assert unequip_response.json()["equipo"] == []
    botas = next(item for item in unequip_response.json()["inventario"] if item["codigo"] == "botas_de_cuero")
    assert botas["cantidad"] == 1
    assert unequip_response.json()["goblin"]["stats_totales"]["destreza"] == 15


def test_reset_run_clears_current_state(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Finito", "arquetipo": "malo"})

    reset_response = client.post("/run/reset")

    assert reset_response.status_code == 200
    goblin_response = client.get("/goblin")
    assert goblin_response.status_code == 404


def test_cannot_equip_without_active_run(client: TestClient) -> None:
    response = client.post("/equipo/equipar", json={"item_code": "espada_oxidada"})

    assert response.status_code == 404


def test_loot_adds_items_to_inventory(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Looty", "arquetipo": "malo"})

    response = client.post(
        "/inventario/loot",
        json={"item_code": "venda_sucia", "cantidad": 2},
    )

    assert response.status_code == 200
    venda = next(item for item in response.json()["inventario"] if item["codigo"] == "venda_sucia")
    assert venda["cantidad"] == 5


def test_random_loot_uses_requested_level(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "LootNivel", "arquetipo": "malo"})

    response = client.post(
        "/inventario/loot",
        json={"nivel": 2, "cantidad": 1},
    )

    assert response.status_code == 200
    assert response.json()["item"]["nivel"] == 2
    assert response.json()["item"]["slot"] is not None


def test_random_loot_uses_zone_level(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "LootZona", "arquetipo": "malo"})

    response = client.post(
        "/inventario/loot",
        json={"zona": "castillo", "cantidad": 1},
    )

    assert response.status_code == 200
    assert response.json()["item"]["nivel"] == 3


def test_use_consumable_heals_and_spends_item(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Curita", "arquetipo": "romantico"})
    client.post("/goblin/recibir-dano", json={"cantidad": 4})

    response = client.post("/inventario/usar", json={"item_code": "venda_sucia"})

    assert response.status_code == 200
    assert response.json()["curacion_aplicada"] == 3
    assert response.json()["goblin"]["vida_actual"] == 99
    venda = next(item for item in response.json()["inventario"] if item["codigo"] == "venda_sucia")
    assert venda["cantidad"] == 2


def test_assign_stat_points_updates_base_and_total_stats(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Subidor", "arquetipo": "malo"})

    response = client.post(
        "/goblin/stats/asignar",
        json={"stat": "fuerza", "cantidad": 3},
    )

    assert response.status_code == 200
    goblin = response.json()["goblin"]
    assert goblin["stats_base"]["fuerza"] == 18
    assert goblin["stats_totales"]["fuerza"] == 18


def test_assign_life_points_increases_base_max_life_and_current_life(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Tanque", "arquetipo": "romantico"})
    client.post("/goblin/recibir-dano", json={"cantidad": 10})

    response = client.post(
        "/goblin/stats/asignar",
        json={"stat": "vida", "cantidad": 7},
    )

    assert response.status_code == 200
    goblin = response.json()["goblin"]
    assert goblin["vida_actual"] == 97
    assert goblin["vida_max"] == 107
    assert goblin["vida_max_total"] == 107
    assert goblin["stats_base"]["vida"] == 107
    assert goblin["stats_totales"]["vida"] == 107


def test_assign_stat_requires_active_run(client: TestClient) -> None:
    response = client.post(
        "/goblin/stats/asignar",
        json={"stat": "carisma", "cantidad": 2},
    )

    assert response.status_code == 404


def test_damage_can_defeat_active_run(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Golpeado", "arquetipo": "malo"})

    response = client.post("/goblin/recibir-dano", json={"cantidad": 100})

    assert response.status_code == 200
    assert response.json()["esta_vivo"] is False
    assert response.json()["run_estado"] == "defeated"
    assert client.get("/goblin").status_code == 404


def test_manual_defeat_marks_run_as_defeated(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Final", "arquetipo": "rayo_mcqueen"})

    response = client.post("/run/derrota")

    assert response.status_code == 200
    assert response.json()["estado"] == "defeated"
    assert client.get("/run/actual").status_code == 404


def test_consume_event_marks_it_used_for_run(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Eventero", "arquetipo": "malo"})

    first = client.post(
        "/eventos/consumir",
        json={"zona": "inicial", "tipo": "Santuario"},
    )
    second = client.post(
        "/eventos/consumir",
        json={"zona": "inicial", "tipo": "Santuario"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["evento"]["id"] != second.json()["evento"]["id"]

    used = client.get("/eventos/usados")
    assert used.status_code == 200
    assert len(used.json()) == 2


def test_consume_event_fails_when_zone_type_is_exhausted(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Agota", "arquetipo": "romantico"})

    last_status = None
    for _ in range(20):
        response = client.post(
            "/eventos/consumir",
            json={"zona": "castillo", "tipo": "Santuario"},
        )
        last_status = response.status_code
        if response.status_code == 409:
            break

        assert response.status_code == 200

    assert last_status == 409


def test_new_run_starts_with_clean_events_after_reset(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Primero", "arquetipo": "romantico"})
    first_event = client.post(
        "/eventos/consumir",
        json={"zona": "inicial", "tipo": "Santuario"},
    ).json()["evento"]["id"]

    reset_response = client.post("/run/reset")
    assert reset_response.status_code == 200

    second_run = client.post("/run/nueva", json={"nombre": "Segundo", "arquetipo": "romantico"})
    assert second_run.status_code == 200

    second_event = client.post(
        "/eventos/consumir",
        json={"zona": "inicial", "tipo": "Santuario"},
    ).json()["evento"]["id"]

    assert second_event == first_event
