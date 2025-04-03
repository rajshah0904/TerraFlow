from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Trade
from pydantic import BaseModel

router = APIRouter()

class TradeCreate(BaseModel):
    sender_id: int
    recipient_id: int
    stablecoin_amount: float
    fiat_amount: float
    conversion_rate: float

@router.post("/")
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    # Create a new trade instance using the provided details.
    new_trade = Trade(
        sender_id=trade.sender_id,
        recipient_id=trade.recipient_id,
        stablecoin_amount=trade.stablecoin_amount,
        fiat_amount=trade.fiat_amount,
        conversion_rate=trade.conversion_rate
    )
    
    db.add(new_trade)
    db.commit()
    db.refresh(new_trade)
    return new_trade
    
@router.get("/")
def read_trades(db: Session = Depends(get_db)):
    return db.query(Trade).all()
