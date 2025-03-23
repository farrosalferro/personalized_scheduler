from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from database import get_db
from auth import get_user_by_username, get_user_by_email, create_user, verify_password
from pydantic import BaseModel, EmailStr, validator
from typing import Optional

router = APIRouter()

# User registration model
class UserCreate(BaseModel):
    username: str
    email: EmailStr  # Changed from Optional[EmailStr] to make email required
    password: str
    
    @validator('username')
    def username_must_be_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if not v.isalnum():
            raise ValueError('Username must contain only alphanumeric characters')
        return v
        
    @validator('password')
    def password_must_be_strong(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

# Login model
class UserLogin(BaseModel):
    username: str
    password: str

# Response model that doesn't include password
class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    
    class Config:
        orm_mode = True

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username already exists
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email already exists (now required)
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    return create_user(db=db, username=user.username, password=user.password, email=user.email)

@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login a user and return basic information"""
    # Get user from database
    user = get_user_by_username(db, username=user_data.username)
    
    # Check if user exists and password is correct
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # In a real application, you would generate a token here
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }
