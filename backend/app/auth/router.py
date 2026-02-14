from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from datetime import datetime
from typing import cast

from app.core.database import get_async_session
from app.core.cache_service import cache_service
from app.core.security import get_password_hash, verify_password, create_access_token
from app.rag.config import settings
from app.auth.models import User, UserSettings
from app.collection.models import Collection
from app.auth.schemas import (
    UserCreate,
    UserRead,
    Token,
    UserLogin,
    TokenData,
    UserUpdate,
    UserSettingsRead,
    UserSettingsUpdate,
    UserSettingsResponse,
)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def ensure_default_collection(user_id: int, session: AsyncSession):
    """Ensure a default collection exists for the user."""
    statement = select(Collection).where(
        Collection.user_id == user_id, Collection.is_default == True
    )
    result = await session.execute(statement)
    default_col = result.scalar_one_or_none()
    if not default_col:
        default_col = Collection(
            name="Default Collection",
            description="Your primary collection for documents.",
            is_default=True,
            user_id=user_id,
        )
        session.add(default_col)
        await session.commit()
        await session.refresh(default_col)
    return default_col


DEFAULT_COLLECTIONS = [
    {"name": "HR", "description": "Human Resources documents"},
    {"name": "Contract", "description": "Legal contracts and agreements"},
    {"name": "Accounts", "description": "Financial documents"},
]


async def ensure_all_default_collections(user_id: int, session: AsyncSession):
    """Ensure all default collections exist for the user (HR, Contract, Accounts)."""
    for coll_data in DEFAULT_COLLECTIONS:
        statement = select(Collection).where(
            Collection.user_id == user_id, Collection.name == coll_data["name"]
        )
        result = await session.execute(statement)
        if result.scalar_one_or_none():
            continue

        is_default = coll_data["name"] == "Default Collection"
        collection = Collection(
            name=coll_data["name"],
            description=coll_data["description"],
            is_default=is_default,
            user_id=user_id,
        )
        session.add(collection)

    await session.commit()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    """Get current authenticated user from JWT token using modern dependency injection."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
        email_str = str(email)
        token_data = TokenData(email=email_str)
    except JWTError:
        raise credentials_exception

    if token_data.email is None:
        raise credentials_exception

    statement = select(User).where(User.email == token_data.email)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # User should have an ID when retrieved from database
    user_id = cast(int, user.id)

    # Ensure all default collections exist
    await ensure_all_default_collections(user_id, session)

    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate, session: AsyncSession = Depends(get_async_session)
) -> UserRead:
    """Register a new user with email verification."""
    statement = select(User).where(User.email == user_in.email.lower().strip())
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    hashed_password = get_password_hash(user_in.password)
    user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hashed_password,
        full_name=user_in.full_name.strip(),
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    user_id = cast(int, user.id)
    await ensure_all_default_collections(user_id, session)

    return UserRead.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin, session: AsyncSession = Depends(get_async_session)
) -> Token:
    """Authenticate user and return access token."""
    statement = select(User).where(User.email == login_data.email.lower().strip())
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact support.",
        )

    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token, token_type="bearer")


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (client should clear token)."""
    return {"message": "Successfully logged out. Please clear your local credentials."}


@router.post("/forgot-password")
async def forgot_password(email: dict):
    """
    Request password reset link.
    Currently returns a placeholder response.
    In production, implement email sending with reset token.
    """
    return {
        "message": "If an account exists with this email, a password reset link has been sent.",
        "note": "This is a placeholder. Configure email settings to enable password reset.",
    }


@router.post("/reset-password")
async def reset_password(token_data: dict, new_password: dict):
    """
    Reset password with token.
    Currently returns a placeholder response.
    In production, implement token verification and password update.
    """
    return {
        "message": "Your password has been successfully reset.",
        "note": "This is a placeholder. Configure email settings to enable password reset.",
    }


@router.get("/me", response_model=UserRead)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserRead:
    """Update current user's profile."""
    if user_in.email:
        email_lower = user_in.email.lower().strip()
        result = await session.execute(select(User).where(User.email == email_lower))
        existing_user = result.scalar_one_or_none()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered by another account",
            )
        current_user.email = email_lower

    if user_in.full_name:
        current_user.full_name = user_in.full_name.strip()

    if user_in.password:
        current_user.hashed_password = get_password_hash(user_in.password)

    current_user.updated_at = datetime.utcnow()
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return UserRead.model_validate(current_user)


@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsResponse:
    """Get user's AI settings and preferences with caching."""
    # Check cache first
    if cache_service.is_available:
        user_id = cast(int, current_user.id)
        cached = cache_service.get_user_settings(user_id)
        if cached:
            return UserSettingsResponse(
                success=True,
                message="User settings retrieved from cache",
                data=UserSettingsRead(**cached),
            )

    # Fetch from database
    user_id = cast(int, current_user.id)
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create default settings for new user
        settings = UserSettings(user_id=user_id)
        session.add(settings)
        await session.commit()
        await session.refresh(settings)

    # Cache the settings
    if cache_service.is_available:
        cache_service.set_user_settings(user_id, settings.model_dump())

    # Convert to UserSettingsRead for response
    settings_data = UserSettingsRead.model_validate(settings)

    return UserSettingsResponse(
        success=True, message="User settings retrieved successfully", data=settings_data
    )


@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsResponse:
    """Update user's AI settings and preferences."""
    # Get or create user settings
    user_id = cast(int, current_user.id)
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create new settings if they don't exist
        settings = UserSettings(user_id=user_id)
        session.add(settings)

    # Update only provided fields
    update_data = settings_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
    session.add(settings)
    await session.commit()
    await session.refresh(settings)

    # Invalidate cache
    if cache_service.is_available:
        cache_service.invalidate_user_settings(user_id)

    # Convert to UserSettingsRead for response
    settings_data = UserSettingsRead.model_validate(settings)

    return UserSettingsResponse(
        success=True, message="User settings updated successfully", data=settings_data
    )


@router.post("/settings/reset", response_model=UserSettingsResponse)
async def reset_user_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsResponse:
    """Reset user's AI settings to default values."""
    # Get or create user settings
    user_id = cast(int, current_user.id)
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=user_id)
    else:
        # Reset to default values
        settings.default_temperature = 0.7
        settings.default_top_k = 5
        settings.preferred_collection_id = None
        settings.theme = "dark"
        settings.language = "en"
        settings.auto_save_chat = True
        settings.show_translations = True
        settings.enable_tts = True
        settings.updated_at = datetime.utcnow()

    session.add(settings)
    await session.commit()
    await session.refresh(settings)

    # Invalidate cache
    if cache_service.is_available:
        cache_service.invalidate_user_settings(user_id)

    return UserSettingsResponse(
        success=True,
        message="User settings reset to defaults",
        data=UserSettingsRead.model_validate(settings),
    )
