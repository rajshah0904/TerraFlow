from web3 import Web3
from eth_account import Account
from typing import Dict, List, Optional, Tuple, Any
import json
from app.config import config
from app.models import BlockchainWallet, BlockchainTransaction
from sqlalchemy.orm import Session
from fastapi import HTTPException

class WalletManager:
    """Manager for blockchain wallet operations"""
    
    def __init__(self, chain: str = "ethereum"):
        """Initialize with the specific blockchain"""
        self.chain = chain
        
        # Initialize appropriate Web3 provider based on chain
        if chain == "ethereum":
            self.w3 = Web3(Web3.HTTPProvider(config.blockchain.eth_rpc_url))
        elif chain == "polygon":
            self.w3 = Web3(Web3.HTTPProvider(config.blockchain.polygon_rpc_url))
        elif chain == "avalanche":
            self.w3 = Web3(Web3.HTTPProvider(config.blockchain.avalanche_rpc_url))
        else:
            raise ValueError(f"Unsupported chain: {chain}")
    
    def create_eoa_wallet(self) -> Tuple[str, str]:
        """Create an Externally Owned Account wallet and return (address, private_key)"""
        account = Account.create()
        return (account.address, account.key.hex())
    
    def get_balance(self, address: str) -> float:
        """Get the native token balance for an address in ether/native units"""
        if not self.w3.is_address(address):
            raise ValueError("Invalid address")
        
        wei_balance = self.w3.eth.get_balance(address)
        return self.w3.from_wei(wei_balance, 'ether')
    
    def get_token_balance(self, wallet_address: str, token_address: str) -> float:
        """Get ERC20 token balance"""
        # Standard ERC20 ABI with just balanceOf and decimals methods
        erc20_abi = json.loads('''[
            {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
            {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
        ]''')
        
        token_contract = self.w3.eth.contract(address=token_address, abi=erc20_abi)
        balance = token_contract.functions.balanceOf(wallet_address).call()
        decimals = token_contract.functions.decimals().call()
        
        return balance / (10 ** decimals)
    
    def transfer_token(
        self, 
        from_address: str, 
        to_address: str, 
        token_address: str, 
        amount: float, 
        private_key: str,
        gas_price_gwei: Optional[int] = None
    ) -> str:
        """Transfer ERC20 tokens from one address to another"""
        # Standard ERC20 ABI with transfer method
        erc20_abi = json.loads('''[
            {"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"type":"function"},
            {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
        ]''')
        
        token_contract = self.w3.eth.contract(address=token_address, abi=erc20_abi)
        decimals = token_contract.functions.decimals().call()
        
        # Convert amount to token units
        token_amount = int(amount * (10 ** decimals))
        
        # Build the transaction
        tx = token_contract.functions.transfer(
            to_address, 
            token_amount
        ).build_transaction({
            'from': from_address,
            'nonce': self.w3.eth.get_transaction_count(from_address),
            'gas': 100000,  # Standard gas limit for ERC20 transfers
            'gasPrice': self.w3.to_wei(gas_price_gwei or 50, 'gwei'),
            'chainId': self.w3.eth.chain_id
        })
        
        # Sign the transaction
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key)
        
        # Send the transaction
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        return self.w3.to_hex(tx_hash)

    def create_gnosis_safe(
        self, 
        owners: List[str], 
        threshold: int,
        deployer_private_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a Gnosis Safe multi-signature wallet
        
        Note: This is a simplified version - in production, you would use the 
        Gnosis Safe API or SDK for more reliable deployment
        """
        # This would typically use the Gnosis Safe Factory contract
        # Here we're providing a mock implementation
        
        # In a real implementation, you would:
        # 1. Deploy or use existing Gnosis Safe Factory
        # 2. Call createProxyWithNonce method
        # 3. Store Safe address and configuration
        
        # For now just return a mock result
        return {
            "safe_address": "0x0000000000000000000000000000000000000000",  # Placeholder
            "owners": owners,
            "threshold": threshold,
            "chain": self.chain,
            "deployment_transaction": "0x0000000000000000000000000000000000000000000000000000000000000000"  # Placeholder
        }

    def record_wallet_in_db(
        self, 
        db: Session, 
        address: str, 
        wallet_type: str,
        name: str,
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
        safe_address: Optional[str] = None,
        safe_owners: Optional[List[str]] = None,
        safe_threshold: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> BlockchainWallet:
        """Record a blockchain wallet in the database"""
        wallet = BlockchainWallet(
            address=address,
            chain=self.chain,
            wallet_type=wallet_type,
            name=name,
            user_id=user_id,
            team_id=team_id,
            safe_address=safe_address,
            safe_owners=safe_owners,
            safe_threshold=safe_threshold,
            metadata=metadata
        )
        
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        return wallet
    
    def record_transaction_in_db(
        self,
        db: Session,
        txn_hash: str,
        from_address: str,
        to_address: str,
        value: str,
        wallet_id: int,
        function_name: Optional[str] = None,
        function_args: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> BlockchainTransaction:
        """Record a blockchain transaction in the database"""
        transaction = BlockchainTransaction(
            txn_hash=txn_hash,
            chain=self.chain,
            from_address=from_address,
            to_address=to_address,
            value=value,
            wallet_id=wallet_id,
            function_name=function_name,
            function_args=function_args,
            metadata=metadata
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction 