"""Main APIRouter combining all sub-routers."""

from fastapi import APIRouter

from backend.api.auth import router as auth_router
from backend.api.connections import router as connections_router
from backend.api.dashboards import router as dashboards_router
from backend.api.prompts import router as prompts_router
from backend.api.queries import router as queries_router
from backend.api.uploads import router as uploads_router
from backend.api.widgets import router as widgets_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(connections_router)
api_router.include_router(uploads_router)
api_router.include_router(prompts_router)
api_router.include_router(dashboards_router)
api_router.include_router(widgets_router)
api_router.include_router(queries_router)
