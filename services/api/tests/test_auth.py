from __future__ import annotations


async def register_user(client, email: str = "user@example.com", username: str = "user_one"):
    return await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "Password123!",
            "name": "Test User",
        },
        headers={"origin": "http://localhost:3000"},
    )


async def test_register_login_me_logout_refresh(client):
    register_response = await register_user(client)
    assert register_response.status_code == 200
    assert register_response.json()["user"]["email"] == "user@example.com"
    assert "probabylon_refresh" in register_response.headers.get("set-cookie", "")

    me_response = await client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["user"]["username"] == "user_one"

    logout_response = await client.post("/api/auth/logout", headers={"origin": "http://localhost:3000"})
    assert logout_response.status_code == 200

    me_after_logout = await client.get("/api/auth/me")
    assert me_after_logout.status_code == 401

    login_response = await client.post(
        "/api/auth/login",
        json={"identifier": "user@example.com", "password": "Password123!"},
        headers={"origin": "http://localhost:3000"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["role"] == "user"

    refresh_response = await client.post("/api/auth/refresh", headers={"origin": "http://localhost:3000"})
    assert refresh_response.status_code == 200
    assert refresh_response.json()["user"]["email"] == "user@example.com"


async def test_duplicate_registration_rejected(client):
    first = await register_user(client, email="dup@example.com", username="dup_user")
    assert first.status_code == 200
    second = await register_user(client, email="dup@example.com", username="dup_user_two")
    assert second.status_code == 409


async def test_invalid_login_rejected(client):
    await register_user(client, email="badlogin@example.com", username="bad_login")
    response = await client.post(
        "/api/auth/login",
        json={"identifier": "badlogin@example.com", "password": "WrongPassword123!"},
        headers={"origin": "http://localhost:3000"},
    )
    assert response.status_code == 401


async def test_admin_seed_and_login(client):
    response = await client.post(
        "/api/auth/login",
        json={"identifier": "admin@probabylon.ai", "password": "Admin123!Secure"},
        headers={"origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"

    alias_response = await client.post(
        "/api/auth/login",
        json={"identifier": "admin", "password": "admin"},
        headers={"origin": "http://localhost:3000"},
    )
    assert alias_response.status_code == 200
    assert alias_response.json()["user"]["email"] == "admin@gmail.com"
