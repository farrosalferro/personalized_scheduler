from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.sql import text
from database import engine, init_db
import sys

def add_user_id_to_tasks():
    """Add user_id column to tasks table"""
    try:
        print("Adding user_id column to tasks table...")
        with engine.connect() as conn:
            # Check if user_id column already exists
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='user_id'"))
            if result.fetchone():
                print("Column user_id already exists in tasks table.")
                return True
                
            # Add user_id column
            conn.execute(text("ALTER TABLE tasks ADD COLUMN user_id INTEGER"))
            
            # Add foreign key constraint
            conn.execute(text("ALTER TABLE tasks ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"))
            
            # Commit the transaction
            conn.commit()
            print("Successfully added user_id column to tasks table.")
            return True
    except Exception as e:
        print(f"Error adding user_id column to tasks table: {str(e)}")
        return False

def create_users_table():
    """Create users table if it doesn't exist"""
    try:
        print("Making sure users table exists...")
        # This will create the users table if it doesn't exist
        init_db(drop_all=False)
        return True
    except Exception as e:
        print(f"Error creating users table: {str(e)}")
        return False

if __name__ == "__main__":
    if "--reset" in sys.argv:
        print("WARNING: This will erase all existing data! Are you sure?")
        confirm = input("Type 'yes' to confirm: ")
        
        if confirm.lower() == 'yes':
            print("Resetting database...")
            init_db(drop_all=True)
            print("Database reset complete. All tables have been recreated.")
        else:
            print("Database reset cancelled.")
    else:
        # First ensure the users table exists
        if create_users_table():
            # Then add user_id column to tasks table
            add_user_id_to_tasks()
