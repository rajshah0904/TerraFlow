from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.config import AppConfig

# Get configuration
config = AppConfig()
SECRET_KEY = config.auth.secret_key
ALGORITHM = config.auth.algorithm

# Fix the OAuth2 scheme to use the correct token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/user/login/')

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
    
