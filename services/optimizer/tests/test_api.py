from fastapi.testclient import TestClient

from supplypilot_optimizer.api import app


def test_health_reports_synthetic_dataset() -> None:
    r = TestClient(app).get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["synthetic"] is True
    assert body["counts"]["suppliers"] == 5
