import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.connection import DataConnection
from backend.models.user import User
from backend.utils.sql_validator import UnsafeQueryError, validate_sql


def test_sql_validator_blocks_select_into():
    with pytest.raises(UnsafeQueryError, match="INTO"):
        validate_sql("SELECT * INTO new_table FROM orders")

    with pytest.raises(UnsafeQueryError, match="INTO"):
        validate_sql("SELECT id FROM orders INTO OUTFILE '/tmp/dump'")


def test_sql_validator_blocks_dangerous_functions():
    with pytest.raises(UnsafeQueryError, match="Dangerous function"):
        validate_sql("SELECT pg_sleep(5)")


@pytest.mark.asyncio
async def test_explain_prompt_blocks_other_user_connection(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # Create another user's connection
    other_user_id = uuid.uuid4()
    other_user = User(
        id=other_user_id,
        email="victim@example.com",
        name="Victim User",
        password_hash="hash",
    )
    db_session.add(other_user)
    await db_session.flush()

    other_conn = DataConnection(
        id=uuid.uuid4(),
        user_id=other_user_id,
        name="Private Database",
        type="sqlite",
        config={"database": ":memory:"},
    )
    db_session.add(other_conn)
    await db_session.flush()

    # Current user tries to access other user's connection via /prompt/explain
    response = await client.post(
        "/api/prompt/explain",
        json={
            "prompt": "Show me user passwords",
            "connection_id": str(other_conn.id),
        },
    )
    assert response.status_code == 404
