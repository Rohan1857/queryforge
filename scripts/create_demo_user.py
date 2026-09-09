#!/usr/bin/env python3
"""Quick seed script to create a demo user."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.models.user import User
from backend.db.base import Base
from backend.services.auth_service import hash_password
from backend.config import settings

DATABASE_URL = settings.DATABASE_URL

async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if demo user exists
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == "demo@example.com"))
        existing = result.scalar_one_or_none()

        if existing:
            print("Demo user already exists!")
            print("Email: demo@example.com")
            print("Password: demo1234")
            return

        # Create demo user
        demo_user = User(
            email="demo@example.com",
            name="Demo User",
            password_hash=hash_password("demo1234")
        )
        session.add(demo_user)
        await session.commit()
        print("Demo user created successfully!")
        print("Email: demo@example.com")
        print("Password: demo1234")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
