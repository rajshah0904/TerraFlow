from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def read_trades():
    return {"message": "Trade endpoint working"}
