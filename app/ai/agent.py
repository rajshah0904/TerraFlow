import os
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain.agents import initialize_agent, AgentType
from langchain.tools import BaseTool
from langchain.memory import ConversationBufferMemory
from typing import Dict, List, Any, Optional, Callable, Type
import json
from app.config import config

class PaymentAgent:
    """LLM agent for processing natural language payment requests"""
    
    def __init__(self, model="gpt-4"):
        """Initialize the payment agent with a specific model"""
        if model.startswith("gpt"):
            self.llm = ChatOpenAI(
                model=model,
                temperature=0.1,
                openai_api_key=config.api_keys.openai_api_key
            )
        elif model.startswith("claude"):
            self.llm = ChatAnthropic(
                model=model,
                temperature=0.1,
                anthropic_api_key=config.api_keys.anthropic_api_key
            )
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        self.model = model
        self.system_message = """
        You are TerraFlow, an AI financial assistant that helps users process payments using stablecoins.
        You can understand natural language payment instructions and convert them into structured actions.
        
        Examples of requests you can handle:
        - "Pay $2,000 USDC to Dev X on Polygon from Engineering wallet"
        - "Send 5000 EURC to marketing@example.com for the new campaign"
        - "Transfer 10,000 DAI from Treasury to Operations for project Alpha"
        
        For each request, you need to extract:
        1. Amount and token type (USDC, DAI, EURC, etc.)
        2. Recipient (address, email, or name)
        3. Purpose/memo (optional)
        4. Source wallet (if specified)
        5. Blockchain network (if specified)
        
        Once you extract this information, you can use your tools to:
        1. Resolve recipient information to get an address
        2. Check wallet balances
        3. Initiate transfers
        4. Record transactions
        
        Always be helpful, accurate, and security-focused.
        """
        
        self.memory = ConversationBufferMemory(memory_key="chat_history")
        
    def parse_payment_request(self, request_text: str) -> Dict[str, Any]:
        """Parse a natural language payment request into structured data"""
        prompt = f"""
        Extract the payment details from the following request:
        
        "{request_text}"
        
        Extract and return a JSON object with these fields:
        - amount: the numeric amount to send
        - token: the token/currency to use (USDC, DAI, EURC, etc.)
        - recipient: recipient identifier (could be name, email, or address)
        - purpose: purpose of payment (optional)
        - source_wallet: source wallet name (optional)
        - network: blockchain network (optional, default to Ethereum)
        
        If any field is unclear or missing, set it to null.
        Respond with ONLY the JSON object.
        """
        
        messages = [
            SystemMessage(content="You are a payment processing assistant that extracts structured data from natural language requests."),
            HumanMessage(content=prompt)
        ]
        
        response = self.llm(messages)
        try:
            # Extract JSON from the response text
            parsed_data = json.loads(response.content)
            return parsed_data
        except json.JSONDecodeError:
            # Fallback if JSON extraction fails
            return {
                "error": "Failed to parse payment request",
                "raw_response": response.content
            }
    
    def execute_payment(self, payment_details: Dict[str, Any], tools: List[BaseTool]) -> Dict[str, Any]:
        """Execute a payment based on parsed details using available tools"""
        # Initialize the agent with tools
        agent = initialize_agent(
            tools,
            self.llm,
            agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
            verbose=True,
            memory=self.memory
        )
        
        # Construct the prompt for the agent
        prompt = f"""
        Please execute a payment with the following details:
        
        Amount: {payment_details.get('amount')} {payment_details.get('token')}
        Recipient: {payment_details.get('recipient')}
        Purpose: {payment_details.get('purpose', 'N/A')}
        Source Wallet: {payment_details.get('source_wallet', 'Default')}
        Network: {payment_details.get('network', 'Ethereum')}
        
        Please follow these steps:
        1. Resolve the recipient to a valid blockchain address
        2. Check if the source wallet has enough balance
        3. Create and execute the transaction
        4. Provide confirmation details
        
        If any step fails, explain why and what needs to be fixed.
        """
        
        response = agent.run(input=prompt)
        return {
            "success": "error" not in response.lower(),
            "message": response,
            "details": payment_details
        }
    
    def process_payment_request(
        self, 
        request_text: str, 
        tools: List[BaseTool],
        db_session = None
    ) -> Dict[str, Any]:
        """Process a natural language payment request end-to-end"""
        # Parse the request
        payment_details = self.parse_payment_request(request_text)
        
        # If parsing failed
        if "error" in payment_details:
            return payment_details
        
        # Execute the payment
        result = self.execute_payment(payment_details, tools)
        
        # Record the interaction in the database if provided
        if db_session:
            # Logic to save to AIConversation, AIMessage, and AIAction tables
            pass
        
        return result

class DataAgent:
    """LLM agent for processing natural language data requests"""
    
    def __init__(self, model="gpt-4"):
        """Initialize the data agent with a specific model"""
        if model.startswith("gpt"):
            self.llm = ChatOpenAI(
                model=model,
                temperature=0.1,
                openai_api_key=config.api_keys.openai_api_key
            )
        elif model.startswith("claude"):
            self.llm = ChatAnthropic(
                model=model,
                temperature=0.1,
                anthropic_api_key=config.api_keys.anthropic_api_key
            )
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        self.model = model
        self.system_message = """
        You are TerraFlow, an AI data assistant that helps users create data pipelines, run queries, and generate reports.
        You can understand natural language data requests and convert them into SQL, Pandas code, or other data processing steps.
        
        Examples of requests you can handle:
        - "Create a daily report of all transactions over $1000"
        - "Build a pipeline that aggregates wallet balances by team"
        - "Show me the top 10 recipients of payments this month"
        
        For data queries, you'll translate natural language to precise SQL or Python code.
        For data pipelines, you'll generate the full pipeline code with appropriate scheduling.
        
        Always ensure your code follows best practices and is optimized for performance.
        """
        
        self.memory = ConversationBufferMemory(memory_key="chat_history")
    
    def generate_sql_query(self, query_text: str) -> Dict[str, Any]:
        """Generate SQL from a natural language query"""
        prompt = f"""
        Convert the following natural language query into SQL:
        
        "{query_text}"
        
        Assume these tables exist with their respective columns:
        - users (id, username, email, wallet_address, role, created_at, is_active)
        - wallets (id, user_id, fiat_balance, stablecoin_balance, currency)
        - transactions (id, sender_id, recipient_id, stablecoin_amount, source_amount, source_currency, target_amount, target_currency, source_to_stablecoin_rate, stablecoin_to_target_rate, timestamp, status, blockchain_txn_hash)
        - blockchain_wallets (id, address, chain, wallet_type, name, user_id, team_id, is_active, created_at, safe_address)
        - blockchain_transactions (id, txn_hash, chain, from_address, to_address, value, status, timestamp)
        - teams (id, name, description, created_at, owner_id)
        
        Respond with ONLY the SQL query, no explanations.
        """
        
        messages = [
            SystemMessage(content="You are a SQL expert that converts natural language to precise SQL queries."),
            HumanMessage(content=prompt)
        ]
        
        response = self.llm(messages)
        
        # Extract the SQL query 
        sql_query = response.content.strip()
        
        return {
            "natural_language_query": query_text,
            "generated_sql": sql_query,
            "query_type": "sql"
        }
    
    def generate_data_pipeline(self, pipeline_description: str) -> Dict[str, Any]:
        """Generate a data pipeline from a natural language description"""
        prompt = f"""
        Create a Python data pipeline based on this description:
        
        "{pipeline_description}"
        
        Your code should:
        1. Use Pandas for data manipulation
        2. Include proper error handling
        3. Support scheduling (with comments about frequency)
        4. Connect to the PostgreSQL database
        5. Include logging
        
        Assume you have access to these database tables:
        - users, wallets, transactions, blockchain_wallets, blockchain_transactions, teams
        
        Return a complete, runnable Python script with all necessary imports and configuration.
        The code should be production-ready and well-commented.
        """
        
        messages = [
            SystemMessage(content="You are a data engineering expert that creates robust data pipelines."),
            HumanMessage(content=prompt)
        ]
        
        response = self.llm(messages)
        
        return {
            "natural_language_definition": pipeline_description,
            "generated_code": response.content,
            "pipeline_type": "python",
            "schedule": "daily"  # Default, would be parsed from response in production
        }
    
    def process_data_request(
        self, 
        request_text: str,
        request_type: str,  # "query" or "pipeline"
        db_session = None
    ) -> Dict[str, Any]:
        """Process a natural language data request"""
        if request_type == "query":
            result = self.generate_sql_query(request_text)
            
            # Record in database if provided
            if db_session:
                # Save to DataQuery table
                pass
                
        elif request_type == "pipeline":
            result = self.generate_data_pipeline(request_text)
            
            # Record in database if provided
            if db_session:
                # Save to DataPipeline table
                pass
        else:
            result = {"error": f"Unsupported request_type: {request_type}"}
        
        return result 