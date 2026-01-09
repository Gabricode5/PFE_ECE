from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base # On suppose que Base est défini dans database.py

class User(Base):
    __tablename__ = "utilisateur"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    prenom = Column(String(50))
    nom = Column(String(50))
    role = Column(String(20), server_default="user")
    date_creation = Column(DateTime(timezone=True), server_default=func.now())