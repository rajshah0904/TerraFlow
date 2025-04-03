from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from app.database import get_db
from app.models import User, Wallet
from pydantic import BaseModel, EmailStr
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from app.dependencies.auth import get_current_user
from app.config import AppConfig

router = APIRouter()

# Get configuration
config = AppConfig()
SECRET_KEY = config.auth.secret_key
ALGORITHM = config.auth.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = config.auth.access_token_expire_minutes

class UserCreate(BaseModel):
    username: str
    password: str
    wallet_address: str
    email: str  # Added email as a required field

@router.post("/register/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Use a more direct query approach that's safer for schema migrations
    result = db.execute(text(f"SELECT id FROM users WHERE username = :username"), {"username": user.username}).first()
    if result:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists - use raw SQL to avoid ORM schema issues
    result = db.execute(text(f"SELECT id FROM users WHERE email = :email"), {"email": user.email}).first()
    if result:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    try:
        # Use direct SQL insert instead of ORM to avoid schema mismatches
        db.execute(
            text("""
                INSERT INTO users (username, hashed_password, wallet_address, email, role, is_active) 
                VALUES (:username, :hashed_password, :wallet_address, :email, :role, :is_active)
            """),
            {
                "username": user.username,
                "hashed_password": hashed_password,
                "wallet_address": user.wallet_address,
                "email": user.email,
                "role": "user",
                "is_active": True
            }
        )
        db.commit()
        
        # Get the newly created user ID
        new_user = db.execute(text(f"SELECT id FROM users WHERE username = :username"), {"username": user.username}).first()
        user_id = new_user[0]
        
        # Create a wallet for the new user
        db.execute(
            text("""
                INSERT INTO wallets (user_id, fiat_balance, stablecoin_balance, currency) 
                VALUES (:user_id, :fiat_balance, :stablecoin_balance, :currency)
            """),
            {
                "user_id": user_id,
                "fiat_balance": 0.0,
                "stablecoin_balance": 0.0,
                "currency": "USD"
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
        # If we get a database error, show detailed error message
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"message": "User registered successfully!", "user_id": user_id}

@router.get("/")
def read_users(db: Session = Depends(get_db)):
    users = db.execute(text("SELECT id, username, wallet_address, email FROM users")).fetchall()
    return [{"id": user[0], "username": user[1], "wallet_address": user[2], "email": user[3]} for user in users]

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login/", response_model=Token)
def login(user: LoginRequest, db: Session = Depends(get_db)):
    # Get user using raw SQL to avoid ORM schema issues
    result = db.execute(
        text(f"SELECT id, username, hashed_password FROM users WHERE username = :username"), 
        {"username": user.username}
    ).first()
    if not result:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    user_id, username, hashed_password = result
    
    if not bcrypt.checkpw(user.password.encode("utf-8"), hashed_password.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={'sub': username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
    
@router.get("/user/")
def get_user_details(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get user using raw SQL to avoid ORM schema issues
    result = db.execute(
        text(f"SELECT id, username, wallet_address, email FROM users WHERE username = :username"),
        {"username": username}
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id, username, wallet_address, email = result
    
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "wallet_address": wallet_address
    }
