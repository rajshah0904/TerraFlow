from app.database import engine, Base
from app.models import User, Trade

Base.metadata.create_all(bind=engine)
print("Database tables created successfully!")