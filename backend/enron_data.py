import os
import datetime
from sqlalchemy.orm import Session
from models import Case, Evidence, AuditLog
from services.timeline import TimelineService
from PIL import Image, ImageDraw

try:
    from fpdf import FPDF
    FPDF_AVAILABLE = True
except ImportError:
    FPDF_AVAILABLE = False

def create_enron_stock_chart(output_path: str):
    """Generates a high-quality line chart showing the Enron stock price collapse in 2001 using Pillow."""
    width, height = 600, 300
    img = Image.new("RGB", (width, height), "#0f172a") # Slate-900 background
    draw = ImageDraw.Draw(img)
    
    # Historical ENE stock prices (Jan 2001 to Dec 2001)
    # January: 83.0, Feb: 72.0, Mar: 60.0, Apr: 55.0, May: 54.0, Jun: 49.0, Jul: 48.0, Aug: 36.0, Sep: 25.0, Oct: 15.0, Nov: 1.0, Dec: 0.25
    prices = [83.0, 72.0, 60.0, 55.0, 54.0, 49.0, 48.0, 36.0, 25.0, 15.0, 1.0, 0.25]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    # Grid parameters
    padding_x, padding_y = 60, 40
    chart_w = width - 2 * padding_x
    chart_h = height - 2 * padding_y
    
    # Draw Grid Lines
    for val in range(0, 91, 15):
        y = padding_y + chart_h - int((val / 90.0) * chart_h)
        draw.line([(padding_x, y), (width - padding_x, y)], fill="#1e293b", width=1) # Slate-800 grid line
        draw.text((padding_x - 30, y - 5), f"${val}", fill="#64748b") # Y-axis label
        
    for i, month in enumerate(months):
        x = padding_x + int((i / 11.0) * chart_w)
        draw.line([(x, padding_y), (x, height - padding_y)], fill="#1e293b", width=1) # X-axis grid line
        draw.text((x - 10, height - padding_y + 10), month, fill="#64748b") # X-axis label

    # Plot line
    points = []
    for i, p in enumerate(prices):
        x = padding_x + int((i / 11.0) * chart_w)
        y = padding_y + chart_h - int((p / 90.0) * chart_h)
        points.append((x, y))
        
    # Draw line with red color
    draw.line(points, fill="#f43f5e", width=3) # Rose-500 line
    
    # Draw points
    for pt in points:
        draw.ellipse([pt[0]-3, pt[1]-3, pt[0]+3, pt[1]+3], fill="#fb7185", outline="#f43f5e")
        
    # Draw Titles
    draw.text((width // 2 - 120, 10), "Enron Corp. (ENE) Stock Price Collapse - 2001", fill="#f1f5f9")
    
    img.save(output_path)

def setup_enron_files():
    """Creates actual sample files for the Enron case in the storage folder."""
    storage_dir = os.path.join(os.path.dirname(__file__), "storage")
    os.makedirs(storage_dir, exist_ok=True)

    # 1. Create a structured email/chat exchange text file
    emails_path = os.path.join(storage_dir, "skilling-lay-emails.txt")
    emails_content = (
        "[15/08/2001, 10:15:30] Sherron Watkins: Kenneth, I am incredibly nervous that we will implode in a wave of accounting scandals. Jeffrey Skilling's resignation is just the start.\n"
        "[15/08/2001, 14:30:00] Kenneth Lay: Sherron, thank you for raising this. Let's schedule a meeting on August 20 to review these Raptor and LJM transactions in detail.\n"
        "[20/08/2001, 11:00:00] Sherron Watkins: Kenneth, here is the detailed report. Andrew Fastow has hidden hundreds of millions of debt in Raptor. If our stock price drops, Enron is in severe jeopardy.\n"
        "[20/08/2001, 11:45:00] Kenneth Lay: I will have Vinson & Elkins launch an independent review immediately. I appreciate your warning.\n"
        "[22/10/2001, 09:00:00] SEC Investigator: We are launching an official inquiry into Enron's transactions with LJM partnerships.\n"
    )
    with open(emails_path, "w", encoding="utf-8") as f:
        f.write(emails_content)

    # 2. Create a dummy video file for the Arthur Andersen shredding log
    video_path = os.path.join(storage_dir, "cctv-shredding-room.mp4")
    if not os.path.exists(video_path):
        with open(video_path, "wb") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 1000)

    # 3. Create a dummy audio file for the Grubman conference call
    audio_path = os.path.join(storage_dir, "grubman-conference-call.wav")
    if not os.path.exists(audio_path):
        with open(audio_path, "wb") as f:
            f.write(b"RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00" + b"\x00" * 2000)

    # 4. Create the stock collapse image
    chart_path = os.path.join(storage_dir, "enron-stock-collapse.png")
    create_enron_stock_chart(chart_path)

    # 5. Create the Whistleblower Memo PDF
    pdf_path = os.path.join(storage_dir, "enron-whistleblower-memo.pdf")
    memo_text = (
        "MEMORANDUM\n"
        "TO: Kenneth Lay\n"
        "FROM: Sherron Watkins\n"
        "DATE: August 20, 2001\n"
        "SUBJECT: Enron Accounting Practices\n\n"
        "Dear Mr. Lay,\n\n"
        "I am incredibly nervous that we will implode in a wave of accounting scandals. "
        "The business world will consider the past successes to be nothing but an elaborate accounting hoax. "
        "We have a serious problem with the Raptor entities and LJM partnerships.\n\n"
        "Andrew Fastow has created LJM LDC as a special purpose entity to hide hundreds of millions of dollars of Enron's debt and losses off our balance sheet. "
        "The Raptor transactions are backed by Enron stock. If Enron stock declines below a certain threshold, the Raptors will default, and Enron will be forced to issue millions of shares of stock to cover the losses, diluting our shareholders and exposing our deceptive accounting.\n\n"
        "Arthur Andersen, our auditor, is complicit. They have signed off on these transactions despite knowing the risk. "
        "Jeffrey Skilling's sudden resignation as CEO on August 14, 2001 is a clear sign that he knows the collapse is imminent. He is trying to distance himself from the fallout.\n\n"
        "We must act immediately. We need to conduct a thorough independent investigation, restate our earnings, and wind down the Raptor partnerships. "
        "If we do not, the SEC will investigate us, our credit rating will be downgraded to junk, and we will face bankruptcy."
    )

    if FPDF_AVAILABLE:
        try:
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, "CONFIDENTIAL MEMORANDUM", 0, 1, "C")
            pdf.ln(5)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(30, 8, "TO:")
            pdf.set_font("Helvetica", "")
            pdf.cell(0, 8, "Kenneth Lay (CEO, Enron Corp)")
            pdf.ln(6)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(30, 8, "FROM:")
            pdf.set_font("Helvetica", "")
            pdf.cell(0, 8, "Sherron Watkins (VP, Corporate Development)")
            pdf.ln(6)

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(30, 8, "DATE:")
            pdf.set_font("Helvetica", "")
            pdf.cell(0, 8, "August 20, 2001")
            pdf.ln(6)

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(30, 8, "SUBJECT:")
            pdf.set_font("Helvetica", "")
            pdf.cell(0, 8, "Enron Accounting Practices & Raptor Partnerships")
            pdf.ln(10)

            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 6, memo_text[125:]) # Strip headers as they are rendered nicely above
            pdf.output(pdf_path)
        except Exception as e:
            print(f"Failed to generate Enron pdf with FPDF: {e}")
            with open(pdf_path, "w", encoding="utf-8") as f:
                f.write(memo_text)
    else:
        with open(pdf_path, "w", encoding="utf-8") as f:
            f.write(memo_text)

    return emails_path, video_path, audio_path, pdf_path, chart_path

def load_enron_case(db: Session):
    """Loads the Enron corporate fraud case and processes the evidence files."""
    # Check if case already exists
    existing_case = db.query(Case).filter(Case.title == "Case Beta: Enron Corporation Corporate Fraud").first()
    if existing_case:
        # Re-run processing just to be safe
        TimelineService.process_and_reconstruct(db, existing_case.id)
        return existing_case

    # Create Case
    new_case = Case(
        title="Case Beta: Enron Corporation Corporate Fraud",
        description="Investigation into Enron Corporation's complex financial fraud, off-balance-sheet debt hiding via Raptor/LJM partnerships, whistleblower reports by Sherron Watkins, and document shredding by Arthur Andersen LLP in late 2001.",
        status="Active"
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Set up files on disk
    emails_path, video_path, audio_path, pdf_path, chart_path = setup_enron_files()

    # Create Evidence records
    evidences = [
        Evidence(
            case_id=new_case.id,
            filename="skilling-lay-emails.txt",
            file_path=emails_path,
            file_type="chat",
            file_size=os.path.getsize(emails_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="cctv-shredding-room.mp4",
            file_path=video_path,
            file_type="video",
            file_size=os.path.getsize(video_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="grubman-conference-call.wav",
            file_path=audio_path,
            file_type="audio",
            file_size=os.path.getsize(audio_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="enron-whistleblower-memo.pdf",
            file_path=pdf_path,
            file_type="pdf",
            file_size=os.path.getsize(pdf_path),
            status="Pending"
        ),
        Evidence(
            case_id=new_case.id,
            filename="enron-stock-collapse.png",
            file_path=chart_path,
            file_type="image",
            file_size=os.path.getsize(chart_path),
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
        performed_by="Securities and Exchange Commission",
        details="Enron investigation opened. Whistleblower memo, emails, conference calls, stock collapse chart, and CCTV records submitted for analysis."
    )
    db.add(audit)
    db.commit()

    # Run Reconstruction Engine
    TimelineService.process_and_reconstruct(db, new_case.id)
    
    return new_case
