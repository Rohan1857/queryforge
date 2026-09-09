import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.session import get_db_session
from backend.dependencies import get_current_user
from backend.middleware.rate_limiter import limiter
from backend.models.user import User
from backend.schemas.user import TokenResponse, UserCreate, UserLogin, UserRead
from backend.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: UserCreate, db: AsyncSession = Depends(get_db_session)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: UserLogin, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/dev-login", response_model=TokenResponse)
@limiter.limit("30/minute")
async def dev_login(request: Request, db: AsyncSession = Depends(get_db_session)):
    if not settings.DEV_AUTH_BYPASS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development auth bypass is disabled",
        )

    result = await db.execute(select(User).where(User.email == settings.DEV_AUTH_EMAIL))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=settings.DEV_AUTH_EMAIL,
            name=settings.DEV_AUTH_NAME,
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(user)
    elif user.name != settings.DEV_AUTH_NAME:
        user.name = settings.DEV_AUTH_NAME

    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)):
    return UserRead.model_validate(user)


@router.put("/me", response_model=UserRead)
async def update_me(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if "name" in body:
        user.name = body["name"]
    if "email" in body:
        existing = await db.execute(
            select(User).where(User.email == body["email"], User.id != user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already taken")
        user.email = body["email"]
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)
