from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base 

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

class ChatSession(Base):
    __tablename__ = "chat_session"

    id = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateur.id"), nullable=False)
    title = Column(String(255), nullable=False)
    date_creation = Column(DateTime(timezone=True), server_default=func.now())

class Message(Base):
    __tablename__ = "chat_message"

    id = Column(Integer, primary_key=True, index=True)
    id_chat_session = Column(Integer, ForeignKey("chat_session.id"), nullable=False)
    role = Column(String(20), CheckConstraint("role IN ('user', 'assistant', 'system')"), nullable=False)
    content = Column(Text, nullable=False)
    date_creation = Column(DateTime(timezone=True), server_default=func.now())