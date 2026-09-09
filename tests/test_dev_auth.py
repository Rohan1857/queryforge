from sqlalchemy import select

from backend.config import settings
from backend.models.user import User


async def test_dev_login_requires_flag(client, monkeypatch):
    monkeypatch.setattr(settings, "DEV_AUTH_BYPASS", False)

    response = await client.post("/api/auth/dev-login")

    assert response.status_code == 403
    assert response.json()["detail"] == "Development auth bypass is disabled"


async def test_dev_login_creates_and_reuses_demo_user(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "DEV_AUTH_BYPASS", True)
    monkeypatch.setattr(settings, "DEV_AUTH_EMAIL", "dev-auth@test.local")
    monkeypatch.setattr(settings, "DEV_AUTH_NAME", "Dev Auth User")

    first_response = await client.post("/api/auth/dev-login")

    assert first_response.status_code == 200
    first_body = first_response.json()
    assert first_body["access_token"]
    assert first_body["user"]["email"] == "dev-auth@test.local"
    assert first_body["user"]["name"] == "Dev Auth User"

    result = await db_session.execute(select(User).where(User.email == "dev-auth@test.local"))
    user = result.scalar_one()

    second_response = await client.post("/api/auth/dev-login")

    assert second_response.status_code == 200
    assert second_response.json()["user"]["id"] == str(user.id)
