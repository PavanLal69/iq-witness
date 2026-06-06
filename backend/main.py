import os
import shutil
import tempfile
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db
from demo_data import load_demo_case
from enron_data import load_enron_case
from services.timeline import TimelineService
from services.report import ReportService

# Create database tables if they don't exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WitnessIQ API", description="AI-powered Incident Reconstruction & Evidence Intelligence Platform")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure storage directories exist
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage")
os.makedirs(STORAGE_DIR, exist_ok=True)

@app.post("/api/cases", response_model=schemas.CaseResponse, status_code=201)
def create_case(case: schemas.CaseCreate, db: Session = Depends(get_db)):
    db_case = models.Case(title=case.title, description=case.description, status=case.status)
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    
    # Audit log
    audit = models.AuditLog(
        case_id=db_case.id,
        action="Case Created",
        details=f"Case '{db_case.title}' created via API."
    )
    db.add(audit)
    db.commit()
    return db_case

@app.get("/api/cases", response_model=List[schemas.CaseResponse])
def get_cases(db: Session = Depends(get_db)):
    return db.query(models.Case).all()

@app.get("/api/cases/{case_id}", response_model=schemas.CaseDetailResponse)
def get_case_details(case_id: int, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
    return db_case

@app.delete("/api/cases/{case_id}", status_code=204)
def delete_case(case_id: int, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
    db.delete(db_case)
    db.commit()
    return None

@app.post("/api/cases/{case_id}/upload", response_model=schemas.EvidenceResponse)
def upload_evidence(
    case_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Determine file type group
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    video_exts = ['.mp4', '.mov', '.avi', '.mkv']
    audio_exts = ['.mp3', '.wav', '.ogg', '.m4a']
    image_exts = ['.jpg', '.jpeg', '.png', '.bmp']
    doc_exts = ['.pdf', '.docx', '.txt', '.doc', '.csv']
    
    if ext in video_exts:
        file_type = "video"
    elif ext in audio_exts:
        file_type = "audio"
    elif ext in image_exts:
        file_type = "image"
    elif ext in doc_exts:
        if "chat" in filename.lower() or ext == '.csv' or (ext == '.txt' and "whatsapp" in filename.lower()):
            file_type = "chat"
        else:
            file_type = ext.replace('.', '')
    else:
        file_type = "unknown"

    # Save file to storage directory
    case_storage = os.path.join(STORAGE_DIR, f"case_{case_id}")
    os.makedirs(case_storage, exist_ok=True)
    file_path = os.path.join(case_storage, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    # Save to Database
    db_evidence = models.Evidence(
        case_id=case_id,
        filename=filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        status="Pending"
    )
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)

    # Audit log
    audit = models.AuditLog(
        case_id=case_id,
        action="Evidence Uploaded",
        details=f"Uploaded '{filename}' (Type: {file_type}, Size: {file_size} bytes)"
    )
    db.add(audit)
    db.commit()

    return db_evidence

@app.post("/api/cases/{case_id}/process")
def process_case_evidence(case_id: int, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = TimelineService.process_and_reconstruct(db, case_id)
    return result

@app.get("/api/cases/{case_id}/timeline", response_model=List[schemas.TimelineEventResponse])
def get_case_timeline(case_id: int, db: Session = Depends(get_db)):
    events = db.query(models.TimelineEvent).filter(models.TimelineEvent.case_id == case_id).order_by(models.TimelineEvent.timestamp.asc()).all()
    return events

@app.get("/api/cases/{case_id}/entities")
def get_case_entities_and_relationships(case_id: int, db: Session = Depends(get_db)):
    entities = db.query(models.Entity).filter(models.Entity.case_id == case_id).all()
    relationships = db.query(models.EntityRelationship).filter(models.EntityRelationship.case_id == case_id).all()
    
    # Format graph data
    nodes = [{"id": ent.id, "label": ent.name, "type": ent.type, "details": ent.details} for ent in entities]
    links = [
        {
            "id": f"rel_{rel.id}",
            "source": rel.source_id,
            "target": rel.target_id,
            "label": rel.relation_type,
            "details": rel.details
        }
        for rel in relationships
    ]
    
    return {"nodes": nodes, "links": links}

@app.post("/api/cases/{case_id}/reports/{format}")
def generate_report(
    case_id: int, 
    format: str, # "pdf" or "docx"
    payload: schemas.ReportRequest,
    db: Session = Depends(get_db)
):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")

    events = db.query(models.TimelineEvent).filter(models.TimelineEvent.case_id == case_id).order_by(models.TimelineEvent.timestamp.asc()).all()
    entities = db.query(models.Entity).filter(models.Entity.case_id == case_id).all()

    temp_dir = tempfile.gettempdir()
    file_ext = "pdf" if format.lower() == "pdf" else "docx"
    report_filename = f"WitnessIQ_Case_{case_id}_Report.{file_ext}"
    report_path = os.path.join(temp_dir, report_filename)

    # Use a descriptive summary in the report, appending any custom notes if provided
    description = db_case.description
    if payload.custom_notes:
        description += f"\n\nAdditional Analyst Notes:\n{payload.custom_notes}"

    if format.lower() == "pdf":
        ReportService.generate_pdf_report(
            payload.report_type, db_case.title, description, events, entities, report_path
        )
        # Handle fallback check
        if not os.path.exists(report_path) and os.path.exists(report_path.replace(".pdf", ".html")):
            # If pdf creation failed but HTML was saved (due to missing libraries)
            report_path = report_path.replace(".pdf", ".html")
            return FileResponse(report_path, media_type="text/html", filename=report_filename.replace(".pdf", ".html"))
            
        return FileResponse(report_path, media_type="application/pdf", filename=report_filename)
        
    elif format.lower() == "docx":
        ReportService.generate_docx_report(
            payload.report_type, db_case.title, description, events, entities, report_path
        )
        return FileResponse(report_path, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename=report_filename)
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: pdf, docx")

@app.post("/api/cases/load-demo", response_model=schemas.CaseResponse)
def load_demo(db: Session = Depends(get_db)):
    try:
        demo_case = load_demo_case(db)
        return demo_case
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to load demo case: {str(e)}")

@app.post("/api/cases/load-real-life", response_model=schemas.CaseResponse)
def load_real_life(db: Session = Depends(get_db)):
    try:
        enron_case = load_enron_case(db)
        return enron_case
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to load real-life case: {str(e)}")

@app.post("/api/cases/{case_id}/relationships", response_model=schemas.EntityRelationshipResponse, status_code=201)
def create_relationship(case_id: int, payload: schemas.EntityRelationshipCreate, db: Session = Depends(get_db)):
    db_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    existing = db.query(models.EntityRelationship).filter(
        models.EntityRelationship.case_id == case_id,
        models.EntityRelationship.source_id == payload.source_id,
        models.EntityRelationship.target_id == payload.target_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Relationship already exists")
        
    db_rel = models.EntityRelationship(
        case_id=case_id,
        source_id=payload.source_id,
        target_id=payload.target_id,
        relation_type=payload.relation_type,
        details=payload.details
    )
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    
    audit = models.AuditLog(
        case_id=case_id,
        action="Relationship Created",
        details=f"Manually created relationship '{payload.relation_type}' between entity ID {payload.source_id} and ID {payload.target_id}."
    )
    db.add(audit)
    db.commit()
    
    return db_rel
