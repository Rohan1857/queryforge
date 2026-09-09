import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Widget(Base):
    __tablename__ = "widgets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connections.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    chart_config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    layout_position: Mapped[dict] = mapped_column(JSONB, nullable=False)
    cached_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    refresh_interval: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    dashboard = relationship("Dashboard", back_populates="widgets")
    connection = relationship("DataConnection", back_populates="widgets")
