from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BlockchainWallet, BlockchainTransaction, User
from app.blockchain.wallet import WalletManager
from app.dependencies.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

class WalletCreate(BaseModel):
    name: str
    chain: str = "ethereum"
    wallet_type: str = "eoa"  # eoa or gnosis_safe
    team_id: Optional[int] = None

class WalletResponse(BaseModel):
    id: int
    name: str
    address: str
    chain: str
    wallet_type: str
    is_active: bool
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    safe_address: Optional[str] = None
    safe_threshold: Optional[int] = None

class SafeWalletCreate(BaseModel):
    name: str
    chain: str = "ethereum"
    owner_addresses: List[str]
    threshold: int
    team_id: Optional[int] = None

class TokenTransferRequest(BaseModel):
    wallet_id: int
    to_address: str
    token_address: str
    amount: float
    private_key: Optional[str] = None  # Should be handled securely
    gas_price_gwei: Optional[int] = None
    
# Wallet Management

@router.post("/wallets/", response_model=WalletResponse)
def create_wallet(
    wallet: WalletCreate, 
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Create a new blockchain wallet for the current user"""
    # Get the current user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Initialize wallet manager
    wallet_manager = WalletManager(chain=wallet.chain)
    
    # Create wallet based on type
    if wallet.wallet_type == "eoa":
        address, private_key = wallet_manager.create_eoa_wallet()
        
        # Store in database
        db_wallet = wallet_manager.record_wallet_in_db(
            db=db,
            address=address,
            wallet_type=wallet.wallet_type,
            name=wallet.name,
            user_id=user.id,
            team_id=wallet.team_id,
            metadata={"creation_date": "NOW()"}  # Example metadata
        )
        
        # The private key should be returned ONLY ONCE and then stored securely by the client
        # In a production environment, use a secure vault like AWS KMS or HashiCorp Vault
        return {
            **db_wallet.__dict__,
            "private_key": private_key  # WARNING: Only return once!
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Wallet type {wallet.wallet_type} not supported directly. Use /wallets/safe for multisig wallets")

@router.post("/wallets/safe/", response_model=WalletResponse)
def create_safe_wallet(
    safe_wallet: SafeWalletCreate,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Create a Gnosis Safe multi-signature wallet"""
    # Get the current user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate threshold
    if safe_wallet.threshold <= 0 or safe_wallet.threshold > len(safe_wallet.owner_addresses):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid threshold: must be between 1 and {len(safe_wallet.owner_addresses)}"
        )
    
    # Initialize wallet manager
    wallet_manager = WalletManager(chain=safe_wallet.chain)
    
    # Create the Safe
    safe_result = wallet_manager.create_gnosis_safe(
        owners=safe_wallet.owner_addresses,
        threshold=safe_wallet.threshold
    )
    
    # Record in database
    db_wallet = wallet_manager.record_wallet_in_db(
        db=db,
        address=safe_result["safe_address"],
        wallet_type="gnosis_safe",
        name=safe_wallet.name,
        user_id=user.id,
        team_id=safe_wallet.team_id,
        safe_address=safe_result["safe_address"],
        safe_owners=safe_wallet.owner_addresses,
        safe_threshold=safe_wallet.threshold,
        metadata={
            "creation_date": "NOW()",
            "deployment_transaction": safe_result["deployment_transaction"]
        }
    )
    
    return db_wallet

@router.get("/wallets/", response_model=List[WalletResponse])
def get_wallets(
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Get all wallets for the current user"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    wallets = db.query(BlockchainWallet).filter(BlockchainWallet.user_id == user.id).all()
    return wallets

@router.get("/wallets/{wallet_id}", response_model=WalletResponse)
def get_wallet(
    wallet_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Get a specific wallet by ID"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    wallet = db.query(BlockchainWallet).filter(
        BlockchainWallet.id == wallet_id,
        BlockchainWallet.user_id == user.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    return wallet

# Token Transfers

@router.post("/transfers/")
def transfer_tokens(
    transfer: TokenTransferRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Transfer tokens from a wallet to another address"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the wallet
    wallet = db.query(BlockchainWallet).filter(
        BlockchainWallet.id == transfer.wallet_id,
        BlockchainWallet.user_id == user.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found or not authorized")
    
    if not wallet.is_active:
        raise HTTPException(status_code=400, detail="Wallet is not active")
    
    # Initialize wallet manager for the chain
    wallet_manager = WalletManager(chain=wallet.chain)
    
    try:
        # For production systems, NEVER accept private keys directly in API calls
        # Instead, use a secure vault or signing service
        if not transfer.private_key:
            raise HTTPException(status_code=400, detail="Private key is required")
        
        # Perform the transfer
        tx_hash = wallet_manager.transfer_token(
            from_address=wallet.address,
            to_address=transfer.to_address,
            token_address=transfer.token_address,
            amount=transfer.amount,
            private_key=transfer.private_key,
            gas_price_gwei=transfer.gas_price_gwei
        )
        
        # Record the transaction
        blockchain_tx = wallet_manager.record_transaction_in_db(
            db=db,
            txn_hash=tx_hash,
            from_address=wallet.address,
            to_address=transfer.to_address,
            value=str(transfer.amount),
            wallet_id=wallet.id,
            function_name="transfer",
            function_args={
                "token_address": transfer.token_address,
                "amount": transfer.amount
            }
        )
        
        return {
            "success": True,
            "transaction_hash": tx_hash,
            "from": wallet.address,
            "to": transfer.to_address,
            "token_address": transfer.token_address,
            "amount": transfer.amount,
            "status": blockchain_tx.status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")

@router.get("/transactions/{wallet_id}")
def get_wallet_transactions(
    wallet_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Get all transactions for a specific wallet"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Ensure wallet belongs to user
    wallet = db.query(BlockchainWallet).filter(
        BlockchainWallet.id == wallet_id,
        BlockchainWallet.user_id == user.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found or not authorized")
    
    # Get transactions
    transactions = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.wallet_id == wallet_id
    ).all()
    
    return transactions 