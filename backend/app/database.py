"""Database models and setup for On-Prem AI Note Taker"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Import models from the models package
from .models import Base, Workspace, User

# Get the user's home directory for database storage
def get_db_path():
    """Get the path for the SQLite database file"""
    home = os.path.expanduser("~")
    db_dir = os.path.join(home, ".on-prem-ai-notes")
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "notes.db")

# Database URL
DATABASE_URL = f"sqlite:///{get_db_path()}"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Database initialization
def init_db():
    """Initialize the database tables"""
    Base.metadata.create_all(bind=engine)
    
    # Initialize default workspaces
    init_default_workspaces()


def init_default_workspaces():
    """Initialize default workspaces if they don't exist"""
    db = SessionLocal()
    try:
        # Check if workspaces already exist
        transit_workspace = db.query(Workspace).filter(Workspace.name == "Transit").first()
        atm_workspace = db.query(Workspace).filter(Workspace.name == "ATM").first()
        
        changes_made = False
        
        # Create Transit workspace if it doesn't exist
        if not transit_workspace:
            transit_workspace = Workspace(
                name="Transit",
                description="Dgpays' Transit Tribe Workspace",
                is_active=True
            )
            db.add(transit_workspace)
            print("✅ Created Transit workspace")
            changes_made = True
        
        # Create ATM workspace if it doesn't exist
        if not atm_workspace:
            atm_workspace = Workspace(
                name="ATM",
                description="Dgpays' ATM Tribe Workspace",
                is_active=True
            )
            db.add(atm_workspace)
            print("✅ Created ATM workspace")
            changes_made = True
        
        # Commit changes if any were made
        if changes_made:
            db.commit()
            print("🎯 Default workspaces initialized successfully")
        else:
            print("ℹ️ Default workspaces already exist")
            
    except Exception as e:
        print(f"⚠️ Error initializing workspaces: {e}")
        db.rollback()
    finally:
        db.close()



def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
