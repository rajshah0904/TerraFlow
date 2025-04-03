import os
import psycopg2
from app.database import DATABASE_URL

def update_users_table():
    """Add all necessary columns to the users table."""
    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Check and add columns one by one
        columns_to_add = {
            'email': 'VARCHAR(255) UNIQUE',
            'role': 'VARCHAR(50) DEFAULT \'user\'',
            'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'is_active': 'BOOLEAN DEFAULT TRUE'
        }
        
        for column_name, column_type in columns_to_add.items():
            # Check if the column exists
            cursor.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='{column_name}';
            """)
            
            if cursor.fetchone() is None:
                # Add the column if it doesn't exist
                print(f"Adding {column_name} column to users table...")
                cursor.execute(f"""
                    ALTER TABLE users 
                    ADD COLUMN {column_name} {column_type};
                """)
                conn.commit()
                print(f"{column_name} column added successfully!")
            else:
                print(f"{column_name} column already exists in users table.")
        
        # Close the connection
        cursor.close()
        conn.close()
        
        print("Users table update completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    update_users_table() 