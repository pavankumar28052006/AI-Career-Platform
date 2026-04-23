import asyncio

from arq.connections import RedisSettings
from core.config import get_settings
from core.logging import get_logger
from db.neo4j_client import close_neo4j, init_neo4j
from db.redis_client import close_redis, init_redis
from services.job_service import process_resume_job

logger = get_logger(__name__)

async def startup(ctx):
    logger.info("Starting up arq worker...")
    await init_redis()
    await init_neo4j()

async def shutdown(ctx):
    await close_neo4j()
    await close_redis()
    logger.info("Shutting down arq worker...")

class WorkerSettings:
    functions = [process_resume_job]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 300
