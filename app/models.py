from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text, JSON, Table
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
from typing import Dict, List, Any

# Association table for team members
team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    wallet_address = Column(String)  # Added wallet_address field for registration data
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="user")  # admin, user, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    trades_sent = relationship("Trade", back_populates="sender", foreign_keys="Trade.sender_id")
    trades_received = relationship("Trade", back_populates="recipient", foreign_keys="Trade.recipient_id")
    wallet = relationship("Wallet", back_populates="owner", uselist=False)
    transactions_sent = relationship("Transaction", back_populates="sender", foreign_keys="Transaction.sender_id")
    transactions_received = relationship("Transaction", back_populates="recipient", foreign_keys="Transaction.recipient_id")
    blockchain_wallets = relationship("BlockchainWallet", back_populates="owner")
    teams = relationship("Team", secondary=team_members, back_populates="members")
    data_queries = relationship("DataQuery", back_populates="created_by")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    members = relationship("User", secondary=team_members, back_populates="teams")
    team_wallets = relationship("BlockchainWallet", back_populates="team")

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    stablecoin_amount = Column(Float, nullable=False)
    fiat_amount = Column(Float, nullable=False)
    conversion_rate = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")

    sender = relationship("User", back_populates="trades_sent", foreign_keys=[sender_id])
    recipient = relationship("User", back_populates="trades_received", foreign_keys=[recipient_id])

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    fiat_balance = Column(Float, default=0.0)
    stablecoin_balance = Column(Float, default=0.0)
    
    # Primary currency of the wallet (user's local currency)
    base_currency = Column(String, default="USD")
    
    # User's preferred display currency (can differ from base)
    display_currency = Column(String, default="USD")
    
    # Country code to help with regulatory compliance
    country_code = Column(String, nullable=True)
    
    # Wallet address for blockchain transactions if enabled
    blockchain_address = Column(String, nullable=True)
    
    # JSON field to store additional currency information
    currency_settings = Column(JSON, nullable=True)

    owner = relationship("User", back_populates="wallet")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    stablecoin_amount = Column(Float, nullable=False)
    source_amount = Column(Float, nullable=False)
    source_currency = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    target_currency = Column(String, nullable=False)
    source_to_stablecoin_rate = Column(Float, nullable=False)
    stablecoin_to_target_rate = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")
    blockchain_txn_hash = Column(String, nullable=True)  # For on-chain transactions
    
    sender = relationship("User", back_populates="transactions_sent", foreign_keys=[sender_id])
    recipient = relationship("User", back_populates="transactions_received", foreign_keys=[recipient_id])

class BlockchainWallet(Base):
    __tablename__ = "blockchain_wallets"
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String, nullable=False, index=True)
    chain = Column(String, nullable=False)  # ethereum, polygon, avalanche, etc.
    wallet_type = Column(String, nullable=False)  # eoa, gnosis_safe, etc.
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    safe_address = Column(String, nullable=True)  # For multisig wallets
    safe_owners = Column(JSON, nullable=True)  # List of owner addresses
    safe_threshold = Column(Integer, nullable=True)  # Signatures required
    meta_data = Column(JSON, nullable=True)  # Additional wallet info
    
    owner = relationship("User", back_populates="blockchain_wallets")
    team = relationship("Team", back_populates="team_wallets")
    blockchain_transactions = relationship("BlockchainTransaction", back_populates="wallet")

class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"
    id = Column(Integer, primary_key=True, index=True)
    txn_hash = Column(String, nullable=False, index=True)
    chain = Column(String, nullable=False)
    from_address = Column(String, nullable=False)
    to_address = Column(String, nullable=False)
    value = Column(String, nullable=False)  # Amount in wei/smallest unit
    gas_price = Column(String, nullable=True)
    gas_used = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, confirmed, failed
    block_number = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    function_name = Column(String, nullable=True)
    function_args = Column(JSON, nullable=True)
    wallet_id = Column(Integer, ForeignKey("blockchain_wallets.id"))
    meta_data = Column(JSON, nullable=True)  # Additional transaction info
    
    wallet = relationship("BlockchainWallet", back_populates="blockchain_transactions")

class AIAgent(Base):
    __tablename__ = "ai_agents"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    agent_type = Column(String, nullable=False)  # finance, data, payment, etc.
    model = Column(String, nullable=False)  # gpt-4, claude-3, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    configuration = Column(JSON, nullable=True)  # Agent configuration
    
    agent_conversations = relationship("AIConversation", back_populates="agent")
    agent_actions = relationship("AIAction", back_populates="agent")

class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("ai_agents.id"))
    user_id = Column(Integer, nullable=True)  # Allow anonymous conversations
    started_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    channel = Column(String, nullable=False)  # slack, web, api, etc.
    meta_data = Column(JSON, nullable=True)  # Additional conversation info
    
    agent = relationship("AIAgent", back_populates="agent_conversations")
    messages = relationship("AIMessage", back_populates="conversation")

class AIMessage(Base):
    __tablename__ = "ai_messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id"))
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("AIConversation", back_populates="messages")
    
class AIAction(Base):
    __tablename__ = "ai_actions"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("ai_agents.id"))
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id"), nullable=True)
    action_type = Column(String, nullable=False)  # payment, query, analysis, etc.
    status = Column(String, default="pending")  # pending, completed, failed
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    agent = relationship("AIAgent", back_populates="agent_actions")

class DataQuery(Base):
    __tablename__ = "data_queries"
    id = Column(Integer, primary_key=True, index=True)
    natural_language_query = Column(Text, nullable=False)
    generated_query = Column(Text, nullable=False)  # SQL, Pandas, etc.
    query_type = Column(String, nullable=False)  # sql, pandas, etc.
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    execution_time_ms = Column(Integer, nullable=True)
    result_summary = Column(Text, nullable=True)
    is_saved = Column(Boolean, default=False)
    
    created_by = relationship("User", back_populates="data_queries")

class DataPipeline(Base):
    __tablename__ = "data_pipelines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    natural_language_definition = Column(Text, nullable=False)
    generated_code = Column(Text, nullable=False)
    schedule = Column(String, nullable=True)  # cron expression
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    pipeline_runs = relationship("DataPipelineRun", back_populates="pipeline")

class DataPipelineRun(Base):
    __tablename__ = "data_pipeline_runs"
    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("data_pipelines.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # running, completed, failed
    log_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    pipeline = relationship("DataPipeline", back_populates="pipeline_runs")
