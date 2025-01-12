from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from pydantic import BaseModel

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    password: str
    wallet_address: str

@router.post("/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code = 400, detail = "Username already exists")
    
    new_user = User(
        username = user.username,
        password = user.password,
        wallet_address = user.wallet_address
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/")
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()

