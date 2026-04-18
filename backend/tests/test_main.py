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


def test_can_create_run_and_get_goblin(client: TestClient) -> None:
    create_response = client.post(
        "/run/nueva",
        json={"nombre": "Berto", "arquetipo": "romantico"},
    )

    assert create_response.status_code == 200
    body = create_response.json()
    assert body["goblin"]["nombre"] == "Berto"
    assert body["goblin"]["stats_base"] == {
        "fuerza": 2,
        "carisma": 5,
        "destreza": 3,
    }
    assert len(body["inventario"]) == 5
    assert body["equipo"] == []

    goblin_response = client.get("/goblin")
    assert goblin_response.status_code == 200
    assert goblin_response.json()["stats_totales"] == {
        "fuerza": 2,
        "carisma": 5,
        "destreza": 3,
    }


def test_equip_item_updates_stats_and_inventory(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Tacho", "arquetipo": "malo"})

    inventory_response = client.get("/inventario")
    garrote = next(item for item in inventory_response.json() if item["codigo"] == "garrote_astillado")

    equip_response = client.post(
        "/equipo/equipar",
        json={"item_id": garrote["id"]},
    )

    assert equip_response.status_code == 200
    assert any(item["codigo"] == "garrote_astillado" for item in equip_response.json()["equipo"])
    assert all(item["codigo"] != "garrote_astillado" for item in equip_response.json()["inventario"])
    assert equip_response.json()["goblin"]["stats_totales"]["fuerza"] == 6


def test_unequip_returns_item_to_inventory(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Lola", "arquetipo": "rayo_mcqueen"})
    client.post("/equipo/equipar", json={"item_code": "botas_chispeantes"})

    unequip_response = client.post("/equipo/desequipar/botas")

    assert unequip_response.status_code == 200
    assert unequip_response.json()["equipo"] == []
    botas = next(item for item in unequip_response.json()["inventario"] if item["codigo"] == "botas_chispeantes")
    assert botas["cantidad"] == 1
    assert unequip_response.json()["goblin"]["stats_totales"]["destreza"] == 5


def test_reset_run_clears_current_state(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Finito", "arquetipo": "malo"})

    reset_response = client.post("/run/reset")

    assert reset_response.status_code == 200
    goblin_response = client.get("/goblin")
    assert goblin_response.status_code == 404


def test_cannot_equip_without_active_run(client: TestClient) -> None:
    response = client.post("/equipo/equipar", json={"item_code": "garrote_astillado"})

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


def test_use_consumable_heals_and_spends_item(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Curita", "arquetipo": "romantico"})
    client.post("/goblin/recibir-dano", json={"cantidad": 4})

    response = client.post("/inventario/usar", json={"item_code": "venda_sucia"})

    assert response.status_code == 200
    assert response.json()["curacion_aplicada"] == 3
    assert response.json()["goblin"]["vida_actual"] == 9
    venda = next(item for item in response.json()["inventario"] if item["codigo"] == "venda_sucia")
    assert venda["cantidad"] == 2


def test_damage_can_defeat_active_run(client: TestClient) -> None:
    client.post("/run/nueva", json={"nombre": "Golpeado", "arquetipo": "malo"})

    response = client.post("/goblin/recibir-dano", json={"cantidad": 10})

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
