import os
import datetime
from sqlalchemy.orm import Session
from models import Case, Evidence, AuditLog
from services.timeline import TimelineService

# Import FPDF safely for creating the demo PDF
try:
    from fpdf import FPDF
    FPDF_AVAILABLE = True
except ImportError:
    FPDF_AVAILABLE = False

def setup_demo_files():
    """Creates actual sample files in the storage folder so they can be processed by the engines."""
    storage_dir = os.path.join(os.path.dirname(__file__), "storage")
    os.makedirs(storage_dir, exist_ok=True)

    # 1. Create a WhatsApp export file
    chat_path = os.path.join(storage_dir, "whatsapp-export.txt")
    chat_content = (
        "[06/06/2026, 16:01:12] John Doe: Where are you? We need to talk about the shipment at Warehouse 4.\n"
        "[06/06/2026, 16:03:00] Mark Smith: I'm not coming. You can't make me. You ruined the deal.\n"
        "[06/06/2026, 16:05:45] John Doe: If you don't show up in 10 mins, I'm calling the police. I have the delivery logs.\n"
        "[06/06/2026, 16:07:30] Mark Smith: If you touch those files or call anyone, you'll regret it. I'm on my way now.\n"
        "[06/06/2026, 16:11:15] John Doe: I am at Warehouse 4. Security camera is recording. Don't do anything stupid.\n"
    )
    with open(chat_path, "w", encoding="utf-8") as f:
        f.write(chat_content)

    # 2. Create a dummy video file (0-byte or tiny content)
    video_path = os.path.join(storage_dir, "cctv-altercation.mp4")
    if not os.path.exists(video_path):
        with open(video_path, "wb") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 1000)

    # 3. Create a dummy audio file
    audio_path = os.path.join(storage_dir, "phone-recording.wav")
    if not os.path.exists(audio_path):
        with open(audio_path, "wb") as f:
            # Simple 44-byte WAV header + dummy data
            f.write(b"RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00" + b"\x00" * 2000)

    # 4. Create a real PDF document using FPDF
    pdf_path = os.path.join(storage_dir, "police-incident-report.pdf")
    if FPDF_AVAILABLE:
        try:
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, "OFFICIAL POLICE REPORT", 0, 1, "C")
            pdf.ln(10)
            
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(40, 10, "Incident ID:")
            pdf.set_font("Helvetica", "")
            pdf.cell(80, 10, "INC-2026-88492")
            pdf.ln(8)
            
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(40, 10, "Date:")
            pdf.set_font("Helvetica", "")
            pdf.cell(80, 10, "2026-06-06")
            pdf.ln(8)

            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(40, 10, "Location:")
            pdf.set_font("Helvetica", "")
            pdf.cell(80, 10, "Warehouse 4, North Sector")
            pdf.ln(12)

            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 10, "Narrative:")
            pdf.ln(8)
            pdf.set_font("Helvetica", "", 10)
            narrative = (
                "Responding officer Green was dispatched to Warehouse 4 following reports of a disturbance. "
                "Upon arrival, security officer John Doe reported being confronted and physically assaulted by a former employee, Mark Smith (email: mark.smith@logistics.com, phone: 555-0199). "
                "The suspect fled in a black Toyota Prius with license plate AP09XX1234. "
                "The victim reported that the incident was preceded by threats sent via mobile chat."
            )
            pdf.multi_cell(0, 6, narrative)
            pdf.output(pdf_path)
        except Exception as e:
            print(f"Failed to generate pdf with FPDF: {e}")
            # Fallback to plain text masquerading as a PDF (safely caught)
            with open(pdf_path, "w") as f:
                f.write("OFFICIAL POLICE REPORT\nDate: 2026-06-06\nLocation: Warehouse 4\nOfficer Green dispatched. John Doe reports assault by Mark Smith (555-0199, mark.smith@logistics.com). Vehicle license plate: AP09XX1234.")
    else:
        # Write text content
        with open(pdf_path, "w") as f:
            f.write("OFFICIAL POLICE REPORT\nDate: 2026-06-06\nLocation: Warehouse 4\nOfficer Green dispatched. John Doe reports assault by Mark Smith (555-0199, mark.smith@logistics.com). Vehicle license plate: AP09XX1234.")

    return chat_path, video_path, audio_path, pdf_path

def load_demo_case(db: Session):
    """Loads the demo case and processes the evidence files."""
    # Check if demo case already exists
    existing_case = db.query(Case).filter(Case.title == "Case Alpha: Altercation at Warehouse 4").first()
    if existing_case:
        # Re-run processing just to be safe
        TimelineService.process_and_reconstruct(db, existing_case.id)
        return existing_case

    # Create Case
    new_case = Case(
        title="Case Alpha: Altercation at Warehouse 4",
        description="Investigation into a physical altercation and vehicle theft reported at Warehouse 4 on the afternoon of June 6, 2026, involving John Doe and Mark Smith.",
        status="Active"
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Set up files on disk
    chat_path, video_path, audio_path, pdf_path = setup_demo_files()

    # Create Evidence records
    evidences = [
        Evidence(
            case_id=new_case.id,
            filename="whatsapp-export.txt",
            file_path=chat_path,
            file_type="chat",
            file_size=os.path.getsize(chat_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="cctv-altercation.mp4",
            file_path=video_path,
            file_type="video",
            file_size=os.path.getsize(video_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="phone-recording.wav",
            file_path=audio_path,
            file_type="audio",
            file_size=os.path.getsize(audio_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="police-incident-report.pdf",
            file_path=pdf_path,
            file_type="pdf",
            file_size=os.path.getsize(pdf_path),
            status="Pending"
        )
    ]

    for ev in evidences:
        db.add(ev)
    db.commit()

    # Log initial audit
    audit = AuditLog(
        case_id=new_case.id,
        action="Case Initialized",
        performed_by="System Administrator",
        details="Demo case created and 4 evidence files registered for processing."
    )
    db.add(audit)
    db.commit()

    # Run Reconstruction Engine
    TimelineService.process_and_reconstruct(db, new_case.id)
    
    return new_case
