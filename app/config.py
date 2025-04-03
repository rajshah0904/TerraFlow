import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Dict, List, Optional

# Load environment variables
load_dotenv()

class DatabaseConfig(BaseModel):
    url: str = os.getenv("DATABASE_URL", "postgresql://raj:Rajshah11@localhost:5432/terraflow")

class AuthConfig(BaseModel):
    secret_key: str = os.getenv("SECRET_KEY", "your_secret_key_here")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

class APIKeysConfig(BaseModel):
    exchange_rate_api_key: Optional[str] = os.getenv("EXCHANGE_RATE_API_KEY")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")

class BlockchainConfig(BaseModel):
    eth_rpc_url: str = os.getenv("ETH_RPC_URL", "https://mainnet.infura.io/v3/your_infura_key")
    polygon_rpc_url: str = os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com")
    avalanche_rpc_url: str = os.getenv("AVALANCHE_RPC_URL", "https://api.avax.network/ext/bc/C/rpc")
    gnosis_safe_transaction_service: str = os.getenv("GNOSIS_SAFE_TRANSACTION_SERVICE", "https://safe-transaction.gnosis.io")
    deployer_private_key: Optional[str] = os.getenv("DEPLOYER_PRIVATE_KEY")
    admin_wallet_address: Optional[str] = os.getenv("ADMIN_WALLET_ADDRESS")

class MessagingConfig(BaseModel):
    slack_bot_token: Optional[str] = os.getenv("SLACK_BOT_TOKEN")
    slack_signing_secret: Optional[str] = os.getenv("SLACK_SIGNING_SECRET")
    twilio_account_sid: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")

class DataStorageConfig(BaseModel):
    vector_db_path: str = os.getenv("VECTOR_DB_PATH", "./vector_db")
    data_storage_path: str = os.getenv("DATA_STORAGE_PATH", "./data_storage")

class AppConfig(BaseModel):
    database: DatabaseConfig = DatabaseConfig()
    auth: AuthConfig = AuthConfig()
    api_keys: APIKeysConfig = APIKeysConfig()
    blockchain: BlockchainConfig = BlockchainConfig()
    messaging: MessagingConfig = MessagingConfig()
    data_storage: DataStorageConfig = DataStorageConfig()
    debug: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    environment: str = os.getenv("ENVIRONMENT", "development")

# Create a global config instance
config = AppConfig()

def get_config() -> AppConfig:
    """Returns the application configuration."""
    return config 