"""
End-to-end Playwright tests for the Prompt BI system.

Tests the full HTTP stack: auth, dashboards, widgets, connections,
uploads, queries, sharing, and error handling.
"""

from __future__ import annotations

import json
import os
import tempfile

import pytest
from playwright.sync_api import APIRequestContext, Playwright

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture(scope="session")
def api_context(playwright: Playwright) -> APIRequestContext:
    """Create a raw API request context (no browser needed)."""
    ctx = playwright.request.new_context(base_url=BASE_URL)
    yield ctx
    ctx.dispose()


@pytest.fixture(scope="session")
def test_user(api_context: APIRequestContext) -> dict:
    """Register a fresh test user and return {email, password, token, user}."""
    import uuid

    email = f"e2e_{uuid.uuid4().hex[:8]}@test.com"
    password = "E2eTestPass123!"

    resp = api_context.post("/api/auth/register", data={
        "email": email,
        "name": "E2E Test User",
        "password": password,
    })
    assert resp.status == 201, f"Register failed: {resp.status} {resp.text()}"
    body = resp.json()
    return {
        "email": email,
        "password": password,
        "token": body["access_token"],
        "user": body["user"],
    }


@pytest.fixture(scope="session")
def auth_headers(test_user: dict) -> dict:
    return {"Authorization": f"Bearer {test_user['token']}"}


@pytest.fixture(scope="session")
def csv_file() -> str:
    """Create a temporary CSV file for upload tests."""
    content = (
        "product,category,price,quantity,date\n"
        "Widget A,Electronics,29.99,150,2024-01-15\n"
        "Widget B,Electronics,49.99,80,2024-02-20\n"
        "Gadget C,Home,15.50,300,2024-01-10\n"
        "Gadget D,Home,22.00,200,2024-03-05\n"
        "Tool E,Industrial,99.00,50,2024-02-28\n"
        "Tool F,Industrial,75.00,120,2024-03-15\n"
    )
    fd, path = tempfile.mkstemp(suffix=".csv", prefix="e2e_test_")
    with os.fdopen(fd, "w") as f:
        f.write(content)
    yield path
    os.unlink(path)


# ── Shared state across test classes ──────────────────────────

class _SharedState:
    """Holds IDs created during the test run so later tests can reference them."""
    dashboard_id: str | None = None
    dup_dashboard_id: str | None = None
    connection_id: str | None = None
    table_name: str | None = None  # Actual DuckDB table name from schema
    widget_id: str | None = None


# ── 1. Health Check ───────────────────────────────────────────

class TestHealthCheck:
    def test_health_endpoint(self, api_context: APIRequestContext):
        resp = api_context.get("/api/health")
        assert resp.status == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["db"] is True

    def test_nonexistent_endpoint(self, api_context: APIRequestContext):
        resp = api_context.get("/api/nonexistent")
        assert resp.status in (404, 405)


# ── 2. Authentication ─────────────────────────────────────────

class TestAuth:
    def test_register_success(self, test_user: dict):
        assert "token" in test_user
        assert test_user["user"]["email"] == test_user["email"]

    def test_register_duplicate(self, api_context: APIRequestContext, test_user: dict):
        resp = api_context.post("/api/auth/register", data={
            "email": test_user["email"],
            "name": "Duplicate",
            "password": "SomePass123!",
        })
        assert resp.status == 409

    def test_login_success(self, api_context: APIRequestContext, test_user: dict):
        resp = api_context.post("/api/auth/login", data={
            "email": test_user["email"],
            "password": test_user["password"],
        })
        assert resp.status == 200
        body = resp.json()
        assert "access_token" in body

    def test_login_wrong_password(self, api_context: APIRequestContext, test_user: dict):
        resp = api_context.post("/api/auth/login", data={
            "email": test_user["email"],
            "password": "WrongPassword123!",
        })
        assert resp.status == 401

    def test_login_nonexistent_user(self, api_context: APIRequestContext):
        resp = api_context.post("/api/auth/login", data={
            "email": "nobody@nowhere.com",
            "password": "Whatever123!",
        })
        assert resp.status == 401

    def test_me_authenticated(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get("/api/auth/me", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert "email" in body

    def test_me_no_token(self, api_context: APIRequestContext):
        resp = api_context.get("/api/auth/me")
        assert resp.status in (401, 403)

    def test_me_invalid_token(self, api_context: APIRequestContext):
        resp = api_context.get("/api/auth/me", headers={
            "Authorization": "Bearer invalid.jwt.token",
        })
        assert resp.status in (401, 403)

    def test_update_profile(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.put("/api/auth/me", headers=auth_headers, data={
            "name": "Updated E2E User",
        })
        assert resp.status == 200
        assert resp.json()["name"] == "Updated E2E User"


# ── 3. Dashboard CRUD ─────────────────────────────────────────

class TestDashboards:
    def test_create_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post("/api/dashboards", headers=auth_headers, data={
            "title": "E2E Test Dashboard",
            "description": "Created by Playwright e2e tests",
        })
        assert resp.status == 201
        body = resp.json()
        assert body["title"] == "E2E Test Dashboard"
        assert "id" in body
        _SharedState.dashboard_id = body["id"]

    def test_list_dashboards(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get("/api/dashboards", headers=auth_headers)
        assert resp.status == 200
        dashboards = resp.json()
        assert isinstance(dashboards, list)
        assert len(dashboards) >= 1

    def test_get_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get(
            f"/api/dashboards/{_SharedState.dashboard_id}", headers=auth_headers
        )
        assert resp.status == 200
        body = resp.json()
        assert body["title"] == "E2E Test Dashboard"
        assert "widgets" in body

    def test_update_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.put(
            f"/api/dashboards/{_SharedState.dashboard_id}",
            headers=auth_headers,
            data={"title": "E2E Updated Dashboard", "description": "Updated desc"},
        )
        assert resp.status == 200
        assert resp.json()["title"] == "E2E Updated Dashboard"

    def test_get_dashboard_invalid_id(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get("/api/dashboards/not-a-uuid", headers=auth_headers)
        assert resp.status == 400

    def test_get_dashboard_nonexistent(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get(
            "/api/dashboards/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status in (403, 404)

    def test_duplicate_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post(
            f"/api/dashboards/{_SharedState.dashboard_id}/duplicate",
            headers=auth_headers,
        )
        assert resp.status == 200
        body = resp.json()
        assert "Copy" in body["title"]
        _SharedState.dup_dashboard_id = body["id"]

    def test_share_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post(
            f"/api/dashboards/{_SharedState.dashboard_id}/share",
            headers=auth_headers,
        )
        assert resp.status == 200
        body = resp.json()
        assert body["is_public"] is True
        assert body["share_url"] is not None

    def test_public_dashboard_access(self, api_context: APIRequestContext):
        resp = api_context.get(
            f"/api/public/dashboard/{_SharedState.dashboard_id}"
        )
        assert resp.status == 200
        body = resp.json()
        assert body["is_public"] is True

    def test_unshare_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post(
            f"/api/dashboards/{_SharedState.dashboard_id}/share",
            headers=auth_headers,
        )
        assert resp.status == 200
        assert resp.json()["is_public"] is False

    def test_public_dashboard_denied_after_unshare(self, api_context: APIRequestContext):
        resp = api_context.get(
            f"/api/public/dashboard/{_SharedState.dashboard_id}"
        )
        assert resp.status == 404

    def test_delete_duplicate(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.delete(
            f"/api/dashboards/{_SharedState.dup_dashboard_id}",
            headers=auth_headers,
        )
        assert resp.status == 200
        assert resp.json()["deleted"] is True

    def test_dashboard_no_auth(self, api_context: APIRequestContext):
        resp = api_context.get("/api/dashboards")
        assert resp.status in (401, 403)


# ── 4. File Upload & Connection ────────────────────────────────

class TestUploadsAndConnections:
    def test_upload_csv(self, api_context: APIRequestContext, auth_headers: dict, csv_file: str):
        with open(csv_file, "rb") as f:
            resp = api_context.post(
                "/api/upload",
                headers=auth_headers,
                multipart={
                    "file": {
                        "name": "e2e_products.csv",
                        "mimeType": "text/csv",
                        "buffer": f.read(),
                    }
                },
            )
        assert resp.status == 201, f"Upload failed: {resp.status} {resp.text()}"
        body = resp.json()
        assert "id" in body
        _SharedState.connection_id = body["id"]

    def test_list_connections(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get("/api/connections", headers=auth_headers)
        assert resp.status == 200
        conns = resp.json()
        assert isinstance(conns, list)
        assert len(conns) >= 1

    def test_get_connection(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        assert cid is not None, "Upload test must run first"
        resp = api_context.get(f"/api/connections/{cid}", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert body["type"] == "csv"

    def test_connection_schema(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        resp = api_context.get(f"/api/connections/{cid}/schema", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        # Extract the actual table name from schema for use in later tests
        if isinstance(body, dict) and "tables" in body:
            tables = body["tables"]
            if tables:
                _SharedState.table_name = tables[0]["name"]
        elif isinstance(body, list) and body:
            _SharedState.table_name = body[0].get("name", "data")
        assert _SharedState.table_name is not None, f"Could not extract table name from schema: {body}"

    def test_connection_preview(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        table = _SharedState.table_name
        assert table, "Schema test must run first to discover table name"
        resp = api_context.get(f"/api/connections/{cid}/preview/{table}", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert "rows" in body
        assert len(body["rows"]) > 0

    def test_connection_test(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        resp = api_context.post(f"/api/connections/{cid}/test", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert body.get("success") is True or body.get("ok") is True or "status" in body


# ── 5. SQL Query Execution ─────────────────────────────────────

class TestQueries:
    def test_execute_query(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        table = _SharedState.table_name
        assert cid and table
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": cid,
            "sql": f'SELECT category, COUNT(*) as cnt, SUM(price * quantity) as revenue FROM "{table}" GROUP BY category ORDER BY revenue DESC',
        })
        assert resp.status == 200, f"Query failed: {resp.status} {resp.text()}"
        body = resp.json()
        assert "rows" in body
        assert len(body["rows"]) == 3  # Electronics, Home, Industrial

    def test_execute_query_select_star(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        table = _SharedState.table_name
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": cid,
            "sql": f'SELECT * FROM "{table}" LIMIT 3',
        })
        assert resp.status == 200
        body = resp.json()
        assert body["row_count"] == 3

    def test_query_invalid_sql(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": cid,
            "sql": "THIS IS NOT SQL",
        })
        assert resp.status in (400, 422, 500)

    def test_query_dangerous_sql_blocked(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": cid,
            "sql": "DROP TABLE data",
        })
        assert resp.status in (400, 403, 422)

    def test_query_injection_blocked(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": cid,
            "sql": "SELECT * FROM data; DROP TABLE data;--",
        })
        assert resp.status in (400, 403, 422)

    def test_query_history(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.get("/api/query/history", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1  # At least the successful query above


# ── 6. Widget CRUD ─────────────────────────────────────────────

class TestWidgets:
    def test_create_widget(self, api_context: APIRequestContext, auth_headers: dict):
        dashboard_id = _SharedState.dashboard_id
        cid = _SharedState.connection_id
        table = _SharedState.table_name
        assert dashboard_id and cid and table

        resp = api_context.post("/api/widgets", headers=auth_headers, data={
            "dashboard_id": dashboard_id,
            "connection_id": cid,
            "type": "bar",
            "title": "E2E Revenue by Category",
            "prompt_used": "Show revenue by category",
            "query_config": {
                "sql": f'SELECT category, SUM(price * quantity) as revenue FROM "{table}" GROUP BY category',
            },
            "chart_config": {
                "xField": "category",
                "yField": "revenue",
                "color": "#4F46E5",
            },
            "layout_position": {"x": 0, "y": 0, "w": 6, "h": 4},
        })
        assert resp.status == 201, f"Widget create failed: {resp.status} {resp.text()}"
        body = resp.json()
        assert body["title"] == "E2E Revenue by Category"
        _SharedState.widget_id = body["id"]

    def test_get_widget(self, api_context: APIRequestContext, auth_headers: dict):
        wid = _SharedState.widget_id
        assert wid
        resp = api_context.get(f"/api/widgets/{wid}", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert body["type"] == "bar"

    def test_update_widget(self, api_context: APIRequestContext, auth_headers: dict):
        wid = _SharedState.widget_id
        resp = api_context.put(f"/api/widgets/{wid}", headers=auth_headers, data={
            "title": "E2E Updated Widget",
        })
        assert resp.status == 200
        assert resp.json()["title"] == "E2E Updated Widget"

    def test_refresh_widget(self, api_context: APIRequestContext, auth_headers: dict):
        wid = _SharedState.widget_id
        resp = api_context.post(f"/api/widgets/{wid}/refresh", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        # Should contain data from SQL execution
        assert "data" in body or "cached_data" in body or "rows" in body

    def test_update_widget_position(self, api_context: APIRequestContext, auth_headers: dict):
        wid = _SharedState.widget_id
        resp = api_context.put(f"/api/widgets/{wid}/position", headers=auth_headers, data={
            "x": 6, "y": 0, "w": 6, "h": 4,
        })
        assert resp.status == 200

    def test_dashboard_includes_widget(self, api_context: APIRequestContext, auth_headers: dict):
        dashboard_id = _SharedState.dashboard_id
        resp = api_context.get(f"/api/dashboards/{dashboard_id}", headers=auth_headers)
        assert resp.status == 200
        body = resp.json()
        assert len(body["widgets"]) >= 1
        widget_ids = [w["id"] for w in body["widgets"]]
        assert _SharedState.widget_id in widget_ids

    def test_layout_batch_update(self, api_context: APIRequestContext, auth_headers: dict):
        dashboard_id = _SharedState.dashboard_id
        wid = _SharedState.widget_id
        resp = api_context.put(
            f"/api/dashboards/{dashboard_id}/layout",
            headers={**auth_headers, "Content-Type": "application/json"},
            data=json.dumps({"widgets": [{"id": wid, "x": 0, "y": 0, "w": 12, "h": 6}]}),
        )
        assert resp.status == 200
        assert resp.json()["updated"] is True


# ── 7. Cross-User Isolation ───────────────────────────────────

class TestIsolation:
    def test_other_user_cannot_access_dashboard(self, api_context: APIRequestContext):
        import uuid

        email2 = f"e2e_other_{uuid.uuid4().hex[:8]}@test.com"
        resp = api_context.post("/api/auth/register", data={
            "email": email2,
            "name": "Other User",
            "password": "OtherPass123!",
        })
        assert resp.status == 201
        token2 = resp.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        dashboard_id = _SharedState.dashboard_id
        resp = api_context.get(f"/api/dashboards/{dashboard_id}", headers=headers2)
        assert resp.status == 403

    def test_other_user_sees_empty_dashboards(self, api_context: APIRequestContext):
        import uuid

        email3 = f"e2e_empty_{uuid.uuid4().hex[:8]}@test.com"
        resp = api_context.post("/api/auth/register", data={
            "email": email3,
            "name": "Empty User",
            "password": "EmptyPass123!",
        })
        token3 = resp.json()["access_token"]
        resp = api_context.get("/api/dashboards", headers={
            "Authorization": f"Bearer {token3}",
        })
        assert resp.status == 200
        assert resp.json() == []


# ── 8. Error Handling Edge Cases ──────────────────────────────

class TestEdgeCases:
    def test_empty_dashboard_title(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post("/api/dashboards", headers=auth_headers, data={
            "title": "",
        })
        assert resp.status in (201, 400, 422)

    def test_very_long_title(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post("/api/dashboards", headers=auth_headers, data={
            "title": "A" * 1000,
        })
        assert resp.status in (201, 400, 422)
        if resp.status == 201:
            did = resp.json()["id"]
            api_context.delete(f"/api/dashboards/{did}", headers=auth_headers)

    def test_widget_with_bad_connection(self, api_context: APIRequestContext, auth_headers: dict):
        dashboard_id = _SharedState.dashboard_id
        resp = api_context.post("/api/widgets", headers=auth_headers, data={
            "dashboard_id": dashboard_id,
            "connection_id": "00000000-0000-0000-0000-000000000000",
            "type": "table",
            "title": "Bad Connection Widget",
            "query_config": {"sql": "SELECT 1"},
        })
        assert resp.status in (400, 404, 422, 500)

    def test_malformed_json_body(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post(
            "/api/dashboards",
            headers={**auth_headers, "Content-Type": "application/json"},
            data="not-json",
        )
        assert resp.status in (400, 422)

    def test_query_on_invalid_connection(self, api_context: APIRequestContext, auth_headers: dict):
        resp = api_context.post("/api/query/execute", headers=auth_headers, data={
            "connection_id": "00000000-0000-0000-0000-000000000000",
            "sql": "SELECT 1",
        })
        assert resp.status in (400, 404, 500)


# ── 9. Cleanup ─────────────────────────────────────────────────

class TestCleanup:
    """Run last to clean up test data."""

    def test_delete_widget(self, api_context: APIRequestContext, auth_headers: dict):
        wid = _SharedState.widget_id
        if wid:
            resp = api_context.delete(f"/api/widgets/{wid}", headers=auth_headers)
            assert resp.status == 200

    def test_delete_connection(self, api_context: APIRequestContext, auth_headers: dict):
        cid = _SharedState.connection_id
        if cid:
            resp = api_context.delete(f"/api/connections/{cid}", headers=auth_headers)
            assert resp.status == 200

    def test_delete_dashboard(self, api_context: APIRequestContext, auth_headers: dict):
        did = _SharedState.dashboard_id
        if did:
            resp = api_context.delete(f"/api/dashboards/{did}", headers=auth_headers)
            assert resp.status == 200
