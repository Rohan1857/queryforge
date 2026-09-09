from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.connection import DataConnection
from backend.services.connectors.base import QueryResult


def _chart_config(**overrides):
    config = {
        "x_field": "month",
        "y_fields": ["revenue"],
        "aggregation": "sum",
        "colors": ["#2563eb"],
        "stacked": False,
        "show_values": True,
        "orientation": "vertical",
        "metric_name": "revenue",
        "x_axis_label": "Month",
        "y_axis_label": "Revenue",
        "card_description": "Monthly revenue trend",
        "metric_config": {
            "field": "revenue",
            "aggregation": "sum",
            "visible_metrics": ["sum", "average"],
        },
        "style_config": {
            "background_type": "solid",
            "background_color": "#ffffff",
        },
    }
    config.update(overrides)
    return config


async def _create_dashboard(client: AsyncClient) -> str:
    response = await client.post(
        "/api/dashboards",
        json={"title": "Feature Audit Dashboard"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_widget(
    client: AsyncClient,
    dashboard_id: str,
    *,
    title: str,
    layout_position: dict,
    chart_config: dict | None = None,
    connection_id: str | None = None,
    query_config: dict | None = None,
):
    response = await client.post(
        "/api/widgets",
        json={
            "dashboard_id": dashboard_id,
            "type": "bar",
            "title": title,
            "connection_id": connection_id,
            "query_config": query_config or {"sql": "SELECT 1", "params": []},
            "chart_config": chart_config or _chart_config(),
            "layout_position": layout_position,
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_widget_creation_and_duplication_assign_positions(client: AsyncClient):
    dashboard_id = await _create_dashboard(client)

    first = await _create_widget(
        client,
        dashboard_id,
        title="Revenue",
        layout_position={"x": 0, "y": 0, "w": 6, "h": 4},
    )
    second = await _create_widget(
        client,
        dashboard_id,
        title="Profit",
        layout_position={"x": 6, "y": 0, "w": 6, "h": 4},
    )

    duplicate_response = await client.post(f"/api/widgets/{first['id']}/duplicate")
    assert duplicate_response.status_code == 201
    duplicate = duplicate_response.json()

    assert first["layout_position"]["position"] == 0
    assert second["layout_position"]["position"] == 1
    assert duplicate["layout_position"]["position"] == 2


@pytest.mark.asyncio
async def test_dashboard_layout_updates_persist_widget_order(client: AsyncClient):
    dashboard_id = await _create_dashboard(client)

    first = await _create_widget(
        client,
        dashboard_id,
        title="Revenue",
        layout_position={"x": 0, "y": 0, "w": 6, "h": 4},
    )
    second = await _create_widget(
        client,
        dashboard_id,
        title="Profit",
        layout_position={"x": 6, "y": 0, "w": 6, "h": 4},
    )

    response = await client.put(
        f"/api/dashboards/{dashboard_id}/layout",
        json={
            "widgets": [
                {"id": second["id"], "x": 0, "y": 0, "w": 6, "h": 4, "position": 0},
                {"id": first["id"], "x": 6, "y": 0, "w": 6, "h": 4, "position": 1},
            ]
        },
    )
    assert response.status_code == 200

    dashboard_response = await client.get(f"/api/dashboards/{dashboard_id}")
    assert dashboard_response.status_code == 200
    dashboard = dashboard_response.json()

    assert [widget["id"] for widget in dashboard["widgets"]] == [second["id"], first["id"]]
    assert [widget["layout_position"]["position"] for widget in dashboard["widgets"]] == [0, 1]


@pytest.mark.asyncio
async def test_widget_update_merges_layout_and_chart_extensions(client: AsyncClient):
    dashboard_id = await _create_dashboard(client)
    widget = await _create_widget(
        client,
        dashboard_id,
        title="Revenue",
        layout_position={"x": 0, "y": 0, "w": 6, "h": 4},
    )

    response = await client.put(
        f"/api/widgets/{widget['id']}",
        json={
            "type": "radar",
            "layout_position": {"x": 3},
            "chart_config": _chart_config(
                x_axis_label="Month label",
                y_axis_label="Revenue label",
                card_description="Updated from the editor panel",
                style_config={
                    "background_type": "gradient",
                    "gradient_from": "#0f172a",
                    "gradient_to": "#1d4ed8",
                },
            ),
        },
    )
    assert response.status_code == 200

    updated = response.json()
    assert updated["type"] == "radar"
    assert updated["layout_position"]["x"] == 3
    assert updated["layout_position"]["y"] == 0
    assert updated["layout_position"]["position"] == 0
    assert updated["chart_config"]["x_axis_label"] == "Month label"
    assert updated["chart_config"]["y_axis_label"] == "Revenue label"
    assert updated["chart_config"]["card_description"] == "Updated from the editor panel"
    assert updated["chart_config"]["style_config"]["background_type"] == "gradient"


@pytest.mark.asyncio
async def test_widget_query_config_update_refreshes_cached_rows(
    client: AsyncClient,
    db_session: AsyncSession,
    test_user,
    monkeypatch: pytest.MonkeyPatch,
):
    dashboard_id = await _create_dashboard(client)
    connection = DataConnection(
        user_id=test_user.id,
        name="Warehouse",
        type="sqlite",
        config={"database": ":memory:"},
    )
    db_session.add(connection)
    await db_session.flush()

    widget = await _create_widget(
        client,
        dashboard_id,
        title="Revenue",
        connection_id=str(connection.id),
        query_config={"sql": "SELECT 1 AS value", "params": []},
        layout_position={"x": 0, "y": 0, "w": 6, "h": 4},
    )

    class FakeConnector:
        def __init__(self) -> None:
            self.calls: list[tuple[str, list | None]] = []
            self.disconnected = False

        async def execute_query(self, sql: str, params: list | None = None) -> QueryResult:
            self.calls.append((sql, params))
            return QueryResult(
                columns=["value"],
                rows=[{"value": 99}],
                row_count=1,
                execution_ms=12,
            )

        async def disconnect(self) -> None:
            self.disconnected = True

    fake_connector = FakeConnector()
    monkeypatch.setattr(
        "backend.services.widget_service.ConnectorFactory.create",
        lambda *_args, **_kwargs: fake_connector,
    )

    response = await client.put(
        f"/api/widgets/{widget['id']}",
        json={
            "query_config": {
                "sql": "SELECT ? AS value",
                "params": [99],
            }
        },
    )
    assert response.status_code == 200

    updated = response.json()
    assert updated["connection_id"] == str(connection.id)
    assert updated["query_config"] == {"sql": "SELECT ? AS value", "params": [99]}
    assert updated["data"] == [{"value": 99}]
    assert fake_connector.calls == [("SELECT ? AS value", [99])]
    assert fake_connector.disconnected is True

    get_response = await client.get(f"/api/widgets/{widget['id']}")
    assert get_response.status_code == 200
    persisted = get_response.json()
    assert persisted["connection_id"] == str(connection.id)
    assert persisted["query_config"] == {"sql": "SELECT ? AS value", "params": [99]}
    assert persisted["data"] == [{"value": 99}]
