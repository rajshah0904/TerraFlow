from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key = True, index = True)
    username = Column(String, unique = True, index = True)
    password = Column(String)
    wallet_address = Column(String, unique = True)
    
    trades = relationship("Trade", back_populates="owner")
    
class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"))
    currency_pair = Column(String)
    amount = Column(Float)
    rate = Column(Float)
    
    owner = relationship("User", back_populates = "trades")