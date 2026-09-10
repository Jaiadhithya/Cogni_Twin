import asyncio
from src.infrastructure.database.engine import engine
from src.infrastructure.database.models import Base

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized successfully")

if __name__ == "__main__":
    asyncio.run(init())
