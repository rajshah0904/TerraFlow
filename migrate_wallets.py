"""
Migration script to update wallet database schema from single currency to multi-currency model.
This script:
1. Adds new columns to the wallet table
2. Migrates existing data
3. Handles any data inconsistencies

Execute this script after deploying the new code but before restarting the application.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import json

# Use the same database URL as in the main application
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://raj:Rajshah11@localhost:5432/terraflow")

def migrate_wallets():
    """Migrate the wallet table to the new schema"""
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("Starting wallet migration...")
        
        # Check if base_currency column already exists
        column_check = session.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'wallets' AND column_name = 'base_currency'"
        )).fetchone()
        
        if column_check:
            print("Migration appears to have been already applied. Checking for data consistency...")
            validate_data(session)
            return
        
        # Add new columns with safe defaults
        print("Adding new columns to wallets table...")
        session.execute(text("""
            ALTER TABLE wallets 
            ADD COLUMN IF NOT EXISTS base_currency VARCHAR DEFAULT 'USD',
            ADD COLUMN IF NOT EXISTS display_currency VARCHAR DEFAULT 'USD',
            ADD COLUMN IF NOT EXISTS country_code VARCHAR,
            ADD COLUMN IF NOT EXISTS blockchain_address VARCHAR,
            ADD COLUMN IF NOT EXISTS currency_settings JSONB
        """))
        
        # Migrate data from the old currency column to the new base_currency column
        print("Migrating data from currency to base_currency...")
        session.execute(text("""
            UPDATE wallets 
            SET base_currency = currency, 
                display_currency = currency
            WHERE currency IS NOT NULL
        """))
        
        # Set default currency settings for all wallets
        print("Setting default currency settings...")
        session.execute(text("""
            UPDATE wallets
            SET currency_settings = '{"allowed_currencies": ["USD", "EUR", "GBP"], "conversion_fee_percent": 1.0, "regulatory_status": "compliant"}'
            WHERE currency_settings IS NULL
        """))
        
        # Optional: Drop the old currency column (comment out if you want to keep it during transition)
        # print("Dropping old currency column...")
        # session.execute(text("ALTER TABLE wallets DROP COLUMN IF EXISTS currency"))
        
        session.commit()
        print("Wallet migration completed successfully!")
        
    except Exception as e:
        session.rollback()
        print(f"Migration failed: {str(e)}")
        raise
    finally:
        session.close()

def validate_data(session):
    """Validate migrated data for consistency"""
    
    inconsistencies = session.execute(text("""
        SELECT id FROM wallets
        WHERE base_currency IS NULL OR display_currency IS NULL
    """)).fetchall()
    
    if inconsistencies:
        print(f"Found {len(inconsistencies)} wallets with NULL currency values. Fixing...")
        session.execute(text("""
            UPDATE wallets
            SET base_currency = 'USD', display_currency = 'USD'
            WHERE base_currency IS NULL OR display_currency IS NULL
        """))
        session.commit()
        print("Fixed inconsistencies.")
    else:
        print("Data validation passed. All wallets have valid currency settings.")

if __name__ == "__main__":
    migrate_wallets() 