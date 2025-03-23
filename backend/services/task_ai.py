from datetime import datetime, timedelta
import re
from langchain_openai import ChatOpenAI
import os
import json
from dotenv import load_dotenv
from database import SessionLocal
from models import Task
from sqlalchemy import or_, and_, func

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI LLM
openai_api_key = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=openai_api_key
)

def get_schedule_gaps(user_id=None):
    """Get schedule gaps, optionally filtered by user_id"""
    db = SessionLocal()
    
    # Filter tasks by user_id if provided
    if user_id:
        tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.deadline).all()
    else:
        tasks = db.query(Task).order_by(Task.deadline).all()
        
    db.close()

    now = datetime.now()
    available_slots = []

    # Check for gaps in tasks
    last_task_end = now
    for task in tasks:
        task_start = task.deadline - timedelta(hours=2)  # Assume 2h per task
        if task_start > last_task_end:
            available_slots.append({"start": last_task_end, "end": task_start})
        last_task_end = task.deadline

    return available_slots

def get_task_summary(user_id=None):
    """Get a summary of tasks for context, optionally filtered by user_id"""
    db = SessionLocal()
    
    # Filter tasks by user_id if provided
    if user_id:
        tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.deadline).all()
    else:
        tasks = db.query(Task).order_by(Task.deadline).all()
        
    db.close()
    
    if not tasks:
        return "You currently have no tasks scheduled."
    
    summary = "Here are your current tasks:\n"
    for task in tasks:
        deadline = task.deadline.strftime("%Y-%m-%d %H:%M")
        summary += f"- {task.title} (Priority: {task.priority}, Deadline: {deadline})\n"
    
    return summary

def suggest_task(user_id=None):
    """Suggest task based on schedule gaps, filtered by user_id"""
    gaps = get_schedule_gaps(user_id)
    if not gaps:
        return "No free slots available."

    # Take the first available gap
    gap = gaps[0]
    
    prompt = f"You have free time from {gap['start'].strftime('%H:%M')} to {gap['end'].strftime('%H:%M')}. Suggest a productive task based on deadlines and priorities."

    ai_message = [
        ("system", "You are a helpful assistant that suggests tasks based on deadlines and priorities."),
        ("user", prompt)
    ]

    response = llm.invoke(ai_message)
    return response.content

def extract_task_from_message(message):
    """
    Extract task details from a natural language message using the LLM
    Returns a task object or None if no task was detected
    """
    # Get current date and time for context
    current_date = datetime.now()
    current_date_str = current_date.strftime("%Y-%m-%d")
    current_time_str = current_date.strftime("%H:%M")
    
    # Calculate tomorrow and next week for explicit reference
    tomorrow = current_date + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    next_week = current_date + timedelta(days=7)
    next_week_str = next_week.strftime("%Y-%m-%d")
    
    system_prompt = f"""
    You are an AI assistant that extracts task information from user messages.
    
    CURRENT DATE INFORMATION:
    TODAY'S DATE: {current_date_str} ({current_date.strftime("%A, %B %d, %Y")})
    TOMORROW'S DATE: {tomorrow_str} ({tomorrow.strftime("%A, %B %d, %Y")})
    NEXT WEEK STARTS: {next_week_str} ({next_week.strftime("%A, %B %d, %Y")})
    CURRENT TIME: {current_time_str}
    
    Extract the following details if present:
    1. Title - A concise name for the task
    2. Description - A brief description of what the task involves
    3. Priority - Low, Normal, or High (default to Normal if not specified)
    4. Date - The date for the task (use TODAY'S DATE if only time is mentioned)
    5. Start time - When the task starts
    6. End time - When the task ends
    7. Is due date - True if this is just a deadline, False if it's a scheduled time slot
    
    When interpreting dates:
    - "Today" means {current_date_str} ({current_date.strftime("%A, %B %d")})
    - "Tomorrow" means {tomorrow_str} ({tomorrow.strftime("%A, %B %d")})
    - "Next week" means starting {next_week_str} ({next_week.strftime("%A, %B %d")})
    - Always use the full year {current_date.year} in dates
    
    Format your response as a valid JSON object with these fields:
    {{
        "is_task": true/false,  # Whether the message contains a task
        "title": "string",
        "description": "string",
        "priority": "string",
        "date": "YYYY-MM-DD",
        "start_time": "HH:MM",
        "end_time": "HH:MM",
        "is_due_date": true/false,
        "uncertain_fields": ["field1", "field2", ...]  # List fields that were not explicitly mentioned and required guessing
    }}
    
    For the "uncertain_fields" array, include any of these fields that weren't explicitly mentioned:
    - "priority" (if priority wasn't specified)
    - "end_time" (if only start time was given)
    - "duration" (if duration wasn't specified)
    - "description" (if only a basic title was given)
    - "date" (if date was ambiguous)
    
    If the message doesn't contain a task, return {{"is_task": false}}.
    If any field is missing, make a reasonable assumption or omit it from the JSON.
    """
    
    ai_message = [
        ("system", system_prompt),
        ("user", message)
    ]
    
    try:
        response = llm.invoke(ai_message)
        # Extract JSON from the response
        json_match = re.search(r'```json\s*(.*?)\s*```', response.content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = response.content
            
        # Clean up the string to ensure it's valid JSON
        json_str = re.sub(r'[\n\r\t]', '', json_str)
        json_str = re.sub(r',$\s*}', '}', json_str)
        
        task_data = json.loads(json_str)
        return task_data
    except Exception as e:
        print(f"Error extracting task: {str(e)}")
        return {"is_task": False}

def create_task_from_extraction(task_data):
    """
    Create a task in the database from extracted task data
    Returns the created task or an error message
    """
    try:
        if not task_data.get("is_task", False):
            return None, [], False
            
        # Process date and time
        date_str = task_data.get("date")
        start_time = task_data.get("start_time")
        end_time = task_data.get("end_time")
        uncertain_fields = task_data.get("uncertain_fields", [])
        
        # Handle date defaults - use current year's date
        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")
            if "date" not in uncertain_fields:
                uncertain_fields.append("date")
        
        # Ensure date has current year if it's missing
        if len(date_str.split("-")) == 3:
            year, month, day = date_str.split("-")
            if len(year) != 4:  # If year is not in 4-digit format
                current_year = datetime.now().year
                date_str = f"{current_year}-{month}-{day}"
        
        # Create deadline datetime
        if start_time:
            try:
                deadline = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
            except ValueError:
                # Try alternative format if the first one fails
                try:
                    deadline = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %I:%M %p")
                except ValueError:
                    # If all parsing fails, use noon as default
                    deadline = datetime.strptime(f"{date_str} 12:00", "%Y-%m-%d %H:%M")
                    if "start_time" not in uncertain_fields:
                        uncertain_fields.append("start_time")
        else:
            # If no start time, use noon as default
            deadline = datetime.strptime(f"{date_str} 12:00", "%Y-%m-%d %H:%M")
            if "start_time" not in uncertain_fields:
                uncertain_fields.append("start_time")
            
        # Calculate duration
        duration = 60  # Default 1 hour
        if start_time and end_time:
            try:
                # Try to parse times in 24-hour format
                start_dt = datetime.strptime(start_time, "%H:%M")
                end_dt = datetime.strptime(end_time, "%H:%M")
            except ValueError:
                # Try 12-hour format with AM/PM
                try:
                    start_dt = datetime.strptime(start_time, "%I:%M %p")
                    end_dt = datetime.strptime(end_time, "%I:%M %p")
                except ValueError:
                    # If all parsing fails, use default duration
                    start_dt = datetime.strptime("00:00", "%H:%M")
                    end_dt = datetime.strptime("01:00", "%H:%M")
                    if "duration" not in uncertain_fields:
                        uncertain_fields.append("duration")
            
            duration_td = end_dt - start_dt
            duration = int(duration_td.total_seconds() / 60)
            if duration <= 0:  # Handle case where end time is earlier than start time (next day)
                duration = 60
                if "duration" not in uncertain_fields:
                    uncertain_fields.append("duration")
        else:
            # No end time specified, so duration is uncertain
            if "duration" not in uncertain_fields and "end_time" not in uncertain_fields:
                uncertain_fields.append("duration")
                
        # Check if priority is specified
        priority = task_data.get("priority", "Normal")
        if priority not in ["Low", "Normal", "High"]:
            priority = "Normal"
            if "priority" not in uncertain_fields:
                uncertain_fields.append("priority")
                
        # Create task object for database
        db_task = {
            "title": task_data.get("title", "New Task"),
            "description": task_data.get("description", ""),
            "priority": priority,
            "deadline": deadline,
            "duration": duration,
            "is_due_date": task_data.get("is_due_date", False)
        }
        
        # Add user_id if it was in the task_data
        if "user_id" in task_data:
            db_task["user_id"] = task_data["user_id"]
        
        # Add to database
        db = SessionLocal()
        new_task = Task(**db_task)
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        db.close()
        
        # Determine if we need to ask for confirmation
        needs_confirmation = len(uncertain_fields) > 0
        
        return new_task, uncertain_fields, needs_confirmation
    except Exception as e:
        print(f"Error creating task from extraction: {str(e)}")
        return None, [], False

def extract_task_edit_request(message):
    """
    Extract task edit details from a natural language message using the LLM
    Returns details about which task to edit and what changes to make
    """
    # Get current date and time for context
    current_date = datetime.now()
    current_date_str = current_date.strftime("%Y-%m-%d")
    current_time_str = current_date.strftime("%H:%M")
    
    # Calculate tomorrow and next week for explicit reference
    tomorrow = current_date + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    next_week = current_date + timedelta(days=7)
    next_week_str = next_week.strftime("%Y-%m-%d")
    
    # Get task summary for context
    task_summary = get_task_summary()
    
    system_prompt = f"""
    You are an AI assistant that extracts task editing information from user messages.
    
    CURRENT DATE INFORMATION:
    TODAY'S DATE: {current_date_str} ({current_date.strftime("%A, %B %d, %Y")})
    TOMORROW'S DATE: {tomorrow_str} ({tomorrow.strftime("%A, %B %d, %Y")})
    NEXT WEEK STARTS: {next_week_str} ({next_week.strftime("%A, %B %d, %Y")})
    CURRENT TIME: {current_time_str}
    
    CURRENT TASKS:
    {task_summary}
    
    Extract the following details if present:
    1. Task Identifiers - Words/phrases that help identify which task the user wants to edit (title keywords, date references, etc.)
    2. Changes - What properties the user wants to change and their new values
    
    Editable task properties:
    - title: The name of the task
    - description: Details about the task
    - priority: "Low", "Normal", or "High"
    - deadline: Date and time for the task
    - duration: Duration in minutes
    - is_due_date: Whether this is just a deadline (true) or scheduled time slot (false)
    
    Format your response as a valid JSON object with these fields:
    {{
        "is_edit_request": true/false,  # Whether the message is asking to edit a task
        "task_identifiers": {{
            "title_keywords": ["keyword1", "keyword2"],  # Words that might be in the task title
            "date_reference": "YYYY-MM-DD or relative date description",  # Like "tomorrow", "next week", etc.
            "time_reference": "HH:MM or description",  # Like "morning", "afternoon", "3pm", etc.
            "other_descriptors": ["any other identifying information"]
        }},
        "changes": {{
            "property_name": "new_value",  # One or more properties to change with their new values
            # Examples:
            # "priority": "High",
            # "deadline": "2023-05-20 15:00",
            # "duration": 90
        }}
    }}
    
    If the message isn't asking to edit a task, return {{"is_edit_request": false}}.
    """
    
    ai_message = [
        ("system", system_prompt),
        ("user", message)
    ]
    
    try:
        response = llm.invoke(ai_message)
        # Extract JSON from the response
        json_match = re.search(r'```json\s*(.*?)\s*```', response.content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = response.content
            
        # Clean up the string to ensure it's valid JSON
        json_str = re.sub(r'[\n\r\t]', '', json_str)
        json_str = re.sub(r',$\s*}', '}', json_str)
        
        edit_data = json.loads(json_str)
        return edit_data
    except Exception as e:
        print(f"Error extracting task edit request: {str(e)}")
        return {"is_edit_request": False}

def search_tasks_by_criteria(task_identifiers, user_id=None):
    """
    Search for tasks that match the criteria in task_identifiers
    Returns a list of matching tasks, optionally filtered by user_id
    """
    db = SessionLocal()
    
    try:
        # Start with a base query
        query = db.query(Task)
        
        # Add user_id filter if provided
        if user_id is not None:
            query = query.filter(Task.user_id == user_id)
        
        # Add filters based on task_identifiers
        title_keywords = task_identifiers.get("title_keywords", [])
        if title_keywords:
            title_conditions = []
            for keyword in title_keywords:
                if keyword:
                    title_conditions.append(Task.title.ilike(f"%{keyword}%"))
            if title_conditions:
                query = query.filter(or_(*title_conditions))
        
        # Handle date reference
        date_reference = task_identifiers.get("date_reference")
        if date_reference:
            # Process relative date references
            today = datetime.now().date()
            
            if "tomorrow" in date_reference.lower():
                date = today + timedelta(days=1)
                query = query.filter(func.date(Task.deadline) == date)
            elif "next week" in date_reference.lower():
                start_of_next_week = today + timedelta(days=(7 - today.weekday()))
                end_of_next_week = start_of_next_week + timedelta(days=6)
                query = query.filter(
                    and_(
                        func.date(Task.deadline) >= start_of_next_week,
                        func.date(Task.deadline) <= end_of_next_week
                    )
                )
            elif "today" in date_reference.lower():
                query = query.filter(func.date(Task.deadline) == today)
            else:
                # Try to parse as exact date
                try:
                    # Check if the date reference already has a year
                    if len(date_reference.split("-")) == 3:
                        date = datetime.strptime(date_reference, "%Y-%m-%d").date()
                    else:
                        # If no year, assume current year
                        date = datetime.strptime(f"{today.year}-{date_reference}", "%Y-%m-%d").date()
                    query = query.filter(func.date(Task.deadline) == date)
                except ValueError:
                    # If parsing fails, don't apply date filter
                    pass
        
        # Handle time reference (morning, afternoon, etc.)
        time_reference = task_identifiers.get("time_reference")
        if time_reference:
            if "morning" in time_reference.lower():
                query = query.filter(
                    and_(
                        func.extract('hour', Task.deadline) >= 5,
                        func.extract('hour', Task.deadline) < 12
                    )
                )
            elif "afternoon" in time_reference.lower():
                query = query.filter(
                    and_(
                        func.extract('hour', Task.deadline) >= 12,
                        func.extract('hour', Task.deadline) < 18
                    )
                )
            elif "evening" in time_reference.lower() or "night" in time_reference.lower():
                query = query.filter(func.extract('hour', Task.deadline) >= 18)
            else:
                # Try to parse as exact time
                try:
                    # Extract hours from time reference
                    time_match = re.search(r'(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?', time_reference, re.IGNORECASE)
                    if time_match:
                        hour = int(time_match.group(1))
                        minute = int(time_match.group(2)) if time_match.group(2) else 0
                        am_pm = time_match.group(3).lower() if time_match.group(3) else None
                        
                        # Adjust hour for AM/PM
                        if am_pm == "pm" and hour < 12:
                            hour += 12
                        elif am_pm == "am" and hour == 12:
                            hour = 0
                            
                        # Search for tasks around that time (within 1 hour)
                        query = query.filter(
                            and_(
                                func.extract('hour', Task.deadline) >= hour - 1,
                                func.extract('hour', Task.deadline) <= hour + 1
                            )
                        )
                except Exception:
                    # If parsing fails, don't apply time filter
                    pass
        
        # Get the results
        tasks = query.all()
        return tasks
    finally:
        db.close()

def update_task(task_id, changes):
    """
    Update a task with the specified changes
    Returns the updated task
    """
    db = SessionLocal()
    
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        
        # Apply changes
        for prop, value in changes.items():
            if prop == "deadline" and isinstance(value, str):
                # Parse deadline string to datetime
                try:
                    task.deadline = datetime.strptime(value, "%Y-%m-%d %H:%M")
                except ValueError:
                    try:
                        # Alternative format
                        task.deadline = datetime.strptime(value, "%Y-%m-%d")
                    except ValueError:
                        # Keep original if parsing fails
                        pass
            elif prop == "duration" and isinstance(value, (str, int)):
                # Convert string to int if needed
                try:
                    task.duration = int(value)
                except ValueError:
                    # Keep original if conversion fails
                    pass
            elif prop == "is_due_date" and isinstance(value, str):
                # Convert string to boolean
                task.is_due_date = value.lower() in ["true", "yes", "1"]
            elif prop == "priority" and isinstance(value, str):
                # Validate priority
                if value in ["Low", "Normal", "High"]:
                    task.priority = value
            elif hasattr(task, prop):
                # Set attribute if it exists
                setattr(task, prop, value)
        
        db.commit()
        db.refresh(task)
        return task
    finally:
        db.close()

def format_task_list(user_id=None):
    """Format the current task list in a user-friendly way for display, filtered by user_id"""
    db = SessionLocal()
    
    # Filter tasks by user_id if provided
    if user_id:
        tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.deadline).all()
    else:
        tasks = db.query(Task).order_by(Task.deadline).all()
        
    db.close()
    
    if not tasks:
        return "You currently have no tasks scheduled."
    
    # Group tasks by date
    tasks_by_date = {}
    for task in tasks:
        date_str = task.deadline.strftime("%Y-%m-%d")
        if date_str not in tasks_by_date:
            tasks_by_date[date_str] = []
        tasks_by_date[date_str].append(task)
    
    # Format the task list
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    
    result = "📋 **Your Updated Task List**\n\n"
    
    # Sort dates
    sorted_dates = sorted(tasks_by_date.keys())
    for date_str in sorted_dates:
        task_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        
        # Format date header
        if task_date == today:
            date_header = "Today"
        elif task_date == tomorrow:
            date_header = "Tomorrow"
        else:
            date_header = task_date.strftime("%A, %B %d")
            
        result += f"**{date_header}** ({date_str}):\n"
        
        # Add tasks for this date
        for task in tasks_by_date[date_str]:
            time_str = task.deadline.strftime("%H:%M")
            priority_icon = "🔴" if task.priority == "High" else "🟡" if task.priority == "Normal" else "🟢"
            result += f"- {priority_icon} {time_str} | {task.title} ({task.duration}min)\n"
        
        result += "\n"
    
    return result

def handle_task_edit_request(edit_data, user_id=None):
    """
    Handle a task edit request
    Returns information about the result of the edit
    """
    if not edit_data.get("is_edit_request", False):
        return {"success": False, "message": "Not an edit request"}
    
    # Search for tasks matching the criteria, filtered by user_id
    task_identifiers = edit_data.get("task_identifiers", {})
    matching_tasks = search_tasks_by_criteria(task_identifiers, user_id)
    
    if not matching_tasks:
        return {"success": False, "message": "No matching tasks found", "matched_tasks": []}
    
    # Apply changes to the first matching task
    # (Could be extended to handle multiple matches or allow user to choose)
    changes = edit_data.get("changes", {})
    task = update_task(matching_tasks[0].id, changes)
    
    if task:
        # Format task info for response
        task_info = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "deadline": task.deadline.strftime("%Y-%m-%d %H:%M"),
            "duration": task.duration,
            "is_due_date": task.is_due_date
        }
        
        # Get updated task list
        updated_task_list = format_task_list(user_id)
        
        return {
            "success": True, 
            "message": "Task updated successfully", 
            "task": task_info,
            "matched_tasks": [t.title for t in matching_tasks],
            "changed_properties": list(changes.keys()),
            "updated_task_list": updated_task_list
        }
    else:
        return {"success": False, "message": "Failed to update task", "matched_tasks": [t.title for t in matching_tasks]}

def extract_task_deletion_request(message):
    """
    Extract task deletion details from a natural language message using the LLM
    Returns details about which task to delete
    """
    # Get current date and time for context
    current_date = datetime.now()
    current_date_str = current_date.strftime("%Y-%m-%d")
    current_time_str = current_date.strftime("%H:%M")
    
    # Calculate tomorrow and next week for explicit reference
    tomorrow = current_date + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    next_week = current_date + timedelta(days=7)
    next_week_str = next_week.strftime("%Y-%m-%d")
    
    # Get task summary for context
    task_summary = get_task_summary()
    
    system_prompt = f"""
    You are an AI assistant that extracts task deletion information from user messages.
    
    CURRENT DATE INFORMATION:
    TODAY'S DATE: {current_date_str} ({current_date.strftime("%A, %B %d, %Y")})
    TOMORROW'S DATE: {tomorrow_str} ({tomorrow.strftime("%A, %B %d, %Y")})
    NEXT WEEK STARTS: {next_week_str} ({next_week.strftime("%A, %B %d, %Y")})
    CURRENT TIME: {current_time_str}
    
    CURRENT TASKS:
    {task_summary}
    
    Extract the following details if present:
    - Task Identifiers - Words/phrases that help identify which task the user wants to delete (title keywords, date references, etc.)
    
    The user may use phrases like "remove", "delete", "cancel", "get rid of", or similar to indicate they want to delete a task.
    
    Format your response as a valid JSON object with these fields:
    {{
        "is_delete_request": true/false,  # Whether the message is asking to delete a task
        "task_identifiers": {{
            "title_keywords": ["keyword1", "keyword2"],  # Words that might be in the task title
            "date_reference": "YYYY-MM-DD or relative date description",  # Like "tomorrow", "next week", etc.
            "time_reference": "HH:MM or description",  # Like "morning", "afternoon", "3pm", etc.
            "other_descriptors": ["any other identifying information"]
        }}
    }}
    
    If the message isn't asking to delete a task, return {{"is_delete_request": false}}.
    """
    
    ai_message = [
        ("system", system_prompt),
        ("user", message)
    ]
    
    try:
        response = llm.invoke(ai_message)
        # Extract JSON from the response
        json_match = re.search(r'```json\s*(.*?)\s*```', response.content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = response.content
            
        # Clean up the string to ensure it's valid JSON
        json_str = re.sub(r'[\n\r\t]', '', json_str)
        json_str = re.sub(r',$\s*}', '}', json_str)
        
        delete_data = json.loads(json_str)
        return delete_data
    except Exception as e:
        print(f"Error extracting task deletion request: {str(e)}")
        return {"is_delete_request": False}

def delete_task(task_id):
    """
    Delete a task with the specified ID
    Returns True if successful, False otherwise
    """
    db = SessionLocal()
    
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        
        # Store task info before deletion for confirmation message
        task_info = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "deadline": task.deadline.strftime("%Y-%m-%d %H:%M"),
            "duration": task.duration,
            "is_due_date": task.is_due_date
        }
        
        # Delete the task
        db.delete(task)
        db.commit()
        return task_info
    except Exception as e:
        print(f"Error deleting task: {str(e)}")
        return None
    finally:
        db.close()

def handle_task_deletion_request(delete_data, user_id=None):
    """
    Handle a task deletion request
    Returns information about the result of the deletion
    """
    if not delete_data.get("is_delete_request", False):
        return {"success": False, "message": "Not a deletion request"}
    
    # Search for tasks matching the criteria, filtered by user_id
    task_identifiers = delete_data.get("task_identifiers", {})
    matching_tasks = search_tasks_by_criteria(task_identifiers, user_id)
    
    if not matching_tasks:
        return {"success": False, "message": "No matching tasks found", "matched_tasks": []}
        
    # If multiple tasks match, return the list for confirmation
    if len(matching_tasks) > 1:
        return {
            "success": False, 
            "message": "Multiple matching tasks found. Please be more specific.", 
            "matched_tasks": [{
                "id": t.id,
                "title": t.title,
                "deadline": t.deadline.strftime("%Y-%m-%d %H:%M")
            } for t in matching_tasks]
        }
    
    # Delete the task
    task_info = delete_task(matching_tasks[0].id)
    
    if task_info:
        # Get updated task list
        updated_task_list = format_task_list(user_id)
        
        return {
            "success": True, 
            "message": "Task deleted successfully", 
            "task": task_info,
            "updated_task_list": updated_task_list
        }
    else:
        return {"success": False, "message": "Failed to delete task", "matched_tasks": [t.title for t in matching_tasks]}

def chat_with_ai(user_message, user_id=None):
    """Chat with the AI about scheduling and tasks, with user context"""
    # Get current date information for context
    current_date = datetime.now()
    current_date_str = current_date.strftime("%Y-%m-%d")
    today_formatted = current_date.strftime("%A, %B %d, %Y")
    
    # First, try to extract a task deletion request
    delete_data = extract_task_deletion_request(user_message)
    
    # If a deletion request was detected, handle it
    delete_result = None
    if delete_data.get("is_delete_request", False):
        delete_result = handle_task_deletion_request(delete_data, user_id)
        
    # If not a deletion request, try to extract an edit request
    edit_data = None
    edit_result = None
    if not delete_data.get("is_delete_request", False):
        edit_data = extract_task_edit_request(user_message)
        
        # If an edit request was detected, handle it
        if edit_data.get("is_edit_request", False):
            edit_result = handle_task_edit_request(edit_data, user_id)
    
    # If no edit or delete request, continue with task extraction
    task_data = None
    created_task = None
    task_created = False
    uncertain_fields = []
    needs_confirmation = False
    
    if (not delete_data.get("is_delete_request", False) and 
        not (edit_data and edit_data.get("is_edit_request", False))):
        # Try to extract a task
        task_data = extract_task_from_message(user_message)
        
        # If a task was detected, create it
        if task_data.get("is_task", False):
            # Add user_id to the task data if provided
            if user_id is not None:
                task_data["user_id"] = user_id
                
            result = create_task_from_extraction(task_data)
            if result:
                created_task, uncertain_fields, needs_confirmation = result
                task_created = created_task is not None
    
    # Get current tasks for context - filtered by user_id
    task_summary = get_task_summary(user_id)
    
    # Create a system message with context about the app and current tasks
    system_message = (
        "You are an AI scheduling assistant that helps users manage their tasks and time effectively. "
        "You can suggest how to organize tasks, prioritize work, and find time for important activities. "
        f"\n\nToday is {today_formatted}."
        f"\n\nCurrent schedule context: {task_summary}"
    )
    
    # Add information about the deletion attempt
    if delete_result:
        if delete_result["success"]:
            # Add task details to system message
            system_message += f"\n\nA task was just deleted successfully:"
            system_message += f"\nTask: {delete_result['task']['title']}"
            system_message += f"\nTask details: Priority: {delete_result['task']['priority']}, Deadline: {delete_result['task']['deadline']}, Duration: {delete_result['task']['duration']} minutes"
            
            user_message += "\n\n[SYSTEM: I've deleted this task for you as requested.]"
        else:
            # Task deletion failed
            system_message += f"\n\nTask deletion attempt failed: {delete_result['message']}"
            if delete_result.get('matched_tasks') and len(delete_result['matched_tasks']) > 1:
                system_message += f"\nMultiple tasks matched your description. Please be more specific about which one to delete."
                matched_list = "\n".join([f"- {task['title']} (due: {task['deadline']})" for task in delete_result['matched_tasks']])
                system_message += f"\nMatched tasks:\n{matched_list}"
                
                user_message += "\n\n[SYSTEM: I found multiple tasks that match your description. Please specify which one you want to delete.]"
            elif not delete_result.get('matched_tasks') or len(delete_result['matched_tasks']) == 0:
                user_message += "\n\n[SYSTEM: I couldn't find a task matching your description. Please try again with more details about which task you want to delete.]"
    
    # Add information about the edit attempt (existing code)
    elif edit_result:
        if edit_result["success"]:
            # Add task details to system message
            system_message += f"\n\nA task was just edited successfully:"
            system_message += f"\nTask: {edit_result['task']['title']}"
            system_message += f"\nChanged properties: {', '.join(edit_result['changed_properties'])}"
            system_message += f"\nTask details: Priority: {edit_result['task']['priority']}, Deadline: {edit_result['task']['deadline']}, Duration: {edit_result['task']['duration']} minutes"
            
            user_message += "\n\n[SYSTEM: I've updated this task for you. Please confirm if the changes are correct.]"
        else:
            # Task edit failed
            system_message += f"\n\nTask edit attempt failed: {edit_result['message']}"
            if edit_result.get('matched_tasks'):
                system_message += f"\nMatched tasks: {', '.join(edit_result['matched_tasks'])}"
            
            if not edit_result['matched_tasks']:
                user_message += "\n\n[SYSTEM: I couldn't find a task matching your description. Please try again with more details about which task you want to edit.]"
            else:
                user_message += "\n\n[SYSTEM: I found the task but couldn't update it. Please try again with clearer instructions for what you want to change.]"
    
    # Add information about the task creation attempt (existing code)
    elif task_data and task_data.get("is_task", False):
        if task_created:
            # Add task details to system message
            system_message += f"\n\nA task was just created with these details:\nTitle: {created_task.title}\nDescription: {created_task.description}\nPriority: {created_task.priority}\nDeadline: {created_task.deadline}\nDuration: {created_task.duration} minutes\nIs due date: {created_task.is_due_date}"
            
            # Add information about uncertain fields
            if needs_confirmation:
                user_message += "\n\n[SYSTEM: I've created this task for you, but I need to confirm some details.]"
                system_message += "\n\nThe following fields were uncertain and need confirmation:"
                
                for field in uncertain_fields:
                    if field == "duration" or field == "end_time":
                        system_message += "\n- Ask how long the task will take or when it ends"
                    elif field == "priority":
                        system_message += "\n- Ask if they want to set a specific priority (Low, Normal, High)"
                    elif field == "description":
                        system_message += "\n- Ask if they want to add more details to the description"
                    elif field == "date":
                        system_message += "\n- Confirm if the date is correct"
                    elif field == "start_time":
                        system_message += "\n- Confirm if the start time is correct"
                
                system_message += "\n\nAsk about these uncertain fields in a conversational way. Don't list them all at once - focus on 1-2 most important ones (duration and priority first)."
            else:
                user_message += "\n\n[SYSTEM: I've created this task for you. Please confirm if the details are correct.]"
        else:
            user_message += "\n\n[SYSTEM: I tried to create a task but encountered an error. Please try again with more details.]"
    
    # Create the conversation
    ai_message = [
        ("system", system_message),
        ("user", user_message)
    ]
    
    # Get response from the AI
    response = llm.invoke(ai_message)
    
    # If a task was deleted, add a confirmation to the response
    if delete_result and delete_result["success"]:
        task = delete_result["task"]
        task_info = f"""
✅ Task deleted successfully:
📌 Title: {task["title"]}
📝 Description: {task["description"]}
🔥 Priority: {task["priority"]}
🕒 Time: {task["deadline"]}
⏱️ Duration: {task["duration"]} minutes

{delete_result.get("updated_task_list", "")}
"""
        return f"{task_info}\n\n{response.content}"
    
    # If a task was edited, add a confirmation to the response (existing code)
    if edit_result and edit_result["success"]:
        task = edit_result["task"]
        task_info = f"""
✅ Task updated successfully:
📌 Title: {task["title"]}
📝 Description: {task["description"]}
🔥 Priority: {task["priority"]}
🕒 Time: {task["deadline"]}
⏱️ Duration: {task["duration"]} minutes

Changed properties: {', '.join(edit_result["changed_properties"])}

{edit_result.get("updated_task_list", "")}
"""
        return f"{task_info}\n\n{response.content}"
    
    # If a task was created, add a confirmation to the response (existing code)
    if task_created:
        # Get updated task list
        updated_task_list = format_task_list(user_id)
        
        task_info = f"""
✅ Task created successfully:
📌 Title: {created_task.title}
📝 Description: {created_task.description}
🔥 Priority: {created_task.priority}
🕒 Time: {created_task.deadline.strftime('%Y-%m-%d %H:%M')}
⏱️ Duration: {created_task.duration} minutes

{updated_task_list}
"""
        return f"{task_info}\n\n{response.content}"
    
    return response.content
