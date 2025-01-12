from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Trade
from pydantic import BaseModel

router = APIRouter()

class TradeCreate(BaseModel):
    user_id: int
    currency_pair: str
    amount: float
    rate: float

@router.post("/")
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    new_trade = Trade(
        user_id = trade.user_id,
        currency_pair = trade.currency_pair,
        amount = trade.amount,
        rate = trade.rate
    )
    
    db.add(new_trade)
    db.commit()
    db.refresh(new_trade)
    return new_trade
    
@router.get("/")
def read_trades(db: Session = Depends(get_db)):
    return db.query(Trade).all()

