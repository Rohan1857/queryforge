"""
E2E test conftest — overrides the parent conftest fixtures.

The e2e tests talk to a live running server, so we don't need
the in-memory SQLite setup from the parent conftest.
"""

import pytest


# Override the session-scoped autouse fixture from parent conftest
# to prevent SQLite table creation (which fails with PG-specific types).
@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """No-op: e2e tests use the live database, not in-memory SQLite."""
    yield
