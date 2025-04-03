from langchain.tools import BaseTool
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models import User, BlockchainWallet, Transaction
from app.blockchain.wallet import WalletManager
import json
import re

class ResolveRecipientTool(BaseTool):
    """Tool to resolve a recipient identifier to a blockchain address."""
    
    name = "resolve_recipient"
    description = """
    Resolves a recipient identifier (name, email, or wallet address) to a valid blockchain address.
    Input should be a JSON string with:
    {
        "recipient": "recipient identifier (name, email, or address)",
        "network": "optional blockchain network (ethereum, polygon, etc.)"
    }
    """
    
    def __init__(self, db_session: Session):
        super().__init__()
        self.db_session = db_session
    
    def _run(self, query: str) -> str:
        try:
            # Parse input
            params = json.loads(query)
            recipient = params.get("recipient", "")
            network = params.get("network", "ethereum")
            
            # If recipient looks like an Ethereum address, return it directly
            if re.match(r"^0x[a-fA-F0-9]{40}$", recipient):
                return json.dumps({
                    "success": True,
                    "address": recipient,
                    "network": network,
                    "resolved_type": "direct_address"
                })
            
            # Try to resolve by username
            user = self.db_session.query(User).filter(User.username == recipient).first()
            if user and user.wallet_address:
                return json.dumps({
                    "success": True,
                    "address": user.wallet_address,
                    "network": network,
                    "resolved_type": "username"
                })
            
            # Try to resolve by email
            user = self.db_session.query(User).filter(User.email == recipient).first()
            if user and user.wallet_address:
                return json.dumps({
                    "success": True,
                    "address": user.wallet_address,
                    "network": network,
                    "resolved_type": "email"
                })
            
            # Try to resolve by wallet name
            wallet = self.db_session.query(BlockchainWallet).filter(
                BlockchainWallet.name == recipient,
                BlockchainWallet.chain == network
            ).first()
            if wallet:
                return json.dumps({
                    "success": True,
                    "address": wallet.address,
                    "network": network,
                    "resolved_type": "wallet_name"
                })
            
            # Resolution failed
            return json.dumps({
                "success": False,
                "error": f"Could not resolve recipient '{recipient}' to a valid address"
            })
            
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })
    
    async def _arun(self, query: str) -> str:
        # Async implementation would be similar
        return self._run(query)

class GetWalletBalanceTool(BaseTool):
    """Tool to check wallet balance for various tokens."""
    
    name = "get_wallet_balance"
    description = """
    Checks the balance of a wallet for a specific token.
    Input should be a JSON string with:
    {
        "wallet_identifier": "wallet name, address, or ID",
        "token_address": "optional contract address of the token",
        "network": "optional blockchain network (ethereum, polygon, etc.)"
    }
    If no token_address is provided, checks the native token balance.
    """
    
    def __init__(self, db_session: Session):
        super().__init__()
        self.db_session = db_session
    
    def _run(self, query: str) -> str:
        try:
            # Parse input
            params = json.loads(query)
            wallet_identifier = params.get("wallet_identifier", "")
            token_address = params.get("token_address", "")
            network = params.get("network", "ethereum")
            
            # Initialize wallet manager
            wallet_manager = WalletManager(chain=network)
            
            # Try to resolve wallet by name
            wallet = self.db_session.query(BlockchainWallet).filter(
                BlockchainWallet.name == wallet_identifier,
                BlockchainWallet.chain == network
            ).first()
            
            # If not found by name, try by ID
            if not wallet and wallet_identifier.isdigit():
                wallet = self.db_session.query(BlockchainWallet).filter(
                    BlockchainWallet.id == int(wallet_identifier)
                ).first()
            
            # If not found by ID, try by address
            if not wallet and re.match(r"^0x[a-fA-F0-9]{40}$", wallet_identifier):
                wallet = self.db_session.query(BlockchainWallet).filter(
                    BlockchainWallet.address == wallet_identifier
                ).first()
            
            # If wallet not found in DB but is a valid address
            if not wallet and re.match(r"^0x[a-fA-F0-9]{40}$", wallet_identifier):
                # Check balance directly
                try:
                    if token_address:
                        balance = wallet_manager.get_token_balance(wallet_identifier, token_address)
                    else:
                        balance = wallet_manager.get_balance(wallet_identifier)
                    
                    return json.dumps({
                        "success": True,
                        "wallet_address": wallet_identifier,
                        "balance": balance,
                        "token_address": token_address or "native",
                        "network": network
                    })
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Error checking balance: {str(e)}"
                    })
            
            # If wallet found in DB
            if wallet:
                try:
                    if token_address:
                        balance = wallet_manager.get_token_balance(wallet.address, token_address)
                    else:
                        balance = wallet_manager.get_balance(wallet.address)
                    
                    return json.dumps({
                        "success": True,
                        "wallet_id": wallet.id,
                        "wallet_name": wallet.name,
                        "wallet_address": wallet.address,
                        "balance": balance,
                        "token_address": token_address or "native",
                        "network": wallet.chain
                    })
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Error checking balance: {str(e)}"
                    })
            
            # Wallet not found
            return json.dumps({
                "success": False,
                "error": f"Wallet not found with identifier '{wallet_identifier}'"
            })
            
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })
    
    async def _arun(self, query: str) -> str:
        # Async implementation would be similar
        return self._run(query)

class TransferTokenTool(BaseTool):
    """Tool to transfer tokens from one wallet to another."""
    
    name = "transfer_token"
    description = """
    Transfers tokens from one wallet to another.
    Input should be a JSON string with:
    {
        "source_wallet_identifier": "source wallet name, address, or ID",
        "recipient_address": "destination address", 
        "token_address": "contract address of the token",
        "amount": "amount to transfer",
        "private_key": "optional private key for signing (should be secured)",
        "network": "optional blockchain network (ethereum, polygon, etc.)",
        "gas_price_gwei": "optional gas price in gwei"
    }
    """
    
    def __init__(self, db_session: Session):
        super().__init__()
        self.db_session = db_session
    
    def _run(self, query: str) -> str:
        try:
            # Parse input
            params = json.loads(query)
            source_wallet_identifier = params.get("source_wallet_identifier", "")
            recipient_address = params.get("recipient_address", "")
            token_address = params.get("token_address", "")
            amount = float(params.get("amount", 0))
            private_key = params.get("private_key", "")
            network = params.get("network", "ethereum")
            gas_price_gwei = params.get("gas_price_gwei")
            
            if gas_price_gwei:
                gas_price_gwei = int(gas_price_gwei)
            
            # Validate inputs
            if not recipient_address or not re.match(r"^0x[a-fA-F0-9]{40}$", recipient_address):
                return json.dumps({
                    "success": False,
                    "error": "Invalid recipient address"
                })
            
            if not token_address or not re.match(r"^0x[a-fA-F0-9]{40}$", token_address):
                return json.dumps({
                    "success": False,
                    "error": "Invalid token address"
                })
            
            if amount <= 0:
                return json.dumps({
                    "success": False,
                    "error": "Amount must be greater than 0"
                })
            
            # Initialize wallet manager
            wallet_manager = WalletManager(chain=network)
            
            # Try to resolve source wallet
            source_wallet = None
            
            # Try by name
            source_wallet = self.db_session.query(BlockchainWallet).filter(
                BlockchainWallet.name == source_wallet_identifier,
                BlockchainWallet.chain == network
            ).first()
            
            # If not found by name, try by ID
            if not source_wallet and source_wallet_identifier.isdigit():
                source_wallet = self.db_session.query(BlockchainWallet).filter(
                    BlockchainWallet.id == int(source_wallet_identifier)
                ).first()
            
            # If not found by ID, try by address
            if not source_wallet and re.match(r"^0x[a-fA-F0-9]{40}$", source_wallet_identifier):
                source_wallet = self.db_session.query(BlockchainWallet).filter(
                    BlockchainWallet.address == source_wallet_identifier
                ).first()
            
            # If wallet not found in DB but is a valid address and private key provided
            if not source_wallet and re.match(r"^0x[a-fA-F0-9]{40}$", source_wallet_identifier):
                if not private_key:
                    return json.dumps({
                        "success": False,
                        "error": "Private key required for direct address transfer"
                    })
                
                try:
                    # Execute transfer directly
                    tx_hash = wallet_manager.transfer_token(
                        from_address=source_wallet_identifier,
                        to_address=recipient_address,
                        token_address=token_address,
                        amount=amount,
                        private_key=private_key,
                        gas_price_gwei=gas_price_gwei
                    )
                    
                    return json.dumps({
                        "success": True,
                        "from_address": source_wallet_identifier,
                        "to_address": recipient_address,
                        "token_address": token_address,
                        "amount": amount,
                        "transaction_hash": tx_hash,
                        "network": network
                    })
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Transfer failed: {str(e)}"
                    })
            
            # If wallet found in DB but no private key provided
            if source_wallet and not private_key:
                return json.dumps({
                    "success": False,
                    "error": "Private key required for transfer"
                })
            
            # If wallet found in DB and private key provided
            if source_wallet and private_key:
                try:
                    # Execute transfer
                    tx_hash = wallet_manager.transfer_token(
                        from_address=source_wallet.address,
                        to_address=recipient_address,
                        token_address=token_address,
                        amount=amount,
                        private_key=private_key,
                        gas_price_gwei=gas_price_gwei
                    )
                    
                    # Record transaction in DB
                    blockchain_tx = wallet_manager.record_transaction_in_db(
                        db=self.db_session,
                        txn_hash=tx_hash,
                        from_address=source_wallet.address,
                        to_address=recipient_address,
                        value=str(amount),
                        wallet_id=source_wallet.id,
                        function_name="transfer",
                        function_args={
                            "token_address": token_address,
                            "amount": amount
                        }
                    )
                    
                    return json.dumps({
                        "success": True,
                        "wallet_id": source_wallet.id,
                        "wallet_name": source_wallet.name,
                        "from_address": source_wallet.address,
                        "to_address": recipient_address,
                        "token_address": token_address,
                        "amount": amount,
                        "transaction_hash": tx_hash,
                        "transaction_id": blockchain_tx.id,
                        "network": source_wallet.chain
                    })
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Transfer failed: {str(e)}"
                    })
            
            # Source wallet not found
            return json.dumps({
                "success": False,
                "error": f"Source wallet not found with identifier '{source_wallet_identifier}'"
            })
            
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })
    
    async def _arun(self, query: str) -> str:
        # Async implementation would be similar
        return self._run(query)

class GetTransactionStatusTool(BaseTool):
    """Tool to check the status of a transaction by hash or ID."""
    
    name = "get_transaction_status"
    description = """
    Checks the status of a transaction by hash or ID.
    Input should be a JSON string with:
    {
        "transaction_identifier": "transaction hash or ID",
        "network": "optional blockchain network (ethereum, polygon, etc.)"
    }
    """
    
    def __init__(self, db_session: Session):
        super().__init__()
        self.db_session = db_session
    
    def _run(self, query: str) -> str:
        try:
            # Parse input
            params = json.loads(query)
            transaction_identifier = params.get("transaction_identifier", "")
            network = params.get("network", "ethereum")
            
            # Initialize wallet manager
            wallet_manager = WalletManager(chain=network)
            
            # Try to resolve transaction by ID
            if transaction_identifier.isdigit():
                # Look up in our database
                tx = self.db_session.query(Transaction).filter(
                    Transaction.id == int(transaction_identifier)
                ).first()
                
                if tx:
                    return json.dumps({
                        "success": True,
                        "transaction_id": tx.id,
                        "sender_id": tx.sender_id,
                        "recipient_id": tx.recipient_id,
                        "stablecoin_amount": tx.stablecoin_amount,
                        "source_amount": tx.source_amount,
                        "source_currency": tx.source_currency,
                        "target_amount": tx.target_amount,
                        "target_currency": tx.target_currency,
                        "status": tx.status,
                        "timestamp": tx.timestamp.isoformat(),
                        "blockchain_txn_hash": tx.blockchain_txn_hash
                    })
            
            # Try to resolve by blockchain transaction hash
            if re.match(r"^0x[a-fA-F0-9]{64}$", transaction_identifier):
                # Look up in blockchain_transactions table
                blockchain_tx = self.db_session.query(BlockchainTransaction).filter(
                    BlockchainTransaction.txn_hash == transaction_identifier
                ).first()
                
                if blockchain_tx:
                    return json.dumps({
                        "success": True,
                        "transaction_id": blockchain_tx.id,
                        "txn_hash": blockchain_tx.txn_hash,
                        "from_address": blockchain_tx.from_address,
                        "to_address": blockchain_tx.to_address,
                        "value": blockchain_tx.value,
                        "status": blockchain_tx.status,
                        "timestamp": blockchain_tx.timestamp.isoformat(),
                        "network": blockchain_tx.chain
                    })
                
                # If not in our database, try to get from chain
                try:
                    # This is a simplified version that would need to be expanded
                    # We would check the transaction receipt on-chain
                    web3 = wallet_manager.w3
                    tx_receipt = web3.eth.get_transaction_receipt(transaction_identifier)
                    
                    if tx_receipt:
                        status = "confirmed" if tx_receipt.get("status") == 1 else "failed"
                        
                        return json.dumps({
                            "success": True,
                            "txn_hash": transaction_identifier,
                            "from_address": tx_receipt.get("from", ""),
                            "to_address": tx_receipt.get("to", ""),
                            "status": status,
                            "block_number": tx_receipt.get("blockNumber"),
                            "gas_used": tx_receipt.get("gasUsed"),
                            "network": network,
                            "note": "Transaction found on-chain but not in local database"
                        })
                    
                    return json.dumps({
                        "success": False,
                        "error": f"Transaction with hash {transaction_identifier} not found on-chain"
                    })
                    
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Error checking on-chain transaction: {str(e)}"
                    })
            
            # Transaction not found
            return json.dumps({
                "success": False,
                "error": f"Transaction not found with identifier '{transaction_identifier}'"
            })
            
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })
    
    async def _arun(self, query: str) -> str:
        # Async implementation would be similar
        return self._run(query)

def get_payment_tools(db_session: Session) -> List[BaseTool]:
    """Returns a list of all available payment tools with the db session."""
    return [
        ResolveRecipientTool(db_session),
        GetWalletBalanceTool(db_session),
        TransferTokenTool(db_session),
        GetTransactionStatusTool(db_session)
    ] 