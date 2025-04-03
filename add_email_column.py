import os
import psycopg2
from app.database import DATABASE_URL

def add_email_column():
    """Add email column to the users table if it doesn't exist."""
    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Check if the column already exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='email';
        """)
        
        if cursor.fetchone() is None:
            # Add the email column if it doesn't exist
            print("Adding email column to users table...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN email VARCHAR(255) UNIQUE;
            """)
            conn.commit()
            print("Email column added successfully!")
        else:
            print("Email column already exists in users table.")
        
        # Close the connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    add_email_column() 