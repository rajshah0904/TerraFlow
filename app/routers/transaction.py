from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Transaction, Wallet
from app.utils.conversion import fetch_conversion_rate
from pydantic import BaseModel
import requests
from typing import Optional, Literal

router = APIRouter()

class TransactionCreate(BaseModel):
    sender_id: int
    recipient_id: int
    amount: float
    source_currency: str
    target_currency: Optional[str] = None  # If None, use recipient's default currency

class CryptoTransactionCreate(BaseModel):
    sender_id: int
    recipient_id: int
    amount: float
    crypto_currency: str = "USDT"  # Default is USDT but can be other supported cryptos
    description: Optional[str] = "Crypto transfer"
    
@router.post("/crypto/")
def create_crypto_transaction(transaction: CryptoTransactionCreate, db: Session = Depends(get_db)):
    """
    Process a direct cryptocurrency transaction:
    1. Deduct from sender's stablecoin balance
    2. Add to recipient's stablecoin balance
    
    This is for users who specifically want to transact in crypto
    """
    # Step 1: Fetch wallets
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.sender_id).first()
    recipient_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.recipient_id).first()
    
    if not sender_wallet or not recipient_wallet:
        raise HTTPException(status_code=404, detail="Sender or recipient wallet not found")
    
    crypto = transaction.crypto_currency.upper()
    
    # Step 2: Check sender crypto balance
    if crypto == "USDT":
        if sender_wallet.stablecoin_balance < transaction.amount:
            raise HTTPException(status_code=400, detail=f"Insufficient {crypto} balance")
    else:
        # For future support of other cryptocurrencies
        raise HTTPException(status_code=400, detail=f"Currently only USDT is supported")
    
    # Step 3: Deduct from sender's wallet
    sender_wallet.stablecoin_balance -= transaction.amount
    
    # Step 4: Add to recipient's wallet
    recipient_wallet.stablecoin_balance += transaction.amount
    
    # Step 5: Record the transaction
    transaction_record = Transaction(
        sender_id=transaction.sender_id,
        recipient_id=transaction.recipient_id,
        stablecoin_amount=transaction.amount,
        source_amount=transaction.amount,
        source_currency=crypto,
        target_amount=transaction.amount,
        target_currency=crypto,
        source_to_stablecoin_rate=1.0,
        stablecoin_to_target_rate=1.0,
        status="completed"
    )
    
    db.add(transaction_record)
    db.commit()
    db.refresh(transaction_record)
    
    return {
        "message": f"Crypto transaction successful",
        "transaction_id": transaction_record.id,
        "details": {
            "sender_deducted": f"{transaction.amount} {crypto}",
            "recipient_received": f"{transaction.amount} {crypto}",
            "sender_new_balance": f"{sender_wallet.stablecoin_balance} {crypto}",
            "recipient_new_balance": f"{recipient_wallet.stablecoin_balance} {crypto}",
            "description": transaction.description
        }
    }

@router.post("/")
def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    """
    Process a cross-currency transaction using stablecoin as intermediary:
    1. Convert source currency to stablecoin (USDT) automatically
    2. Convert stablecoin to target currency automatically
    
    The user does not need to manage stablecoin balances directly.
    """
    # Step 1: Fetch wallets
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.sender_id).first()
    recipient_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.recipient_id).first()
    
    if not sender_wallet or not recipient_wallet:
        raise HTTPException(status_code=404, detail="Sender or recipient wallet not found")
    
    # Determine target currency - use recipient's base currency if not specified
    source_currency = transaction.source_currency or sender_wallet.base_currency or "USD"
    target_currency = transaction.target_currency or recipient_wallet.base_currency or "USD"
    
    # Check if the sender has the specified currency
    if source_currency != (sender_wallet.base_currency or "USD"):
        raise HTTPException(
            status_code=400, 
            detail=f"Sender wallet currency ({sender_wallet.base_currency}) does not match source currency ({source_currency})"
        )
    
    # Step 2: Check sender balance
    if sender_wallet.fiat_balance < transaction.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Step 3: Get conversion rates
    try:
        # For same currency transactions, skip conversion
        if source_currency == target_currency:
            source_to_usdt_rate = 1.0
            usdt_to_target_rate = 1.0
            stablecoin_amount = transaction.amount
            target_amount = transaction.amount
        else:
            # Get rate from source currency to USDT
            source_to_usdt_rate = fetch_conversion_rate(source_currency, "USDT")
            
            # Get rate from USDT to target currency
            usdt_to_target_rate = fetch_conversion_rate("USDT", target_currency)
            
            # Calculate intermediate USDT amount
            stablecoin_amount = transaction.amount * source_to_usdt_rate
            
            # Calculate final target currency amount
            target_amount = stablecoin_amount * usdt_to_target_rate
        
    except HTTPException as e:
        raise HTTPException(status_code=e.status_code, detail=f"Conversion failed: {e.detail}")
    
    # Step 4: Deduct from sender's wallet
    sender_wallet.fiat_balance -= transaction.amount
    
    # Step 5: Add to recipient's wallet in their currency
    recipient_wallet.fiat_balance += target_amount
    
    # Step 6: Record the transaction
    transaction_record = Transaction(
        sender_id=transaction.sender_id,
        recipient_id=transaction.recipient_id,
        stablecoin_amount=stablecoin_amount,
        source_amount=transaction.amount,
        source_currency=source_currency,
        target_amount=target_amount,
        target_currency=target_currency,
        source_to_stablecoin_rate=source_to_usdt_rate,
        stablecoin_to_target_rate=usdt_to_target_rate,
        status="completed"
    )
    
    db.add(transaction_record)
    db.commit()
    db.refresh(transaction_record)
    
    return {
        "message": "Transaction successful",
        "transaction_id": transaction_record.id,
        "details": {
            "sender_deducted": f"{transaction.amount} {source_currency}",
            "recipient_received": f"{target_amount} {target_currency}",
            "sender_new_balance": f"{sender_wallet.fiat_balance} {sender_wallet.base_currency}",
            "recipient_new_balance": f"{recipient_wallet.fiat_balance} {recipient_wallet.base_currency}",
        }
    }

@router.get("/{user_id}/history")
def get_transaction_history(user_id: int, db: Session = Depends(get_db)):
    """Get transaction history for a user (both sent and received)"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get transactions where user is either sender or recipient
    sent_transactions = db.query(Transaction).filter(Transaction.sender_id == user_id).all()
    received_transactions = db.query(Transaction).filter(Transaction.recipient_id == user_id).all()
    
    return {
        "sent_transactions": sent_transactions,
        "received_transactions": received_transactions
    }

@router.get("/")
def get_all_transactions(db: Session = Depends(get_db)):
    """Get all transactions (admin function)"""
    transactions = db.query(Transaction).all()
    return transactions

@router.get("/user/{user_id}")
def get_user_transactions(user_id: int, db: Session = Depends(get_db)):
    """Get all transactions for a specific user (both sent and received)"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get transactions where user is either sender or recipient
    sent = db.query(Transaction).filter(Transaction.sender_id == user_id).all()
    received = db.query(Transaction).filter(Transaction.recipient_id == user_id).all()
    
    # Combine and return all transactions
    all_user_transactions = sent + received
    return all_user_transactions

class SimpleTransactionCreate(BaseModel):
    sender_id: int
    recipient_id: int
    amount: float
    description: Optional[str] = "Direct transfer"

@router.post("/direct/")
def create_direct_transaction(transaction: SimpleTransactionCreate, db: Session = Depends(get_db)):
    """
    Process a simple direct transaction without currency conversion:
    1. Deduct from sender's wallet
    2. Add to recipient's wallet
    """
    # Step 1: Fetch wallets
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.sender_id).first()
    recipient_wallet = db.query(Wallet).filter(Wallet.user_id == transaction.recipient_id).first()
    
    if not sender_wallet or not recipient_wallet:
        raise HTTPException(status_code=404, detail="Sender or recipient wallet not found")
    
    # Step 2: Check sender balance
    if sender_wallet.fiat_balance < transaction.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Step 3: Deduct from sender's wallet
    sender_wallet.fiat_balance -= transaction.amount
    
    # Step 4: Add to recipient's wallet
    recipient_wallet.fiat_balance += transaction.amount
    
    # Step 5: Record the transaction
    transaction_record = Transaction(
        sender_id=transaction.sender_id,
        recipient_id=transaction.recipient_id,
        stablecoin_amount=transaction.amount,  # Use same amount since no conversion
        source_amount=transaction.amount,
        source_currency=sender_wallet.currency,
        target_amount=transaction.amount,
        target_currency=recipient_wallet.currency,
        source_to_stablecoin_rate=1.0,
        stablecoin_to_target_rate=1.0,
        status="completed"
    )
    
    db.add(transaction_record)
    db.commit()
    db.refresh(transaction_record)
    
    return {
        "message": "Direct transaction successful",
        "transaction_id": transaction_record.id,
        "details": {
            "sender_deducted": f"{transaction.amount} {sender_wallet.currency}",
            "recipient_received": f"{transaction.amount} {recipient_wallet.currency}",
            "sender_new_balance": f"{sender_wallet.fiat_balance} {sender_wallet.currency}",
            "recipient_new_balance": f"{recipient_wallet.fiat_balance} {recipient_wallet.currency}",
            "description": transaction.description
        }
    }
