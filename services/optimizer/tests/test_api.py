from fastapi.testclient import TestClient

from supplypilot_optimizer.api import app


def test_health_reports_synthetic_dataset() -> None:
    r = TestClient(app).get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["synthetic"] is True
    assert body["counts"]["suppliers"] == 5


# ------------------------------------------------------------------------- hardening


def _body() -> dict[str, object]:
    return {
        "buyer_id": "org_thirdshift",
        "zone": "ORL-UCF",
        "delivery_date": "2026-11-11",
        "lines": [{"product_id": "prd_milk_whole", "quantity": "16", "unit": "gal"}],
    }


def test_api_key_is_required_when_configured(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    client = TestClient(app)
    monkeypatch.setenv("OPTIMIZER_API_KEY", "s3cret-test-key")
    assert client.post("/v1/optimize", json=_body()).status_code == 401
    assert client.post("/v1/optimize", json=_body(), headers={"X-API-Key": "nope"}).status_code == 401
    assert client.post("/v1/optimize", json=_body(), headers={"X-API-Key": "s3cret-test-key"}).status_code == 200
    assert client.get("/v1/health").status_code == 200  # health stays open for uptime checks
    monkeypatch.delenv("OPTIMIZER_API_KEY")
    assert client.post("/v1/optimize", json=_body()).status_code == 200


def test_oversized_bodies_are_rejected() -> None:
    client = TestClient(app)
    huge = _body() | {"padding": "x" * 300_000}
    assert client.post("/v1/optimize", json=huge).status_code == 413
