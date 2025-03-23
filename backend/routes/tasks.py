from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from crud import get_tasks, create_task, delete_task, update_task
from services.task_ai import suggest_task, chat_with_ai
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from fastapi.responses import JSONResponse

router = APIRouter()

# Define a Pydantic model for task validation
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "Normal"
    deadline: datetime
    duration: Optional[int] = 60
    is_due_date: Optional[bool] = False
    user_id: Optional[int] = None

    class Config:
        # Allow extra fields
        extra = "allow"

# Define a model for chat messages with user_id
class ChatMessage(BaseModel):
    message: str
    user_id: Optional[int] = None

# Existing CRUD routes - updated to support user_id
@router.get("/tasks")
def fetch_tasks(db: Session = Depends(get_db), user_id: Optional[int] = None):
    # In a real app, user_id would come from auth token
    return get_tasks(db, user_id)

@router.post("/tasks")
async def add_task(request: Request, db: Session = Depends(get_db), user_id: Optional[int] = None):
    try:
        # Get raw JSON data
        task_data = await request.json()
        print(f"Received task data: {task_data}")
        
        # Process the task data
        result = create_task(db, task_data, user_id)
        return result
    except Exception as e:
        print(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@router.delete("/tasks/{task_id}")
def remove_task(task_id: int, db: Session = Depends(get_db), user_id: Optional[int] = None):
    task = delete_task(db, task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    return {"message": f"Task {task_id} deleted successfully"}

@router.put("/tasks/{task_id}")
async def update_task_endpoint(task_id: int, request: Request, db: Session = Depends(get_db), user_id: Optional[int] = None):
    try:
        # Get raw JSON data
        task_data = await request.json()
        print(f"Received updated task data: {task_data}")
        
        # Process the task data
        result = update_task(db, task_id, task_data, user_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
        return result
    except Exception as e:
        print(f"Error updating task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

# AI Task Suggestion Route
@router.get("/suggest-task")
def get_ai_task_suggestion():
    return {"suggested_task": suggest_task()}

# Chat Endpoint
@router.post("/chat")
async def chat(chat_message: ChatMessage):
    try:
        # Pass user_id to filter tasks by the current user
        response = chat_with_ai(chat_message.message, chat_message.user_id)
        return {"response": response}
    except Exception as e:
        print(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
