from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AIAgent, AIConversation, AIMessage, AIAction, User
from app.ai.agent import PaymentAgent, DataAgent
from app.ai.tools import get_payment_tools
from app.dependencies.auth import get_current_user
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json

router = APIRouter()

class NLProcessRequest(BaseModel):
    """Request model for natural language processing."""
    query: str
    agent_type: str  # "payment" or "data"
    data_request_type: Optional[str] = None  # For data agent: "query" or "pipeline"

class NLProcessResponse(BaseModel):
    """Response model for natural language processing."""
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    conversation_id: Optional[int] = None

@router.post("/process", response_model=NLProcessResponse)
async def process_nl_request(
    request: NLProcessRequest,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Process a natural language request using the appropriate agent."""
    # Verify the user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create or get agent
    agent_type = request.agent_type.lower()
    agent = db.query(AIAgent).filter(AIAgent.agent_type == agent_type).first()
    
    if not agent:
        # Create a new agent if one doesn't exist
        agent = AIAgent(
            name=f"{agent_type.capitalize()} Agent",
            description=f"Agent for handling {agent_type} requests",
            agent_type=agent_type,
            model="gpt-4",
            is_active=True
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
    
    # Create a new conversation
    conversation = AIConversation(
        agent_id=agent.id,
        user_id=user.id,
        channel="api",
        metadata={"client_ip": "127.0.0.1"}  # You might want to get this from the request
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    # Record the user's message
    user_message = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.query
    )
    db.add(user_message)
    db.commit()
    
    # Process the request using the appropriate agent
    try:
        result = None
        if agent_type == "payment":
            # Payment request processing
            payment_agent = PaymentAgent(model="gpt-4")
            payment_tools = get_payment_tools(db)
            result = payment_agent.process_payment_request(request.query, payment_tools, db)
            
            # Record the action
            action = AIAction(
                agent_id=agent.id,
                conversation_id=conversation.id,
                action_type="payment",
                input_data={"query": request.query},
                output_data=result,
                status="completed" if result.get("success", False) else "failed"
            )
            db.add(action)
            
        elif agent_type == "data":
            # Data request processing
            data_agent = DataAgent(model="gpt-4")
            # Default to "query" if not specified
            request_type = request.data_request_type or "query"
            result = data_agent.process_data_request(request.query, request_type, db)
            
            # Record the action
            action = AIAction(
                agent_id=agent.id,
                conversation_id=conversation.id,
                action_type=f"data_{request_type}",
                input_data={"query": request.query, "type": request_type},
                output_data=result,
                status="completed" if "error" not in result else "failed"
            )
            db.add(action)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported agent type: {agent_type}")
        
        # Add the assistant's response
        response_content = json.dumps(result) if result else "No response generated"
        assistant_message = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=response_content
        )
        db.add(assistant_message)
        db.commit()
        
        # Return the response
        return {
            "success": True if result and "error" not in result else False,
            "message": "Request processed successfully" if result and "error" not in result else "Error processing request",
            "details": result,
            "conversation_id": conversation.id
        }
        
    except Exception as e:
        # Record the error
        error_action = AIAction(
            agent_id=agent.id,
            conversation_id=conversation.id,
            action_type=f"{agent_type}_request",
            input_data={"query": request.query},
            output_data={"error": str(e)},
            status="failed",
            error_message=str(e)
        )
        db.add(error_action)
        db.commit()
        
        # Return error response
        return {
            "success": False,
            "message": f"Error processing request: {str(e)}",
            "conversation_id": conversation.id
        }

@router.get("/conversations", response_model=List[Dict[str, Any]])
async def get_user_conversations(
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Get all conversations for the current user."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all conversations for this user
    conversations = db.query(AIConversation).filter(AIConversation.user_id == user.id).all()
    
    result = []
    for conv in conversations:
        # Get the agent
        agent = db.query(AIAgent).filter(AIAgent.id == conv.agent_id).first()
        
        # Get the first user message as a summary
        first_message = db.query(AIMessage).filter(
            AIMessage.conversation_id == conv.id,
            AIMessage.role == "user"
        ).order_by(AIMessage.timestamp.asc()).first()
        
        result.append({
            "id": conv.id,
            "agent_type": agent.agent_type if agent else "unknown",
            "started_at": conv.started_at.isoformat(),
            "last_message_at": conv.last_message_at.isoformat(),
            "summary": first_message.content[:100] + "..." if first_message and len(first_message.content) > 100 else first_message.content if first_message else "No messages"
        })
    
    return result

@router.get("/conversations/{conversation_id}", response_model=Dict[str, Any])
async def get_conversation_details(
    conversation_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user)
):
    """Get details of a specific conversation."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the conversation
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get the agent
    agent = db.query(AIAgent).filter(AIAgent.id == conversation.agent_id).first()
    
    # Get all messages
    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation_id
    ).order_by(AIMessage.timestamp.asc()).all()
    
    # Get all actions
    actions = db.query(AIAction).filter(
        AIAction.conversation_id == conversation_id
    ).order_by(AIAction.started_at.asc()).all()
    
    return {
        "id": conversation.id,
        "agent_type": agent.agent_type if agent else "unknown",
        "agent_model": agent.model if agent else "unknown",
        "started_at": conversation.started_at.isoformat(),
        "last_message_at": conversation.last_message_at.isoformat(),
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat()
            } for msg in messages
        ],
        "actions": [
            {
                "id": act.id,
                "type": act.action_type,
                "status": act.status,
                "started_at": act.started_at.isoformat(),
                "completed_at": act.completed_at.isoformat() if act.completed_at else None,
                "error": act.error_message
            } for act in actions
        ]
    } 