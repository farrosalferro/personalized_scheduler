from sqlalchemy.orm import Session
from models import Task, User
from datetime import datetime

def get_tasks(db: Session, user_id: int = None):
    """Get tasks, optionally filtered by user_id"""
    if user_id:
        return db.query(Task).filter(Task.user_id == user_id).all()
    return db.query(Task).all()

def create_task(db: Session, task_data, user_id: int = None):
    # Make sure task_data is properly formatted
    if isinstance(task_data, dict) and 'deadline' in task_data:
        # Convert deadline string to datetime if needed
        if isinstance(task_data['deadline'], str):
            from datetime import datetime
            try:
                task_data['deadline'] = datetime.fromisoformat(task_data['deadline'].replace('Z', '+00:00'))
            except ValueError:
                # Handle potential parsing errors
                pass
                
        # Set user_id if provided
        if user_id:
            task_data['user_id'] = user_id
    
    new_task = Task(**task_data)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

def delete_task(db: Session, task_id: int, user_id: int = None):
    query = db.query(Task).filter(Task.id == task_id)
    
    # If user_id is provided, ensure the task belongs to the user
    if user_id:
        query = query.filter(Task.user_id == user_id)
        
    task = query.first()
    if task:
        db.delete(task)
        db.commit()
    return task

def update_task(db: Session, task_id: int, task_data: dict, user_id: int = None):
    """Update an existing task in the database"""
    query = db.query(Task).filter(Task.id == task_id)
    
    # If user_id is provided, ensure the task belongs to the user
    if user_id:
        query = query.filter(Task.user_id == user_id)
        
    task = query.first()
    
    if not task:
        return None
        
    # Update task fields
    if "title" in task_data:
        task.title = task_data["title"]
    if "description" in task_data:
        task.description = task_data["description"]
    if "priority" in task_data:
        task.priority = task_data["priority"]
    if "deadline" in task_data:
        # Parse the deadline string to a datetime object
        if isinstance(task_data["deadline"], str):
            task.deadline = datetime.fromisoformat(task_data["deadline"].replace('Z', '+00:00'))
        else:
            task.deadline = task_data["deadline"]
    if "duration" in task_data:
        task.duration = task_data["duration"]
    if "is_due_date" in task_data:
        task.is_due_date = task_data["is_due_date"]
    if "user_id" in task_data:
        task.user_id = task_data["user_id"]
    
    db.commit()
    db.refresh(task)
    
    return task

# User functions could be added here or kept in auth.py
