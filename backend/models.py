from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False)
    
    # Define relationship to tasks
    tasks = relationship("Task", back_populates="user")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    priority = Column(String, default="Normal")
    deadline = Column(DateTime, nullable=False)
    duration = Column(Integer, default=60)  # Duration in minutes
    is_due_date = Column(Boolean, default=False)
    # Add user_id foreign key
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Create relationship to user
    user = relationship("User", back_populates="tasks")
