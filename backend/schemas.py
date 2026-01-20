#C'est la structure des données qui circulent (la validation Pydantic).

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# Modèle pour la création (ce que le Front envoie)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    prenom: Optional[str] = None
    nom: Optional[str] = None
    id_role: int

    class Config:
        from_attributes = True

# Modèle pour la réponse (ce que l'API renvoie, sans le mot de passe !)
class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    prenom: Optional[str]
    nom: Optional[str]
    role: str

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str