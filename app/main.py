from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import user, trade, transaction, wallet

app = FastAPI(title="TerraFlow", 
              description="A cross-currency payment system using stablecoins",
              version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Include the routers with appropriate prefixes and tags.
app.include_router(user.router, prefix="/user", tags=["user"])
app.include_router(trade.router, prefix="/trade", tags=["trade"])
app.include_router(transaction.router, prefix="/transaction", tags=["transaction"])
app.include_router(wallet.router, prefix="/wallet", tags=["wallet"])

# Temporarily commented out AI and blockchain routers
# app.include_router(ai.router, prefix="/ai", tags=["ai"])
# app.include_router(blockchain.router, prefix="/blockchain", tags=["blockchain"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to TerraFlow!",
        "description": "A cross-currency payment system using stablecoins as an intermediary",
        "endpoints": {
            "user": "/user - User management endpoints",
            "wallet": "/wallet - Wallet management endpoints",
            "transaction": "/transaction - Process cross-currency transactions",
            "trade": "/trade - Legacy trade endpoints",
            # Temporarily commented out
            # "ai": "/ai - AI agent endpoints",
            # "blockchain": "/blockchain - Blockchain wallet endpoints"
        }
    }
