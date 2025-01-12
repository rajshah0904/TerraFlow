from fastapi import FastAPI
from app.routers import user, trade

app = FastAPI()

# Include the routers
app.include_router(user.router, prefix="/user", tags=["user"])
app.include_router(trade.router, prefix="/trade", tags=["trade"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the platform!"}
