from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Wallet, User
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json

router = APIRouter()

class DepositRequest(BaseModel):
    user_id: int
    amount: float
    currency: str = "USD"  # Currency of the deposit

class WalletUpdate(BaseModel):
    user_id: int
    display_currency: str  # Only updating display currency

class WalletCreate(BaseModel):
    user_id: int
    base_currency: str
    country_code: Optional[str] = None
    display_currency: Optional[str] = None

@router.post("/deposit/")
def deposit_fiat(deposit: DepositRequest, db: Session = Depends(get_db)):
    """
    Deposit fiat currency into a user's wallet.
    Each user has only one wallet by design, which primarily holds their local currency.
    If the deposit is in a currency different from the base currency, conversion is applied.
    """
    user_wallet = db.query(Wallet).filter(Wallet.user_id == deposit.user_id).first()
    if not user_wallet:
        # If wallet doesn't exist, create one with the currency of this deposit
        user_wallet = Wallet(
            user_id=deposit.user_id,
            fiat_balance=0,
            stablecoin_balance=0,
            base_currency=deposit.currency,
            display_currency=deposit.currency
        )
        db.add(user_wallet)
        db.commit()
        db.refresh(user_wallet)
    
    # Check if deposit currency matches the wallet's base currency
    if deposit.currency == user_wallet.base_currency:
        # Direct deposit, no conversion needed
        user_wallet.fiat_balance += deposit.amount
    else:
        # For demo/prototype, we'll use a simplified conversion
        # In production, this would use a real-time exchange rate service
        from app.utils.conversion import fetch_conversion_rate
        conversion_rate = fetch_conversion_rate(deposit.currency, user_wallet.base_currency)
        converted_amount = deposit.amount * conversion_rate
        user_wallet.fiat_balance += converted_amount
    
    db.commit()
    return {
        "message": "Fiat deposit successful",
        "new_balance": user_wallet.fiat_balance,
        "currency": user_wallet.base_currency,
        "display_currency": user_wallet.display_currency
    }

@router.get("/{user_id}")
def get_wallet(user_id: int, db: Session = Depends(get_db)):
    """
    Get a user's wallet details with balance in both base and display currencies.
    Each user has one wallet that stores their balances in their local currency.
    If the wallet doesn't exist, create a default one.
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    
    if not wallet:
        # Auto-create a wallet for the user if it doesn't exist
        wallet = Wallet(
            user_id=user_id,
            fiat_balance=0,
            stablecoin_balance=0,
            base_currency="USD",  # Default to USD, can be changed later
            display_currency="USD"
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    
    # Get display balance in the preferred display currency
    display_balance = wallet.fiat_balance
    
    if wallet.base_currency != wallet.display_currency:
        # Convert the balance for display purposes
        from app.utils.conversion import fetch_conversion_rate
        conversion_rate = fetch_conversion_rate(wallet.base_currency, wallet.display_currency)
        display_balance = wallet.fiat_balance * conversion_rate
    
    return {
        "id": wallet.id,
        "user_id": wallet.user_id,
        "fiat_balance": wallet.fiat_balance,
        "base_currency": wallet.base_currency,
        "display_balance": display_balance,
        "display_currency": wallet.display_currency,
        "stablecoin_balance": wallet.stablecoin_balance,
        "country_code": wallet.country_code
    }

@router.patch("/display-currency")
def update_display_currency(wallet_update: WalletUpdate, db: Session = Depends(get_db)):
    """
    Update a wallet's display currency preference.
    This doesn't change the actual stored value, just how it's presented to the user.
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == wallet_update.user_id).first()
    if not wallet:
        # Auto-create a wallet with the requested display currency
        wallet = Wallet(
            user_id=wallet_update.user_id, 
            fiat_balance=0, 
            stablecoin_balance=0, 
            base_currency="USD",  # Default base currency
            display_currency=wallet_update.display_currency.upper()
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        return {
            "message": "Wallet created with display currency successfully",
            "wallet": {
                "id": wallet.id,
                "user_id": wallet.user_id,
                "fiat_balance": wallet.fiat_balance,
                "stablecoin_balance": wallet.stablecoin_balance,
                "base_currency": wallet.base_currency,
                "display_currency": wallet.display_currency
            }
        }
    
    # Validate currency code - in a real app, check against a list of supported currencies
    wallet.display_currency = wallet_update.display_currency.upper()
    db.commit()
    
    # Get display balance in the new preferred display currency
    display_balance = wallet.fiat_balance
    
    if wallet.base_currency != wallet.display_currency:
        # Convert the balance for display purposes
        from app.utils.conversion import fetch_conversion_rate
        conversion_rate = fetch_conversion_rate(wallet.base_currency, wallet.display_currency)
        display_balance = wallet.fiat_balance * conversion_rate
    
    return {
        "message": "Display currency updated successfully",
        "wallet": {
            "id": wallet.id,
            "user_id": wallet.user_id,
            "fiat_balance": wallet.fiat_balance,
            "base_currency": wallet.base_currency,
            "display_balance": display_balance,
            "display_currency": wallet.display_currency,
            "stablecoin_balance": wallet.stablecoin_balance
        }
    }

@router.get("/")
def get_all_wallets(db: Session = Depends(get_db)):
    """Get all wallets (admin function)"""
    wallets = db.query(Wallet).all()
    return wallets

@router.post("/create")
def create_wallet(wallet_data: WalletCreate, db: Session = Depends(get_db)):
    """
    Create a wallet for a user if they don't already have one.
    This enforces the one-wallet-per-user model.
    """
    # Check if user exists
    user = db.query(User).filter(User.id == wallet_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if the user already has a wallet
    existing_wallet = db.query(Wallet).filter(Wallet.user_id == wallet_data.user_id).first()
    if existing_wallet:
        # Return 409 Conflict to indicate that the resource already exists
        # This makes it clear to the client that multiple wallets per user are not allowed
        raise HTTPException(
            status_code=409, 
            detail="User already has a wallet. Each user can only have one wallet."
        )
    
    # Set display currency same as base if not specified
    display_currency = wallet_data.display_currency or wallet_data.base_currency
    
    # Create new wallet
    new_wallet = Wallet(
        user_id=wallet_data.user_id,
        fiat_balance=0,
        stablecoin_balance=0,
        base_currency=wallet_data.base_currency,
        display_currency=display_currency,
        country_code=wallet_data.country_code,
        currency_settings=json.dumps({
            "allowed_currencies": [wallet_data.base_currency, "USD", "EUR", "GBP"],
            "conversion_fee_percent": 1.0,  # 1% fee for currency conversions
            "regulatory_status": "compliant"
        })
    )
    
    db.add(new_wallet)
    db.commit()
    db.refresh(new_wallet)
    
    return {
        "message": "Wallet created successfully",
        "wallet": {
            "id": new_wallet.id,
            "user_id": new_wallet.user_id,
            "fiat_balance": new_wallet.fiat_balance,
            "stablecoin_balance": new_wallet.stablecoin_balance,
            "base_currency": new_wallet.base_currency,
            "display_currency": new_wallet.display_currency,
            "country_code": new_wallet.country_code
        }
    }
