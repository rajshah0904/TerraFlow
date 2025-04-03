from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.signature import SignatureVerifier
from fastapi import APIRouter, Request, Response, Depends, HTTPException, BackgroundTasks
from app.config import config
from typing import Dict, Any, List, Optional
from app.models import AIConversation, AIMessage, AIAction, User
from app.ai.agent import PaymentAgent, DataAgent
from app.ai.tools import get_payment_tools
from app.database import get_db
from sqlalchemy.orm import Session
import json
import time
import logging
import re

logger = logging.getLogger(__name__)

# Initialize Slack client with bot token
slack_client = WebClient(token=config.messaging.slack_bot_token)
signature_verifier = SignatureVerifier(config.messaging.slack_signing_secret)

router = APIRouter()

class SlackHandler:
    """Handler for Slack interactions with TerraFlow."""
    
    def __init__(self, db: Session):
        self.db = db
        self.payment_agent = PaymentAgent(model="gpt-4")
        self.data_agent = DataAgent(model="gpt-4")
        
    async def process_message(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Process a Slack message and generate a response."""
        try:
            # Extract message information
            user_id = event.get("user", "")
            channel_id = event.get("channel", "")
            text = event.get("text", "").strip()
            thread_ts = event.get("thread_ts", event.get("ts", ""))
            
            # Look up the user in our system
            user = self.db.query(User).filter(User.username == user_id).first()
            
            # If user not found, create a placeholder to track the conversation
            if not user:
                logger.warning(f"Slack user {user_id} not found in database.")
            
            # Check for conversation context in thread
            conversation = self.db.query(AIConversation).filter(
                AIConversation.channel == "slack",
                AIConversation.metadata["thread_ts"].astext == thread_ts
            ).first()
            
            # If no conversation found, create a new one
            if not conversation:
                conversation = AIConversation(
                    agent_id=1,  # Default to payment agent
                    user_id=user.id if user else None,
                    channel="slack",
                    metadata={
                        "thread_ts": thread_ts,
                        "channel_id": channel_id,
                        "slack_user_id": user_id
                    }
                )
                self.db.add(conversation)
                self.db.commit()
            
            # Record the user's message
            user_message = AIMessage(
                conversation_id=conversation.id,
                role="user",
                content=text
            )
            self.db.add(user_message)
            self.db.commit()
            
            # Determine intent (payment, data, help, etc.)
            intent = self._determine_intent(text)
            
            # Process based on intent
            if intent == "payment":
                # Process as payment request
                payment_tools = get_payment_tools(self.db)
                result = self.payment_agent.process_payment_request(text, payment_tools, self.db)
                
                # Record the action
                action = AIAction(
                    agent_id=1,  # Payment agent
                    conversation_id=conversation.id,
                    action_type="payment",
                    input_data={"query": text},
                    output_data=result,
                    status="completed" if result.get("success", False) else "failed"
                )
                self.db.add(action)
                
                # Generate response message
                response_text = self._format_payment_response(result)
                
            elif intent == "data":
                # Process as data request
                result = self.data_agent.process_data_request(
                    text, 
                    "query" if "show" in text.lower() or "get" in text.lower() else "pipeline",
                    self.db
                )
                
                # Record the action
                action = AIAction(
                    agent_id=2,  # Data agent
                    conversation_id=conversation.id,
                    action_type="data_query" if "query" in result else "data_pipeline",
                    input_data={"query": text},
                    output_data=result,
                    status="completed" if "error" not in result else "failed"
                )
                self.db.add(action)
                
                # Generate response message
                response_text = self._format_data_response(result)
                
            else:
                # General help/conversation
                response_text = """I'm TerraFlow, your payment and financial assistant. I can help you with:

1. **Payments**: "Pay 500 USDC to @john for design work"
2. **Balance Checks**: "What's the balance of the Marketing wallet?"
3. **Transaction Status**: "Check status of payment to @sarah"
4. **Data Reports**: "Show me all transactions over 1000 USDC in May"

How can I assist you today?"""
            
            # Record assistant response
            assistant_message = AIMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=response_text
            )
            self.db.add(assistant_message)
            self.db.commit()
            
            # Send response to Slack
            slack_client.chat_postMessage(
                channel=channel_id,
                text=response_text,
                thread_ts=thread_ts
            )
            
            return {"success": True, "message": "Message processed successfully"}
            
        except Exception as e:
            logger.error(f"Error processing Slack message: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _determine_intent(self, text: str) -> str:
        """Determine the intent of a message using simple pattern matching."""
        text_lower = text.lower()
        
        # Payment intent patterns
        payment_patterns = [
            r"pay\s+(\d+)",
            r"send\s+(\d+)",
            r"transfer\s+(\d+)",
            r"payment\s+of\s+(\d+)",
            r"usdc|usdt|dai|eurc",
            r"wallet",
            r"balance"
        ]
        
        # Data intent patterns
        data_patterns = [
            r"show\s+me",
            r"report",
            r"query",
            r"data",
            r"analytics",
            r"transactions\s+(\w+)",
            r"create\s+pipeline",
            r"build\s+report"
        ]
        
        # Check for payment intent
        for pattern in payment_patterns:
            if re.search(pattern, text_lower):
                return "payment"
        
        # Check for data intent
        for pattern in data_patterns:
            if re.search(pattern, text_lower):
                return "data"
        
        # Default to general/help
        return "general"
    
    def _format_payment_response(self, result: Dict[str, Any]) -> str:
        """Format a payment result for Slack message display."""
        if "error" in result:
            return f"❌ Error: {result['error']}"
        
        if not result.get("success", False):
            return f"❌ Payment failed: {result.get('message', 'Unknown error')}"
        
        # Successful payment
        payment_details = result.get("details", {})
        return f"""✅ *Payment processed successfully*

*Amount*: {payment_details.get('amount')} {payment_details.get('token')}
*To*: {payment_details.get('recipient')}
*Purpose*: {payment_details.get('purpose', 'Not specified')}
*From*: {payment_details.get('source_wallet', 'Default wallet')}
*Network*: {payment_details.get('network', 'Ethereum')}

{result.get('message', '')}"""
    
    def _format_data_response(self, result: Dict[str, Any]) -> str:
        """Format a data result for Slack message display."""
        if "error" in result:
            return f"❌ Error: {result['error']}"
        
        if "generated_sql" in result:
            # SQL query result
            return f"""✅ *Query generated successfully*

Your query: "{result.get('natural_language_query')}"

```sql
{result.get('generated_sql')}
```

To execute this query, use the `/run-query` command."""
        
        elif "generated_code" in result:
            # Pipeline code
            code_preview = result.get('generated_code', '')
            if len(code_preview) > 500:
                code_preview = code_preview[:500] + "\n... (truncated)"
            
            return f"""✅ *Data pipeline created successfully*

Description: "{result.get('natural_language_definition')}"

*Pipeline code preview:*
```python
{code_preview}
```

The complete pipeline has been saved. Use `/run-pipeline {result.get('pipeline_id', 'new')}` to execute it."""
        
        # Default response
        return "✅ Data request processed successfully."

@router.post("/slack/events")
async def slack_events(
    request: Request, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle Slack events (messages, commands, etc.)"""
    # Verify the request signature
    if config.messaging.slack_signing_secret:
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")
        
        # Reject requests older than 5 minutes to prevent replay attacks
        if abs(time.time() - int(timestamp)) > 300:
            raise HTTPException(status_code=400, detail="Request timestamp too old")
        
        # Get the raw request body
        body = await request.body()
        
        if not signature_verifier.is_valid(body=body, timestamp=timestamp, signature=signature):
            raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Parse the request
    payload = await request.json()
    
    # Handle URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}
    
    # Handle events
    if payload.get("type") == "event_callback":
        event = payload.get("event", {})
        event_type = event.get("type")
        
        # Only process messages sent from users (not bot messages)
        if event_type == "message" and not event.get("bot_id"):
            handler = SlackHandler(db)
            # Process message in the background
            background_tasks.add_task(handler.process_message, event)
        
    return Response(status_code=200)

@router.post("/slack/commands")
async def slack_commands(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle Slack slash commands."""
    # Verify the request signature
    if config.messaging.slack_signing_secret:
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")
        
        # Reject requests older than 5 minutes to prevent replay attacks
        if abs(time.time() - int(timestamp)) > 300:
            raise HTTPException(status_code=400, detail="Request timestamp too old")
        
        # Get the raw request body
        body = await request.body()
        
        if not signature_verifier.is_valid(body=body, timestamp=timestamp, signature=signature):
            raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Parse the request form data
    form_data = await request.form()
    command = form_data.get("command", "")
    text = form_data.get("text", "")
    user_id = form_data.get("user_id", "")
    channel_id = form_data.get("channel_id", "")
    
    # Handle different commands
    if command == "/tf-pay":
        # Payment command
        handler = SlackHandler(db)
        # Format the message to be processed as a payment
        event = {
            "user": user_id,
            "channel": channel_id,
            "text": f"Pay {text}",
            "ts": str(time.time())
        }
        # Process in background
        background_tasks.add_task(handler.process_message, event)
        return {"text": "Processing payment request..."}
    
    elif command == "/tf-report":
        # Data report command
        handler = SlackHandler(db)
        # Format the message to be processed as a data request
        event = {
            "user": user_id,
            "channel": channel_id,
            "text": f"Show me {text}",
            "ts": str(time.time())
        }
        # Process in background
        background_tasks.add_task(handler.process_message, event)
        return {"text": "Generating report..."}
    
    elif command == "/tf-help":
        # Help command
        return {
            "text": """*TerraFlow Commands*:

/tf-pay [payment details] - Make a payment (e.g., `/tf-pay 500 USDC to @john for design work`)
/tf-report [query] - Generate a report (e.g., `/tf-report transactions over 1000 USDC in May`)
/tf-help - Show this help message

You can also just chat with TerraFlow by mentioning @TerraFlow in a message."""
        }
    
    # Unknown command
    return {"text": f"Unknown command: {command}"}

def register_slack_routes(app):
    """Register Slack routes with a FastAPI application."""
    app.include_router(router, prefix="/api/messaging", tags=["messaging"]) 