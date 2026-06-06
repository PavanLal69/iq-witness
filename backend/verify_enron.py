import os
import sys
from sqlalchemy.orm import Session

# Add current dir to python path
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal, engine, Base
import models
from enron_data import load_enron_case
from services.report import ReportService

def run_verification():
    print("=== STARTING WITNESSIQ ENRON DATASET VERIFICATION ===")
    
    # 1. Database Creation
    print("\n1. Initializing database and tables...")
    try:
        models.Base.metadata.create_all(bind=engine)
        print("   [SUCCESS] Database tables created successfully.")
    except Exception as e:
        print(f"   [ERROR] Failed to create tables: {e}")
        return False

    db: Session = SessionLocal()
    
    try:
        # 2. Loading Enron Case
        print("\n2. Seeding and reconstructing Enron Corporate Fraud Case...")
        enron_case = load_enron_case(db)
        print(f"   [SUCCESS] Enron Case '{enron_case.title}' created (ID: {enron_case.id}).")
        
        # Verify Evidence Records
        evidence_count = db.query(models.Evidence).filter(models.Evidence.case_id == enron_case.id).count()
        print(f"   - Extracted Evidence count: {evidence_count} (Expected: 4)")
        if evidence_count != 4:
            print("   [WARNING] Unexpected evidence count.")

        # Verify Timeline Events
        events = db.query(models.TimelineEvent).filter(models.TimelineEvent.case_id == enron_case.id).order_by(models.TimelineEvent.timestamp.asc()).all()
        print(f"   - Reconstructed Timeline Events: {len(events)}")
        for idx, ev in enumerate(events):
            print(f"     [{idx+1}] {ev.timestamp.strftime('%Y-%m-%d %H:%M:%S') if ev.timestamp else 'N/A'} - {ev.title} (Type: {ev.event_type})")
            print(f"         Description: {ev.description[:100]}...")
        
        if len(events) == 0:
            print("   [ERROR] No timeline events reconstructed!")
            return False

        # Verify Entities & Relationships
        entities = db.query(models.Entity).filter(models.Entity.case_id == enron_case.id).all()
        relationships = db.query(models.EntityRelationship).filter(models.EntityRelationship.case_id == enron_case.id).all()
        print(f"   - Extracted Entities: {len(entities)}")
        print(f"   - Extracted Relationships: {len(relationships)}")
        for ent in entities:
            print(f"     * Entity: {ent.name} ({ent.type}) - {ent.details}")
        for rel in relationships:
            print(f"     * Relationship: {rel.source.name} --[{rel.relation_type}]--> {rel.target.name}")
            
        if len(entities) == 0:
            print("   [ERROR] No entities extracted!")
            return False

        # 3. Report Generation
        print("\n3. Testing report generation for Enron...")
        temp_dir = os.path.join(os.path.dirname(__file__), "storage", "test_reports")
        os.makedirs(temp_dir, exist_ok=True)
        
        pdf_path = os.path.join(temp_dir, "enron_test_report.pdf")
        docx_path = os.path.join(temp_dir, "enron_test_report.docx")
        
        # Test PDF
        ReportService.generate_pdf_report(
            "police", enron_case.title, enron_case.description, events, entities, pdf_path
        )
        if os.path.exists(pdf_path) or os.path.exists(pdf_path.replace(".pdf", ".html")):
            print("   [SUCCESS] PDF/HTML report generated.")
        else:
            print("   [ERROR] PDF report generation failed.")
            return False
            
        # Test DOCX
        ReportService.generate_docx_report(
            "police", enron_case.title, enron_case.description, events, entities, docx_path
        )
        if os.path.exists(docx_path):
            print("   [SUCCESS] DOCX report generated.")
        else:
            print("   [ERROR] DOCX report generation failed.")
            return False

    except Exception as e:
        print(f"   [ERROR] Exception occurred during verification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()
        
    print("\n=== ENRON VERIFICATION SUCCESSFULLY COMPLETED ===")
    return True

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
