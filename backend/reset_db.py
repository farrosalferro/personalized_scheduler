#!/usr/bin/env python3

from sqlalchemy import text
from database import engine, Base, SessionLocal
from models import User, Task
import os

def reset_database():
    """Reset the database by dropping all tables and recreating them"""
    print("Starting database reset...")
    
    try:
        # Create a new session
        session = SessionLocal()
        
        # First clear all tasks
        print("Deleting all tasks...")
        session.query(Task).delete()
        
        # Then clear all users
        print("Deleting all users...")
        session.query(User).delete()
        
        # Commit the changes
        session.commit()
        
        print("Database reset successful!")
        
    except Exception as e:
        print(f"Error resetting database: {e}")
        session.rollback()
    finally:
        session.close()
    
    print("Database reset complete.")

if __name__ == "__main__":
    # Add a confirmation prompt
    confirm = input("This will delete ALL users and tasks in the database. Are you sure? (y/N): ")
    
    if confirm.lower() == 'y':
        reset_database()
    else:
        print("Database reset cancelled.")
