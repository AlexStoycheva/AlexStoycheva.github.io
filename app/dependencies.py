from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import User

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user():
    # TODO: Implement proper authentication
    # For now, return a dummy user or raise exception
    return None